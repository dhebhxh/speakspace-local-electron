import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from "expo-audio";
import { Directory, File, Paths } from "expo-file-system";
import {
  createTTS,
  saveAudioToFile,
  type TtsEngine,
  type TTSModelType,
} from "react-native-sherpa-onnx/tts";

import { LocalLlmCoordinator } from "@/services/local-llm-coordinator";
import { splitSpeechText } from "@/services/speech-text-chunks";
import { TtsModelService } from "@/services/tts-model-service";

export type SpeechPlaybackErrorCode = "missing-model" | "busy" | "playback";
export type SpeechPlaybackPhase = "idle" | "preparing" | "playing" | "paused" | "error";

export type SpeechPlaybackState = {
  phase: SpeechPlaybackPhase;
  speechId: string | null;
  label: string | null;
  message: string | null;
  errorCode: SpeechPlaybackErrorCode | null;
  inferenceBusy: boolean;
};

export type SpeechRequest = {
  id: string;
  label: string;
  text: string;
};

type Subscription = { remove: () => void };

type SpeechSession = {
  id: string;
  label: string;
  chunks: string[];
  cacheDirectory: Directory;
  engine: TtsEngine | null;
  player: AudioPlayer | null;
  playerSubscription: Subscription | null;
  generatedFiles: Map<number, File>;
  currentChunkIndex: number;
  nextSynthesisIndex: number;
  synthesisPromise: Promise<void> | null;
  cancelled: boolean;
  paused: boolean;
};

const CACHE_DIRECTORY_NAME = "speech-playback";
const initialState: SpeechPlaybackState = {
  phase: "idle",
  speechId: null,
  label: null,
  message: null,
  errorCode: null,
  inferenceBusy: false,
};

export class SpeechPlaybackService {
  private readonly listeners = new Set<() => void>();
  private state: SpeechPlaybackState = initialState;
  private session: SpeechSession | null = null;
  private initialized = false;

