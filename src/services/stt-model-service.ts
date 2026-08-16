import { File, Paths } from "expo-file-system";
// The root "whisper.rn" specifier is not declared in the package's
// "exports" map (only subpaths are), so import the entry module directly.
import { initParakeet } from "whisper.rn/index";

import {
    STT_MODEL_CATALOG,
    STT_MODELS_DIRECTORY_NAME,
    SttModelCatalogEntry,
} from "@/constants/stt-model-catalog";
import { SttModel } from "@/domain/stt-model/stt-model";
import { DatabaseError } from "@/errors/database-error";
import { SttModelNotFoundError } from "@/errors/stt-model-not-found-error";
import { ValidationError } from "@/errors/validation-error";
import { SttModelRepository } from "@/repositories/stt-model-repository";

export type SttModelDownloadProgress = {
  bytesWritten: number;
  totalBytes: number;
};

export class SttModelService {
  public constructor(private readonly sttModelRepository: SttModelRepository) {}

  public getCatalog(): readonly SttModelCatalogEntry[] {
    return STT_MODEL_CATALOG;
  }

  public async getInstalledModels(): Promise<SttModel[]> {
    return this.sttModelRepository.findAll();
  }

  public async getActiveModel(): Promise<SttModel | null> {
    return this.sttModelRepository.findActive();
  }

  public async downloadModel(
    catalogId: string,
    onProgress?: (progress: SttModelDownloadProgress) => void,
  ): Promise<SttModel> {
    const catalogEntry = this.getCatalogEntryOrThrow(catalogId);
    const existing = await this.sttModelRepository.findById(catalogId);

    if (existing !== null) {
      throw new ValidationError("This model is already installed.");
    }

    const destinationFile = new File(
      Paths.document,
      STT_MODELS_DIRECTORY_NAME,
      catalogEntry.fileName,
    );
    destinationFile.parentDirectory.create({
      idempotent: true,
      intermediates: true,
    });

    const task = File.createDownloadTask(
      catalogEntry.downloadUrl,
      destinationFile,
      {
        onProgress: onProgress
          ? (data) =>
              onProgress({
                bytesWritten: data.bytesWritten,
                totalBytes: data.totalBytes,
              })
          : undefined,
      },
    );

    let downloadedFile: File | null;

    try {
      downloadedFile = await task.downloadAsync();
    } catch (error) {
      this.safelyDeleteFile(destinationFile);
      throw new DatabaseError("Unable to download the model.", {
        cause: error instanceof Error ? error : undefined,
      });
    }

    if (downloadedFile === null || !downloadedFile.exists) {
      throw new DatabaseError("Model download did not complete.");
    }

    await this.verifyModelLoads(catalogEntry, downloadedFile);

    const now = new Date().toISOString();
    const model = new SttModel(
      catalogEntry.id,
      catalogEntry.engine,
      catalogEntry.name,
      catalogEntry.format,
      catalogEntry.quantization,
      `${STT_MODELS_DIRECTORY_NAME}/${catalogEntry.fileName}`,
      downloadedFile.size,
      false,
      now,
      now,
      now,
    );

    try {
      await this.sttModelRepository.create(model);
    } catch (error) {
      this.safelyDeleteFile(downloadedFile);
      throw error;
    }

    return model;
  }

  public async setActiveModel(id: string): Promise<void> {
    const model = await this.getInstalledModelOrThrow(id);
    const file = this.resolveModelFile(model);

    if (!file.exists) {
      throw new ValidationError(
        "The model file is missing on this device. Please download it again.",
      );
    }

    await this.sttModelRepository.deactivateAll();
    model.activate();
    await this.sttModelRepository.update(model);
  }

  public async uninstallModel(id: string): Promise<void> {
    const model = await this.getInstalledModelOrThrow(id);

    if (model.getIsActive()) {
      throw new ValidationError(
        "This model is currently in use and cannot be uninstalled.",
      );
    }

    await this.sttModelRepository.delete(id);
    this.safelyDeleteFile(this.resolveModelFile(model));
  }

  public resolveModelFile(model: SttModel): File {
    return new File(Paths.document, ...model.getFileRelativePath().split("/"));
  }

  private async verifyModelLoads(
    catalogEntry: SttModelCatalogEntry,
    file: File,
  ): Promise<void> {
    try {
      const context = await initParakeet({
        filePath: file.uri,
        useGpu: false,
      });
      await context.release();
    } catch {
      this.safelyDeleteFile(file);
      throw new ValidationError(
        `"${catalogEntry.name}" could not be loaded by the speech recognition engine and was not installed.`,
      );
    }
  }

  private safelyDeleteFile(file: File): void {
    try {
      if (file.exists) {
        file.delete();
      }
    } catch {
      // Ignore cleanup failures; there is nothing else to do here.
    }
  }

  private getCatalogEntryOrThrow(catalogId: string): SttModelCatalogEntry {
    const catalogEntry = STT_MODEL_CATALOG.find(
      (entry) => entry.id === catalogId,
    );

    if (catalogEntry === undefined) {
      throw new ValidationError("Unknown speech recognition model.");
    }

    return catalogEntry;
  }

  private async getInstalledModelOrThrow(id: string): Promise<SttModel> {
    const model = await this.sttModelRepository.findById(id);

    if (model === null) {
      throw new SttModelNotFoundError(id);
    }

    return model;
  }
}
