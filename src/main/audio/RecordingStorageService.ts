import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { BlobStorage } from '../database/BlobStorage';
import { DatabaseManager } from '../database/DatabaseManager';

const MAX_RECORDING_BYTES = 1024 * 1024 * 1024;

const RECORDING_EXTENSIONS: Record<string, string> = {
  'audio/aac': 'aac',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/webm': 'webm',
  'audio/x-wav': 'wav',
};

const RECORDING_MIME_TYPES_BY_EXTENSION: Record<string, string> =
  Object.entries(RECORDING_EXTENSIONS).reduce<Record<string, string>>(
    (result, [mimeType, extension]) => {
      if (!result[extension]) result[extension] = mimeType;
      return result;
    },
    {},
  );
RECORDING_MIME_TYPES_BY_EXTENSION.flac = 'audio/flac';
RECORDING_MIME_TYPES_BY_EXTENSION.mp4 = 'audio/mp4';

export type SavedRecording = {
  relativePath: string;
  mimeType: string;
  byteLength: number;
  createdAt: string;
};

export type RecordingDiscardResult = {
  deleted: boolean;
  reason: 'deleted' | 'missing' | 'in-use';
};

/**
 * 保存 Renderer 录制的音频，并确保删除操作仅作用于未被笔记引用的受管录音。
 */
export default class RecordingStorageService {
  private readonly blobStorage: BlobStorage;

  private readonly database: Database.Database;

  public constructor(
    blobStorage = BlobStorage.getInstance(),
    database = DatabaseManager.getInstance().getDatabase(),
  ) {
    this.blobStorage = blobStorage;
    this.database = database;
  }

  public async saveRecording(
    rawData: unknown,
    rawMimeType: unknown,
  ): Promise<SavedRecording> {
    const bytes = RecordingStorageService.normalizeBytes(rawData);
    const mimeType = RecordingStorageService.normalizeMimeType(rawMimeType);
    const extension = RECORDING_EXTENSIONS[mimeType];
    const createdAt = new Date().toISOString();
    const fileName = `mic-recording-${Date.now()}-${randomUUID()}.${extension}`;
    const relativePath = path.posix.join('recordings', fileName);

    await this.blobStorage.save(
      relativePath,
      new Blob([new Uint8Array(bytes)], { type: mimeType }),
    );

    return {
      relativePath,
      mimeType,
      byteLength: bytes.byteLength,
      createdAt,
    };
  }

  public importRecordingFile(rawFilePath: unknown): SavedRecording {
    if (typeof rawFilePath !== 'string' || !rawFilePath.trim()) {
      throw new Error('无效的音频文件路径 / Invalid audio file path');
    }

    const filePath = path.resolve(rawFilePath);
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_RECORDING_BYTES) {
      throw new Error('音频文件大小无效 / Invalid audio file size');
    }

    const extension = path.extname(filePath).slice(1).toLowerCase();
    const mimeType = RECORDING_MIME_TYPES_BY_EXTENSION[extension];
    if (!mimeType) {
      throw new Error('不支持的音频格式 / Unsupported audio format');
    }

    const createdAt = new Date().toISOString();
    const fileName = `uploaded-audio-${Date.now()}-${randomUUID()}.${extension}`;
    const relativePath = path.posix.join('recordings', fileName);
    const targetPath = this.blobStorage.resolveAbsolutePath(relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(filePath, targetPath);

    return {
      relativePath,
      mimeType,
      byteLength: stat.size,
      createdAt,
    };
  }

  public discardRecording(rawRelativePath: unknown): RecordingDiscardResult {
    const relativePath =
      RecordingStorageService.normalizeRecordingPath(rawRelativePath);
    const referenceCount = this.countNoteReferences(relativePath);

    if (referenceCount > 0) {
      return { deleted: false, reason: 'in-use' };
    }
    if (!this.blobStorage.exists(relativePath)) {
      return { deleted: false, reason: 'missing' };
    }

    this.blobStorage.delete(relativePath);
    return { deleted: true, reason: 'deleted' };
  }

  private countNoteReferences(relativePath: string): number {
    const row = this.database
      .prepare(
        'SELECT COUNT(*) AS reference_count FROM notes WHERE audio_relative_path = ?',
      )
      .get(relativePath) as { reference_count: number };

    return Number(row.reference_count);
  }

  private static normalizeBytes(rawData: unknown): Uint8Array {
    let bytes: Uint8Array;

    if (rawData instanceof ArrayBuffer) {
      bytes = new Uint8Array(rawData);
    } else if (ArrayBuffer.isView(rawData)) {
      bytes = new Uint8Array(
        rawData.buffer,
        rawData.byteOffset,
        rawData.byteLength,
      );
    } else {
      throw new Error('无效的录音数据 / Invalid recording data');
    }

    if (bytes.byteLength === 0 || bytes.byteLength > MAX_RECORDING_BYTES) {
      throw new Error('录音数据大小无效 / Invalid recording size');
    }

    // 复制 IPC 数据，避免调用方随后修改同一个 ArrayBuffer。
    return Uint8Array.from(bytes);
  }

  private static normalizeMimeType(rawMimeType: unknown): string {
    if (typeof rawMimeType !== 'string') {
      throw new Error('无效的录音格式 / Invalid recording format');
    }

    const mimeType = rawMimeType.toLowerCase().split(';')[0].trim();
    if (!RECORDING_EXTENSIONS[mimeType]) {
      throw new Error('不支持的录音格式 / Unsupported recording format');
    }

    return mimeType;
  }

  private static normalizeRecordingPath(rawRelativePath: unknown): string {
    if (typeof rawRelativePath !== 'string') {
      throw new Error('无效的录音路径 / Invalid recording path');
    }

    const normalizedPath = rawRelativePath.replaceAll('\\', '/');
    const segments = normalizedPath.split('/');
    if (
      segments.length !== 2 ||
      segments[0] !== 'recordings' ||
      !segments[1] ||
      segments[1] === '.' ||
      segments[1] === '..'
    ) {
      throw new Error('录音不在受管目录中 / Recording is not managed');
    }

    return path.posix.join(segments[0], segments[1]);
  }
}
