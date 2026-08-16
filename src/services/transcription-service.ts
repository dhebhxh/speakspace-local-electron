import { Directory, File, Paths } from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import {
  initParakeet,
  type ParakeetContext,
} from "whisper.rn/index";
import {
  AudioPcmStreamAdapter,
} from "whisper.rn/realtime-transcription/adapters/AudioPcmStreamAdapter";
import {
  RealtimeTranscriber,
  type AudioStreamConfig,
  type AudioStreamData,
  type AudioStreamInterface,
  type RealtimeTranscribeEvent,
  type WavFileWriterFs,
} from "whisper.rn/realtime-transcription/";

import { SttModelService } from "@/services/stt-model-service";

export const RECORDINGS_DIRECTORY_NAME = "recordings";

type SessionCallbacks = {
  onText: (text: string) => void;
  onError: (message: string) => void;
};

class PausableAudioStream implements AudioStreamInterface {
  private stream = new AudioPcmStreamAdapter();
  private config: AudioStreamConfig | null = null;
  private dataCallback: ((data: AudioStreamData) => void) | null = null;
  private errorCallback: ((error: string) => void) | null = null;
  private statusCallback: ((isRecording: boolean) => void) | null = null;

  public async initialize(config: AudioStreamConfig): Promise<void> {
    this.config = config;
    await this.stream.initialize(config);
    this.bindCallbacks();
  }

  public start(): Promise<void> {
    return this.stream.start();
  }

  public stop(): Promise<void> {
    return this.stream.stop();
  }

  public isRecording(): boolean {
    return this.stream.isRecording();
  }

  public onData(callback: (data: AudioStreamData) => void): void {
    this.dataCallback = callback;
    this.stream.onData(callback);
  }

  public onError(callback: (error: string) => void): void {
    this.errorCallback = callback;
    this.stream.onError(callback);
  }

  public onStatusChange(callback: (isRecording: boolean) => void): void {
    this.statusCallback = callback;
    this.stream.onStatusChange(callback);
  }

  public async restart(): Promise<void> {
    if (this.config === null) {
      throw new Error("Audio stream has not been initialized.");
    }

    // Android releases AudioRecord asynchronously after stop(). Give that
    // worker time to finish before creating the next recorder instance.
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
    this.stream = new AudioPcmStreamAdapter();
    await this.stream.initialize(this.config);
    this.bindCallbacks();
    await this.stream.start();
  }

  public release(): Promise<void> {
    return this.stream.release();
  }

  private bindCallbacks(): void {
    if (this.dataCallback !== null) this.stream.onData(this.dataCallback);
    if (this.errorCallback !== null) this.stream.onError(this.errorCallback);
    if (this.statusCallback !== null) {
      this.stream.onStatusChange(this.statusCallback);
    }
  }
}

type PendingTranscription = {
  sliceIndex: number;
  audioData: Uint8Array;
  isFinal?: boolean;
};

const fileSystemAdapter: WavFileWriterFs = {
  writeFile: (path, data, encoding) =>
    LegacyFileSystem.writeAsStringAsync(path, data, {
      encoding: encoding === "base64" ? "base64" : "utf8",
    }),
  appendFile: (path, data, encoding) =>
    LegacyFileSystem.writeAsStringAsync(path, data, {
      encoding: encoding === "base64" ? "base64" : "utf8",
      append: true,
    }),
  readFile: (path, encoding) =>
    LegacyFileSystem.readAsStringAsync(path, {
      encoding: encoding === "base64" ? "base64" : "utf8",
    }),
  exists: async (path) => (await LegacyFileSystem.getInfoAsync(path)).exists,
  unlink: (path) => LegacyFileSystem.deleteAsync(path, { idempotent: true }),
};

export class TranscriptionService {
  private context: ParakeetContext | null = null;
  private transcriber: RealtimeTranscriber | null = null;
  private audioStream: PausableAudioStream | null = null;
  private recordingRelativePath: string | null = null;
  private results = new Map<number, string>();
  private paused = false;
  private queueMaintenanceTimer: ReturnType<typeof setInterval> | null = null;

  public constructor(private readonly sttModelService: SttModelService) {}

