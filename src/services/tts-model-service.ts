import {
  deleteModelByCategory,
  ensureModelByCategory,
  ModelCategory,
  refreshModelsByCategory,
  type DownloadProgress,
  type TtsModelMeta,
} from "react-native-sherpa-onnx/download";
import { detectTtsModel } from "react-native-sherpa-onnx/tts";

import { TTS_MODEL_CATALOG, TtsModelCatalogEntry } from "@/constants/tts-model-catalog";
import { TtsModel } from "@/domain/tts-model/tts-model";
import { TtsModelNotFoundError } from "@/errors/tts-model-not-found-error";
import { ValidationError } from "@/errors/validation-error";
import { TtsModelRepository } from "@/repositories/tts-model-repository";

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
    if (!models.some((model) => model.id === entry.id)) {
      throw new ValidationError("This TTS model is not available in the sherpa-onnx release catalog.");
    }
    const result = await ensureModelByCategory(ModelCategory.Tts, entry.id, {
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
