import { setAudioModeAsync } from "expo-audio";
import { createStreamingTTS, type StreamingTtsEngine, type TtsStreamController, type TTSModelType } from "react-native-sherpa-onnx/tts";

import { LocalLlmCoordinator } from "@/services/local-llm-coordinator";
import { TtsModelService } from "@/services/tts-model-service";

export type SpeechPlaybackErrorCode = "missing-model" | "busy" | "playback";
export type SpeechPlaybackPhase = "idle" | "preparing" | "playing" | "error";
export type SpeechPlaybackState = { phase: SpeechPlaybackPhase; speechId: string | null; label: string | null; message: string | null; errorCode: SpeechPlaybackErrorCode | null; inferenceBusy: boolean };
export type SpeechRequest = { id: string; label: string; text: string };

type SpeechSession = {
  id: string;
  label: string;
  text: string;
  engine: StreamingTtsEngine | null;
  controller: TtsStreamController | null;
  writeChain: Promise<void>;
  playbackStartedAt: number | null;
  totalSamples: number;
  sampleRate: number | null;
  completionTimer: ReturnType<typeof setTimeout> | null;
  interruptPromise: Promise<void> | null;
  streamStarted: boolean;
  streamEnded: Promise<void>;
  resolveStreamEnded: () => void;
  cancelled: boolean;
  cleaned: boolean;
};

const initialState: SpeechPlaybackState = { phase: "idle", speechId: null, label: null, message: null, errorCode: null, inferenceBusy: false };

export class SpeechPlaybackService {
  private readonly listeners = new Set<() => void>();
  private state: SpeechPlaybackState = initialState;
  private session: SpeechSession | null = null;
  private lifecycleChain: Promise<void> = Promise.resolve();
  private initialized = false;

  public constructor(private readonly ttsModelService: TtsModelService, private readonly coordinator: LocalLlmCoordinator) {
    this.coordinator.registerSpeechPlaybackStopper(() => this.stop());
    this.coordinator.subscribe(() => {
      const inferenceBusy = this.coordinator.isBusy();
      if (inferenceBusy !== this.state.inferenceBusy) this.setState({ ...this.state, inferenceBusy });
    });
  }

