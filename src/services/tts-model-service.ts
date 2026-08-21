import {
  deleteModelByCategory,
  extractModelByCategory,
  ModelCategory,
  refreshModelsByCategory,
  type DownloadProgress,
  type TtsModelMeta,
} from "react-native-sherpa-onnx/download";
import { detectTtsModel } from "react-native-sherpa-onnx/tts";
import { File, Paths } from "expo-file-system";

import { TTS_MODEL_CATALOG, TtsModelCatalogEntry } from "@/constants/tts-model-catalog";
import { TtsModel } from "@/domain/tts-model/tts-model";
import { TtsModelNotFoundError } from "@/errors/tts-model-not-found-error";
import { ValidationError } from "@/errors/validation-error";
import { TtsModelRepository } from "@/repositories/tts-model-repository";
import { ensureStorageAvailable } from "@/services/storage-safety-service";

export type TtsModelDownloadProgress = {
  bytesWritten: number;
  totalBytes: number;
  phase: "downloading" | "extracting";
};

type ActiveDownload = {
  progress: TtsModelDownloadProgress | null;
  promise: Promise<TtsModel>;
  listeners: Set<(progress: TtsModelDownloadProgress) => void>;
};

export class TtsModelService {
  private readonly activeDownloads = new Map<string, ActiveDownload>();

  public constructor(private readonly repository: TtsModelRepository) {}

  public getCatalog(): readonly TtsModelCatalogEntry[] { return TTS_MODEL_CATALOG; }
  public getInstalledModels(): Promise<TtsModel[]> { return this.repository.findAll(); }
  public getActiveModel(): Promise<TtsModel | null> { return this.repository.findActive(); }
  public getDownloadState(id: string): TtsModelDownloadProgress | null {
    return this.activeDownloads.get(id)?.progress ?? null;
  }
  public getDownloadPromise(id: string): Promise<TtsModel> | null {
    return this.activeDownloads.get(id)?.promise ?? null;
  }
  public subscribeToDownload(id: string, listener: (progress: TtsModelDownloadProgress) => void): () => void {
    const active = this.activeDownloads.get(id);
    if (!active) return () => undefined;
    active.listeners.add(listener);
    if (active.progress) listener(active.progress);
    return () => active.listeners.delete(listener);
  }

  public async downloadModel(
    id: string,
    onProgress?: (progress: TtsModelDownloadProgress) => void,
  ): Promise<TtsModel> {
    const entry = this.getCatalogEntry(id);
    if (await this.repository.findById(id)) throw new ValidationError("This model is already installed.");
    const existing = this.activeDownloads.get(id);
    if (existing) {
      if (onProgress) existing.listeners.add(onProgress);
      return existing.promise;
    }

    const active: ActiveDownload = {
      progress: null,
      promise: Promise.resolve(null as unknown as TtsModel),
      listeners: new Set(onProgress ? [onProgress] : []),
    };
    const report = (progress: DownloadProgress) => {
      active.progress = {
        bytesWritten: progress.bytesDownloaded,
        totalBytes: progress.totalBytes,
        phase: progress.phase ?? "downloading",
      };
      active.listeners.forEach((listener) => listener(active.progress!));
    };
    active.promise = this.finishDownload(entry, report);
    this.activeDownloads.set(id, active);
    void active.promise.then(
      () => this.activeDownloads.delete(id),
      () => this.activeDownloads.delete(id),
    );
    return active.promise;
  }

