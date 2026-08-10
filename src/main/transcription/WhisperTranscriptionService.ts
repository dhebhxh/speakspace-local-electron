import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import LocalProcessRunner from '../runtime/LocalProcessRunner';
import { ManagedPaths } from '../runtime/ManagedPaths';
import AudioConversionService, {
  PreparedAudio,
} from './AudioConversionService';
import TranscriptionSourceResolver from './TranscriptionSourceResolver';
import {
  TranscriptionProgress,
  TranscriptionResult,
} from './TranscriptionTypes';
import WhisperOutputParser from './WhisperOutputParser';
import WhisperRuntimeService from './WhisperRuntimeService';

export type TranscriptionOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: TranscriptionProgress) => void;
};

/** 执行单次 whisper-cli 转写，不负责任务队列或数据库持久化。 */
export default class WhisperTranscriptionService {
  private readonly managedPaths: ManagedPaths;

  private readonly runtimeService: WhisperRuntimeService;

  private readonly sourceResolver: TranscriptionSourceResolver;

  private readonly audioConversion: AudioConversionService;

  private readonly processRunner: LocalProcessRunner;

  public constructor(
    managedPaths = ManagedPaths.getInstance(),
    runtimeService = new WhisperRuntimeService(managedPaths),
    sourceResolver = new TranscriptionSourceResolver(),
    processRunner = new LocalProcessRunner(),
    audioConversion = new AudioConversionService(managedPaths, processRunner),
  ) {
    this.managedPaths = managedPaths;
    this.runtimeService = runtimeService;
    this.sourceResolver = sourceResolver;
    this.processRunner = processRunner;
    this.audioConversion = audioConversion;
  }

  public async transcribe(
    source: unknown,
    options: TranscriptionOptions = {},
  ): Promise<TranscriptionResult> {
    const startedAt = Date.now();
    options.onProgress?.({
      phase: 'preparing',
      message: '正在准备本地音频 / Preparing local audio',
    });

    const inputPath = await this.sourceResolver.resolve(source);
    const runtime = this.runtimeService.requireReady();
    const outputBasePath = await this.createOutputBasePath(inputPath);
    const outputTextPath = `${outputBasePath}.txt`;
    const outputJsonPath = `${outputBasePath}.json`;
    let preparedAudio: PreparedAudio | null = null;

    try {
      preparedAudio = await this.audioConversion.prepare(
        inputPath,
        outputBasePath,
        runtime.ffmpegPath,
        options.signal,
      );
      options.onProgress?.({
        phase: 'transcribing',
        message: '本地 Whisper 正在转写 / Whisper is transcribing locally',
      });

      const threadCount = Math.max(1, Math.min(os.cpus().length - 1, 8));
      const processResult = await this.processRunner.run(
        runtime.whisperCliPath,
        [
          '-m',
          runtime.activeModelPath as string,
          '-f',
          preparedAudio.wavePath,
          '-l',
          'auto',
          '-t',
          String(threadCount),
          '-otxt',
          '-oj',
          '-of',
          outputBasePath,
        ],
        {
          cwd:
            runtime.runtimeLocation === 'portable'
              ? path.dirname(runtime.whisperCliPath)
              : undefined,
          signal: options.signal,
        },
      );
      const segments =
        await WhisperTranscriptionService.readSegments(outputJsonPath);
      const text = await WhisperTranscriptionService.readText(
        outputTextPath,
        processResult.stdout,
        segments,
      );

      options.onProgress?.({
        phase: 'completed',
        message: '转写完成 / Transcription completed',
      });
      return {
        text,
        segments,
        engine: 'whisper',
        modelId: runtime.activeModelId as string,
        modelName: runtime.activeModelName as string,
        elapsedMs: Date.now() - startedAt,
      };
    } finally {
      await this.cleanupOutput([
        outputTextPath,
        outputJsonPath,
        preparedAudio?.temporary ? preparedAudio.wavePath : null,
      ]);
    }
  }

  private async createOutputBasePath(inputPath: string): Promise<string> {
    const { outputRoot } = this.managedPaths.ensureRuntimeDirectories('stt');
    const baseName =
      path
        .basename(inputPath, path.extname(inputPath))
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .slice(0, 80) || 'audio';

    return path.join(outputRoot, `${baseName}-${Date.now()}`);
  }

  private async cleanupOutput(paths: Array<string | null>): Promise<void> {
    const managedOutput = paths.filter(
      (candidate): candidate is string =>
        candidate !== null && this.managedPaths.isManagedPath(candidate),
    );
    await Promise.all(
      managedOutput.map((candidate) => fs.rm(candidate, { force: true })),
    );
  }

  private static async readSegments(
    outputJsonPath: string,
  ): Promise<ReturnType<typeof WhisperOutputParser.parse>> {
    try {
      const payload = JSON.parse(await fs.readFile(outputJsonPath, 'utf8'));
      return WhisperOutputParser.parse(payload);
    } catch {
      return [];
    }
  }

  private static async readText(
    outputTextPath: string,
    stdout: string,
    segments: ReturnType<typeof WhisperOutputParser.parse>,
  ): Promise<string> {
    let text = '';
    try {
      text = (await fs.readFile(outputTextPath, 'utf8')).trim();
    } catch {
      text = stdout.trim();
    }
    if (!text && segments.length > 0) {
      text = segments
        .map((segment) => segment.text)
        .join(' ')
        .trim();
    }
    if (!text) {
      throw new Error('转写结果为空 / Transcription result is empty');
    }
    return text;
  }
}