  public getSnapshot = (): SpeechPlaybackState => this.state;
  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
  }

  public speak(request: SpeechRequest): Promise<void> {
    const text = request.text.trim();
    if (!text) {
      this.setError(request.id, request.label, "playback", "There is no text to read aloud.");
      return Promise.resolve();
    }
    // An active button is a stop button. The next press starts again from the beginning.
    if (this.session?.id === request.id) return this.stop();
    if (this.coordinator.isBusy()) {
      this.setError(request.id, request.label, "busy", "Wait for the current local AI or transcription operation to finish.");
      return Promise.resolve();
    }

    const previous = this.detachSession();
    let resolveStreamEnded: () => void = () => {};
    const streamEnded = new Promise<void>((resolve) => {
      resolveStreamEnded = resolve;
    });
    const session: SpeechSession = {
      id: request.id, label: request.label, text, engine: null, controller: null,
      writeChain: Promise.resolve(), playbackStartedAt: null, totalSamples: 0,
      sampleRate: null, completionTimer: null, interruptPromise: null,
      streamStarted: false, streamEnded, resolveStreamEnded,
      cancelled: false, cleaned: false,
    };
    this.session = session;
    this.setSessionState(session, "preparing", "Preparing speech…");
    return this.enqueueLifecycle(async () => {
      if (previous) await this.cleanupSession(previous);
      if (!this.isCurrent(session)) {
        await this.cleanupSession(session);
        return;
      }
      await this.startSession(session);
    });
  }

  public stop(): Promise<void> {
    const session = this.detachSession();
    this.setState({ ...initialState, inferenceBusy: this.coordinator.isBusy() });
    if (!session) return this.lifecycleChain;
    return this.enqueueLifecycle(() => this.cleanupSession(session));
  }

  public stopForBackground(): void { void this.stop(); }

  private async startSession(session: SpeechSession): Promise<void> {
    try {
      await setAudioModeAsync({ allowsRecording: false, interruptionMode: "doNotMix", playsInSilentMode: true, shouldPlayInBackground: false });
      const model = await this.ttsModelService.getActiveModel();
      if (!this.isCurrent(session)) return;
      if (model === null) {
        await this.failStartingSession(session, "missing-model", "Download and activate a TTS model first.");
        return;
      }
      const engine = await createStreamingTTS({
        modelPath: { type: "file", path: this.ttsModelService.resolveModelPath(model) },
        modelType: model.getModelType() as TTSModelType,
        numThreads: 2,
      });
      session.engine = engine;
      if (!this.isCurrent(session)) return;
      const sampleRate = await engine.getSampleRate();
      if (!this.isCurrent(session)) return;
      session.sampleRate = sampleRate;
      await engine.startPcmPlayer(sampleRate, 1);
      if (!this.isCurrent(session)) return;
      session.streamStarted = true;
      session.controller = await engine.generateSpeechStream(session.text, { sid: 0, speed: 1 }, {
        onChunk: (chunk) => this.handleStreamChunk(session, chunk.samples, chunk.sampleRate),
        onEnd: (event) => {
          session.resolveStreamEnded();
          if (!event.cancelled) void this.handleStreamEnd(session);
        },
        onError: (event) => {
          session.resolveStreamEnded();
          void this.failSession(session, "playback", event.message);
        },
      });
      // Stop may land during the library's listener-registration yield, before
      // native generation actually starts. Re-issue cancellation once startup
      // has crossed that boundary so a cancelled session cannot keep inferring.
      if (!this.isCurrent(session)) session.interruptPromise = this.interruptEngine(engine);
    } catch (error) {
      session.resolveStreamEnded();
      if (this.isCurrent(session)) {
        await this.failStartingSession(
          session,
          "playback",
          error instanceof Error ? error.message : "Unable to start speech playback.",
        );
      }
    }
  }

  private handleStreamChunk(session: SpeechSession, samples: number[], sampleRate: number): void {
    if (!this.isCurrent(session) || samples.length === 0 || session.engine === null) return;
    session.sampleRate = sampleRate;
    session.totalSamples += samples.length;
    if (session.playbackStartedAt === null) {
      session.playbackStartedAt = Date.now();
      this.setSessionState(session, "playing", "Playing");
    }
    const engine = session.engine;
    session.writeChain = session.writeChain.then(async () => {
      if (this.isCurrent(session)) await engine.writePcmChunk(samples);
    }).catch((error) => {
      if (this.isCurrent(session)) void this.failSession(session, "playback", error instanceof Error ? error.message : "Speech playback failed.");
    });
  }

  private async handleStreamEnd(session: SpeechSession): Promise<void> {
    await session.writeChain.catch(() => undefined);
    if (!this.isCurrent(session)) return;
    // iOS queues PCM buffers, so retain the engine until the queued audio has drained.
    const durationMs = session.sampleRate ? (session.totalSamples / session.sampleRate) * 1000 : 0;
    const elapsedMs = session.playbackStartedAt === null ? 0 : Date.now() - session.playbackStartedAt;
    session.completionTimer = setTimeout(() => {
      session.completionTimer = null;
      void this.completeSession(session);
    }, Math.max(0, durationMs - elapsedMs + 100));
  }

  private completeSession(session: SpeechSession): Promise<void> {
    if (!this.isCurrent(session)) return Promise.resolve();
    this.session = null;
    session.cancelled = true;
    this.setState({ ...initialState, inferenceBusy: this.coordinator.isBusy() });
    return this.enqueueLifecycle(() => this.cleanupSession(session));
  }

  private failSession(session: SpeechSession, code: SpeechPlaybackErrorCode, message: string): Promise<void> {
    if (!this.isCurrent(session)) return Promise.resolve();
    this.session = null;
    session.cancelled = true;
    this.setError(session.id, session.label, code, message);
    return this.enqueueLifecycle(() => this.cleanupSession(session));
  }

  private async failStartingSession(
    session: SpeechSession,
    code: SpeechPlaybackErrorCode,
    message: string,
  ): Promise<void> {
    if (!this.isCurrent(session)) return;
    this.session = null;
    session.cancelled = true;
    this.setError(session.id, session.label, code, message);
    await this.cleanupSession(session);
  }

  private detachSession(): SpeechSession | null {
    const session = this.session;
    if (session) {
      this.session = null;
      session.cancelled = true;
      if (session.completionTimer !== null) clearTimeout(session.completionTimer);
      session.completionTimer = null;
      // Start one immediate native stop chain. Cleanup awaits this same promise
      // instead of issuing overlapping stop/release calls.
      session.interruptPromise = this.interruptSession(session);
    }
    return session;
  }

  private async cleanupSession(session: SpeechSession): Promise<void> {
    if (session.cleaned) return;
    session.cleaned = true;
    session.cancelled = true;
    if (session.completionTimer !== null) clearTimeout(session.completionTimer);
    session.completionTimer = null;
    const engine = session.engine;
    session.engine = null;
    if (engine !== null) {
      await (session.interruptPromise ?? this.interruptEngine(engine));
      // Native generation owns callbacks into the TTS engine. Destroying before
      // onEnd is a use-after-free even if cancelSpeechStream() has resolved.
      if (session.streamStarted) await session.streamEnded;
      await session.writeChain.catch(() => undefined);
      session.controller?.unsubscribe();
      session.controller = null;
      await engine.destroy().catch(() => undefined);
    }
  }

  private interruptSession(session: SpeechSession): Promise<void> {
    const engine = session.engine;
    return engine === null ? Promise.resolve() : this.interruptEngine(engine);
  }

  private async interruptEngine(engine: StreamingTtsEngine): Promise<void> {
    // Stop audible output first, then cancel inference. Both calls are serialized
    // to avoid racing the native PCM player against itself.
    await engine.stopPcmPlayer().catch(() => undefined);
    await engine.cancelSpeechStream().catch(() => undefined);
  }

  private enqueueLifecycle(operation: () => Promise<void>): Promise<void> {
    const result = this.lifecycleChain.then(operation, operation);
    this.lifecycleChain = result.catch(() => undefined);
    return result;
  }
  private isCurrent(session: SpeechSession): boolean { return this.session === session && !session.cancelled; }
  private setSessionState(session: SpeechSession, phase: SpeechPlaybackPhase, message: string, errorCode: SpeechPlaybackErrorCode | null = null): void {
    if (!this.isCurrent(session)) return;
    this.setState({ phase, speechId: session.id, label: session.label, message, errorCode, inferenceBusy: this.coordinator.isBusy() });
  }
  private setError(id: string, label: string, code: SpeechPlaybackErrorCode, message: string): void {
    this.setState({ phase: "error", speechId: id, label, message, errorCode: code, inferenceBusy: this.coordinator.isBusy() });
  }
  private setState(state: SpeechPlaybackState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
}