  public async start(callbacks: SessionCallbacks): Promise<void> {
    if (this.transcriber !== null) {
      throw new Error("A transcription session is already active.");
    }

    const model = await this.sttModelService.getActiveModel();
    if (model === null) {
      throw new Error("Choose an active speech recognition model first.");
    }
    if (model.getEngine() !== "parakeet") {
      throw new Error("The active model is not supported by this transcriber.");
    }

    const modelFile = this.sttModelService.resolveModelFile(model);
    if (!modelFile.exists) {
      throw new Error("The active model file is missing.");
    }

    const recordings = new Directory(Paths.document, RECORDINGS_DIRECTORY_NAME);
    recordings.create({ idempotent: true, intermediates: true });
    const fileName = `recording-${Date.now()}.wav`;
    const recording = new File(recordings, fileName);
    this.recordingRelativePath = `${RECORDINGS_DIRECTORY_NAME}/${fileName}`;
    this.results.clear();
    this.paused = false;

    try {
      this.context = await initParakeet({
        filePath: modelFile.uri,
        useGpu: true,
      });
      this.audioStream = new PausableAudioStream();
      this.transcriber = new RealtimeTranscriber(
        { parakeetContext: this.context, audioStream: this.audioStream, fs: fileSystemAdapter },
        {
          audioSliceSec: 8,
          audioMinSec: 0.8,
          maxSlicesInMemory: 6,
          realtimeProcessingPauseMs: 1200,
          initRealtimeAfterMs: 800,
          audioOutputPath: recording.uri,
        },
        {
          onTranscribe: (event: RealtimeTranscribeEvent) => {
            if (event.data?.result !== undefined) {
              this.results.set(event.sliceIndex, event.data.result.trim());
              callbacks.onText(this.getTranscript());
            }
          },
          onError: callbacks.onError,
        },
      );
      await this.transcriber.start();
      this.queueMaintenanceTimer = setInterval(
        () => this.compactPendingTranscriptions(),
        500,
      );
    } catch (error) {
      await this.release(true);
      throw error;
    }
  }

  public async pause(): Promise<void> {
    if (this.audioStream === null || this.transcriber === null || this.paused) {
      return;
    }
    await this.audioStream.stop();
    await this.transcriber.nextSlice();
    this.paused = true;
  }

  public async resume(): Promise<void> {
    if (this.audioStream === null || !this.paused) return;
    await this.audioStream.restart();
    this.paused = false;
  }

  public async finish(): Promise<{ transcript: string; audioRelativePath: string }> {
    if (this.transcriber === null || this.recordingRelativePath === null) {
      throw new Error("There is no active transcription session.");
    }
    await this.transcriber.nextSlice();
    await this.transcriber.stop();
    const result = {
      transcript: this.getTranscript(),
      audioRelativePath: this.recordingRelativePath,
    };
    await this.release(false);
    return result;
  }

  public async discard(): Promise<void> {
    await this.release(true);
  }

  public deleteRecording(audioRelativePath: string): void {
    const file = new File(Paths.document, ...audioRelativePath.split("/"));
    if (file.exists) file.delete();
  }

  private getTranscript(): string {
    return [...this.results.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, text]) => text)
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  /**
   * whisper.rn 0.7.2 queues repeated full snapshots of the same slice faster
   * than Parakeet can consume them. Keep only the newest pending snapshot for
   * each slice so long sessions cannot fall permanently behind live audio.
   */
  private compactPendingTranscriptions(): void {
    if (this.transcriber === null) return;

    const internals = this.transcriber as unknown as {
      transcriptionQueue: PendingTranscription[];
    };
    const queue = internals.transcriptionQueue;
    if (!Array.isArray(queue) || queue.length < 2) return;

    const latestBySlice = new Map<number, PendingTranscription>();
    queue.forEach((item) => latestBySlice.set(item.sliceIndex, item));
    queue.splice(
      0,
      queue.length,
      ...[...latestBySlice.values()].sort(
        (left, right) => left.sliceIndex - right.sliceIndex,
      ),
    );
  }

  private async release(deleteRecording: boolean): Promise<void> {
    const recordingPath = this.recordingRelativePath;
    const transcriber = this.transcriber;
    const context = this.context;
    this.transcriber = null;
    this.audioStream = null;
    this.context = null;
    this.recordingRelativePath = null;
    this.paused = false;
    if (this.queueMaintenanceTimer !== null) {
      clearInterval(this.queueMaintenanceTimer);
      this.queueMaintenanceTimer = null;
    }

    await transcriber?.release().catch(() => undefined);
    await context?.release().catch(() => undefined);
    if (deleteRecording && recordingPath !== null) {
      const file = new File(Paths.document, ...recordingPath.split("/"));
      if (file.exists) file.delete();
    }
  }
}
