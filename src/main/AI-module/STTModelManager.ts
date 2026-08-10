import fs from 'fs';
import path from 'path';
import sttCatalogJson from '../../../config/stt-catalog.json';
import { STTModel } from './STTModel';
import { ModelManager } from './ModelManager';
import STTModelStateStore from './STTModelStateStore';
import { ManagedPaths } from '../runtime/ManagedPaths';
import FileDownloadService, {
  DownloadProgress,
} from '../runtime/FileDownloadService';

type STTCatalogItem = {
  id: string;
  name: string;
  language: string;
  engine: string;
  format: string;
  size: string;
  downloadUrl: string;
  checksum: string | null;
};

type STTCatalog = {
  stt: STTCatalogItem[];
};

type STTModelManagerDependencies = {
  managedPaths?: ManagedPaths;
  downloader?: FileDownloadService;
  stateStore?: STTModelStateStore;
};

/**
 * STT 模型目录服务。目录中的真实文件决定下载状态，userData 状态文件决定当前模型。
 */
// 保留命名导出，与现有 IPC 和推荐模块的导入方式一致。
// eslint-disable-next-line import/prefer-default-export
export class STTModelManager implements ModelManager {
  private readonly catalog: STTCatalogItem[];

  private readonly modelDir: string;

  private readonly stateStore: STTModelStateStore;

  private readonly downloader: FileDownloadService;

  public constructor(dependencies: STTModelManagerDependencies = {}) {
    const managedPaths =
      dependencies.managedPaths ?? ManagedPaths.getInstance();

    this.catalog = (sttCatalogJson as STTCatalog).stt;
    this.modelDir = managedPaths.getRuntimePaths('stt').modelsRoot;
    this.downloader = dependencies.downloader ?? new FileDownloadService();
    this.stateStore =
      dependencies.stateStore ??
      new STTModelStateStore(
        managedPaths.resolveManagedPath('model-state', 'stt.json'),
      );
  }

  public getModelList(): STTModel[] {
    const activeModelId = this.stateStore.getActiveModelId();

    return this.catalog.map((item) => {
      const downloaded = fs.existsSync(this.getCatalogModelPath(item));
      return STTModelManager.createModel(
        item,
        downloaded,
        downloaded && activeModelId === item.id,
      );
    });
  }

  public async downloadModel(
    id: string,
    onProgress?: (progress: DownloadProgress) => void,
  ): Promise<void> {
    const item = this.findCatalogItem(id);
    const modelPath = this.getCatalogModelPath(item);

    if (fs.existsSync(modelPath)) {
      throw new Error('模型已经下载 / Model has already been downloaded');
    }

    await this.downloader.download(item.downloadUrl, modelPath, {
      expectedSha1: item.checksum,
      onProgress,
    });
  }

  public async deleteModel(id: string): Promise<void> {
    const item = this.findCatalogItem(id);
    const modelPath = this.getCatalogModelPath(item);

    if (!fs.existsSync(modelPath)) {
      throw new Error('模型尚未下载 / Model has not been downloaded');
    }

    await fs.promises.unlink(modelPath);
    if (this.stateStore.getActiveModelId() === id) {
      this.stateStore.setActiveModelId(null);
    }
  }

  public activateModel(id: string): boolean {
    const item = this.findCatalogItem(id);
    if (!fs.existsSync(this.getCatalogModelPath(item))) return false;

    this.stateStore.setActiveModelId(id);
    return true;
  }

  public getActivatedModel(): STTModel | null {
    return this.getModelList().find((model) => model.activated) ?? null;
  }

  public getActivatedModelPath(): string | null {
    const activeModelId = this.stateStore.getActiveModelId();
    if (!activeModelId) return null;

    const item = this.catalog.find(
      (candidate) => candidate.id === activeModelId,
    );
    if (!item) return null;

    const modelPath = this.getCatalogModelPath(item);
    return fs.existsSync(modelPath) ? modelPath : null;
  }

  private findCatalogItem(id: string): STTCatalogItem {
    const item = this.catalog.find((candidate) => candidate.id === id);
    if (!item) throw new Error('找不到模型 / Model not found');
    return item;
  }

  private getCatalogModelPath(item: STTCatalogItem): string {
    const fileName = path.basename(new URL(item.downloadUrl).pathname);
    return path.join(this.modelDir, fileName);
  }

  private static createModel(
    item: STTCatalogItem,
    downloaded: boolean,
    activated: boolean,
  ): STTModel {
    return new STTModel(
      item.id,
      item.name,
      item.language,
      item.engine,
      item.format,
      item.size,
      item.downloadUrl,
      item.checksum,
      downloaded,
      activated,
    );
  }
}