  private async finishDownload(
    entry: TtsModelCatalogEntry,
    onProgress: (progress: DownloadProgress) => void,
  ): Promise<TtsModel> {
    const models = await refreshModelsByCategory<TtsModelMeta>(ModelCategory.Tts);
    const remoteModel = models.find((model) => model.id === entry.id);
    if (!remoteModel) {
      throw new ValidationError("This TTS model is not available in the sherpa-onnx release catalog.");
    }

    // The archive and extracted model coexist until validation completes.
    ensureStorageAvailable(
      Math.max(entry.sizeBytes, remoteModel.bytes) * 2,
      "download this text-to-speech model",
    );

    const archive = new File(
      Paths.document,
      "sherpa-onnx",
      "models",
      "tts",
      `${entry.id}.tar.bz2`,
    );
    archive.parentDirectory.create({ idempotent: true, intermediates: true });

    if (archive.exists && remoteModel.bytes > 0 && archive.size !== remoteModel.bytes) {
      this.safelyDeleteFile(archive);
    }

    if (!archive.exists) {
      const task = File.createDownloadTask(remoteModel.downloadUrl, archive, {
        sessionType: "foreground",
        onProgress: ({ bytesWritten, totalBytes }) => onProgress({
          bytesDownloaded: bytesWritten,
          totalBytes: totalBytes > 0 ? totalBytes : remoteModel.bytes,
          percent: remoteModel.bytes > 0 ? (bytesWritten / remoteModel.bytes) * 100 : 0,
          phase: "downloading",
        }),
      });

      let downloadedArchive: File | null;
      try {
        downloadedArchive = await task.downloadAsync();
      } catch (error) {
        this.safelyDeleteFile(archive);
        throw new Error("Unable to download the TTS model. Please try again.", {
          cause: error instanceof Error ? error : undefined,
        });
      }
      if (!downloadedArchive?.exists) {
        this.safelyDeleteFile(archive);
        throw new Error("The TTS model download did not complete. Please try again.");
      }
      if (remoteModel.bytes > 0 && downloadedArchive.size !== remoteModel.bytes) {
        this.safelyDeleteFile(downloadedArchive);
        throw new Error("The downloaded TTS model archive is incomplete. Please try again.");
      }
    }

    const result = await extractModelByCategory(ModelCategory.Tts, entry.id, {
      onProgress,
      deleteArchiveAfterExtract: true,
    });
    const detection = await detectTtsModel({ type: "file", path: result.localPath });
    if (!detection.success) {
      await deleteModelByCategory(ModelCategory.Tts, entry.id);
      throw new ValidationError(detection.error ?? "The downloaded TTS model is invalid.");
    }
    const now = new Date().toISOString();
    const model = new TtsModel(entry.id, "sherpa-onnx", entry.name, entry.modelType,
      entry.languages.join(", "), result.localPath, entry.sizeBytes, false, now, now, now);
    try { await this.repository.create(model); }
    catch (error) { await deleteModelByCategory(ModelCategory.Tts, entry.id); throw error; }
    return model;
  }

  private safelyDeleteFile(file: File): void {
    try { if (file.exists) file.delete(); } catch { /* Best-effort cleanup. */ }
  }

  public async setActiveModel(id: string): Promise<void> {
    const model = await this.getInstalledOrThrow(id);
    const detection = await detectTtsModel({ type: "file", path: model.getFilePath() });
    if (!detection.success) throw new ValidationError(detection.error ?? "This TTS model cannot be loaded.");
    model.activate();
    await this.repository.activateExclusively(model);
  }

  public async uninstallModel(id: string): Promise<void> {
    const model = await this.getInstalledOrThrow(id);
    if (model.getIsActive()) throw new ValidationError("This model is currently in use and cannot be uninstalled.");
    await deleteModelByCategory(ModelCategory.Tts, id);
    await this.repository.delete(id);
  }

  private getCatalogEntry(id: string): TtsModelCatalogEntry {
    const entry = TTS_MODEL_CATALOG.find((item) => item.id === id);
    if (!entry) throw new ValidationError("Unknown text-to-speech model.");
    return entry;
  }
  private async getInstalledOrThrow(id: string): Promise<TtsModel> {
    const model = await this.repository.findById(id);
    if (!model) throw new TtsModelNotFoundError(id);
    return model;
  }
}