  public constructor(
    private readonly ttsModelService: TtsModelService,
    private readonly coordinator: LocalLlmCoordinator,
  ) {
    this.coordinator.registerSpeechPlaybackStopper(() => this.stop());
    this.coordinator.subscribe(() => {
      const inferenceBusy = this.coordinator.isBusy();
      if (inferenceBusy !== this.state.inferenceBusy) {
        this.setState({ ...this.state, inferenceBusy });
      }
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
    this.clearStartupCache();
  }

  public async speak(request: SpeechRequest): Promise<void> {
    const text = request.text.trim();
    if (!text) {
      this.setError(request.id, request.label, "playback", "There is no text to read aloud.");
      return;
    }

    if (this.session?.id === request.id) {
      if (this.state.phase === "paused") await this.resume();
      else await this.pause();
      return;
    }

    if (this.coordinator.isBusy()) {
      this.setError(request.id, request.label, "busy", "Wait for the current local AI or transcription operation to finish.");
      return;
    }

    const previous = this.detachSession();

    const cacheDirectory = new Directory(Paths.cache, CACHE_DIRECTORY_NAME, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    cacheDirectory.create({ idempotent: true, intermediates: true });
    const session: SpeechSession = {
      id: request.id,
      label: request.label,
      chunks: splitSpeechText(text),
      cacheDirectory,
      engine: null,
      player: null,
      playerSubscription: null,
      generatedFiles: new Map(),
      currentChunkIndex: 0,
      nextSynthesisIndex: 0,
      synthesisPromise: null,
      cancelled: false,
      paused: false,
    };
    this.session = session;
    this.setSessionState(session, "preparing", "Preparing speech…");

    try {
      if (previous) await this.cleanupSession(previous);
      if (!this.isCurrent(session)) return;
      await setAudioModeAsync({
        allowsRecording: false,
        interruptionMode: "doNotMix",
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
      const model = await this.ttsModelService.getActiveModel();
      if (!this.isCurrent(session)) return;
      if (model === null) {
        await this.failSession(session, "missing-model", "Download and activate a TTS model first.");
        return;
      }

      session.engine = await createTTS({
        modelPath: { type: "file", path: this.ttsModelService.resolveModelPath(model) },
        modelType: model.getModelType() as TTSModelType,
        numThreads: 2,
      });
      if (!this.isCurrent(session)) {
        await this.cleanupSession(session);
        return;
      }
      this.ensureSynthesis(session);
    } catch (error) {
      if (this.isCurrent(session)) {
        await this.failSession(
          session,
          "playback",
          error instanceof Error ? error.message : "Unable to start speech playback.",
        );
      }
    }
  }

  public async pause(): Promise<void> {
    const session = this.session;
    if (!session || session.cancelled || session.paused) return;
    session.paused = true;
    session.player?.pause();
    this.setSessionState(session, "paused", "Paused");
  }

  public async resume(): Promise<void> {
    const session = this.session;
    if (!session || session.cancelled || !session.paused) return;
    if (this.coordinator.isBusy()) {
      this.setSessionState(session, "paused", "Wait for the current local operation to finish.", "busy");
      return;
    }
    session.paused = false;
    if (session.player !== null) {
      session.player.play();
      this.setSessionState(session, "playing", "Playing");
      return;
    }
    this.setSessionState(session, "preparing", "Preparing speech…");
    this.startPlaybackIfReady(session);
    this.ensureSynthesis(session);
  }

  public async stop(): Promise<void> {
    const session = this.detachSession();
    if (!session) return;
    this.setState({ ...initialState, inferenceBusy: this.coordinator.isBusy() });
    await this.cleanupSession(session);
  }

  public pauseForBackground(): void {
    if (this.state.phase === "playing" || this.state.phase === "preparing") {
      void this.pause();
    }
  }

  private ensureSynthesis(session: SpeechSession): void {
    if (!this.isCurrent(session) || session.paused || session.synthesisPromise !== null || session.engine === null) return;
    session.synthesisPromise = this.pumpSynthesis(session).finally(() => {
      session.synthesisPromise = null;
    });
  }

  private async pumpSynthesis(session: SpeechSession): Promise<void> {
    while (
      this.isCurrent(session) &&
      !session.paused &&
      session.engine !== null &&
      session.nextSynthesisIndex < session.chunks.length
    ) {
      const index = session.nextSynthesisIndex;
      try {
        const audio = await session.engine.generateSpeech(session.chunks[index], { sid: 0, speed: 1 });
        if (session.cancelled) return;
        const file = new File(session.cacheDirectory, `chunk-${index}.wav`);
        const nativePath = decodeURI(file.uri.replace(/^file:\/\//, ""));
        await saveAudioToFile(audio, nativePath);
        if (session.cancelled) return;
        session.generatedFiles.set(index, file);
        session.nextSynthesisIndex += 1;
        this.startPlaybackIfReady(session);
      } catch (error) {
        if (this.isCurrent(session)) {
          void this.failSession(
            session,
            "playback",
            error instanceof Error ? error.message : "Speech synthesis failed.",
          );
        }
        return;
      }
    }
  }

  private startPlaybackIfReady(session: SpeechSession): void {
    if (!this.isCurrent(session) || session.paused || session.player !== null) return;
    if (session.currentChunkIndex >= session.chunks.length) {
      void this.completeSession(session);
      return;
    }
    const file = session.generatedFiles.get(session.currentChunkIndex);
    if (!file?.exists) return;

    const player = createAudioPlayer(file.uri, { updateInterval: 100 });
    session.player = player;
    session.playerSubscription = player.addListener("playbackStatusUpdate", (status) =>
      this.handlePlaybackStatus(session, player, status),
    );
    player.play();
    this.setSessionState(session, "playing", "Playing");
  }

  private handlePlaybackStatus(session: SpeechSession, player: AudioPlayer, status: AudioStatus): void {
    if (!this.isCurrent(session) || session.player !== player) return;
    if (status.error) {
      void this.failSession(session, "playback", status.error);
      return;
    }
    if (!status.didJustFinish) return;

    session.playerSubscription?.remove();
    session.playerSubscription = null;
    player.release();
    session.player = null;
    session.currentChunkIndex += 1;
    if (session.currentChunkIndex >= session.chunks.length) {
      void this.completeSession(session);
      return;
    }
    this.setSessionState(session, "preparing", "Preparing the next part…");
    this.startPlaybackIfReady(session);
    this.ensureSynthesis(session);
  }

  private async completeSession(session: SpeechSession): Promise<void> {
    if (!this.isCurrent(session)) return;
    this.session = null;
    this.setState({ ...initialState, inferenceBusy: this.coordinator.isBusy() });
    await this.cleanupSession(session);
  }

  private async failSession(session: SpeechSession, code: SpeechPlaybackErrorCode, message: string): Promise<void> {
    if (!this.isCurrent(session)) return;
    this.session = null;
    this.setError(session.id, session.label, code, message);
    await this.cleanupSession(session);
  }

  private detachSession(): SpeechSession | null {
    const session = this.session;
    if (session) {
      this.session = null;
      session.cancelled = true;
      session.paused = true;
      session.player?.pause();
    }
    return session;
  }

  private async cleanupSession(session: SpeechSession): Promise<void> {
    session.cancelled = true;
    session.paused = true;
    session.playerSubscription?.remove();
    session.playerSubscription = null;
    if (session.player) {
      session.player.pause();
      session.player.release();
      session.player = null;
    }
    const synthesis = session.synthesisPromise;
    if (synthesis) await synthesis.catch(() => undefined);
    const engine = session.engine;
    session.engine = null;
    await engine?.destroy().catch(() => undefined);
    try {
      if (session.cacheDirectory.exists) session.cacheDirectory.delete();
    } catch (error) {
      console.warn("[SpeechPlayback] Unable to clear temporary speech audio.", { error });
    }
  }

  private isCurrent(session: SpeechSession): boolean {
    return this.session === session && !session.cancelled;
  }

  private setSessionState(
    session: SpeechSession,
    phase: SpeechPlaybackPhase,
    message: string,
    errorCode: SpeechPlaybackErrorCode | null = null,
  ): void {
    if (!this.isCurrent(session)) return;
    this.setState({
      phase,
      speechId: session.id,
      label: session.label,
      message,
      errorCode,
      inferenceBusy: this.coordinator.isBusy(),
    });
  }

  private setError(id: string, label: string, code: SpeechPlaybackErrorCode, message: string): void {
    this.setState({
      phase: "error",
      speechId: id,
      label,
      message,
      errorCode: code,
      inferenceBusy: this.coordinator.isBusy(),
    });
  }

  private setState(state: SpeechPlaybackState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  private clearStartupCache(): void {
    try {
      const directory = new Directory(Paths.cache, CACHE_DIRECTORY_NAME);
      if (directory.exists) directory.delete();
      directory.create({ idempotent: true, intermediates: true });
    } catch (error) {
      console.warn("[SpeechPlayback] Unable to clear startup speech cache.", { error });
    }
  }
}
