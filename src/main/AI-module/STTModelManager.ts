import fs from 'fs';
import path from 'path';
import { app } from 'electron';

import { STTModel } from './STTModel';
import { ModelManager } from './ModelManager';

type STTConfig = {
  stt: {
    id: string;
    name: string;
    language: string;
    engine: string;
    format: string;
    size: string;
    downloadUrl: string;
    checksum: string | null;
    downloaded: boolean;
    activated: boolean;
  }[];
};

// 保留命名导出，与现有 IPC 和录音模块导入方式一致。
// eslint-disable-next-line import/prefer-default-export
export class STTModelManager implements ModelManager {
  private configPath: string;

  private modelDir: string;

  constructor() {
    const projectRoot = app.getAppPath();

    const userDataPath = app.getPath('userData');

    this.configPath = path.join(projectRoot, 'config', 'stt-catalog.json');

    this.modelDir = path.join(userDataPath, 'models', 'stt');

    if (!fs.existsSync(this.modelDir)) {
      fs.mkdirSync(this.modelDir, {
        recursive: true,
      });
    }
  }

  getModelList(): STTModel[] {
    const config = this.loadConfig();

    const modelList = [];

    for (let i = 0; i < config.stt.length; i += 1) {
      const model = config.stt[i];

      modelList.push(
        new STTModel(
          model.id,
          model.name,
          model.language,
          model.engine,
          model.format,
          model.size,
          model.downloadUrl,
          model.checksum,
          model.downloaded,
          model.activated,
        ),
      );
    }

    return modelList;
  }

  async downloadModel(id: string): Promise<void> {
    const config = this.loadConfig();

    const model = config.stt.find((modelItem) => modelItem.id === id);

    if (!model) {
      throw new Error('Model not found.');
    }

    if (model.downloaded) {
      throw new Error('Model has already been downloaded.');
    }

    const fileName = path.basename(model.downloadUrl);

    const savePath = path.join(this.modelDir, fileName);

    const response = await fetch(model.downloadUrl);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();

    await fs.promises.writeFile(savePath, Buffer.from(buffer));

    model.downloaded = true;
    this.saveConfig(config);
  }

  async deleteModel(id: string): Promise<void> {
    const config = this.loadConfig();

    const model = config.stt.find((modelItem) => modelItem.id === id);

    if (!model) {
      throw new Error('Model not found.');
    }

    if (!model.downloaded) {
      throw new Error('Model has not been downloaded.');
    }

    const fileName = path.basename(model.downloadUrl);

    const filePath = path.join(this.modelDir, fileName);

    await fs.promises.unlink(filePath);

    model.downloaded = false;
    model.activated = false;

    this.saveConfig(config);
  }

  activateModel(id: string): boolean {
    const config = this.loadConfig();

    const model = config.stt.find((modelItem: STTModel) => modelItem.id === id);

    if (!model) {
      return false;
    }

    if (!model.downloaded) {
      return false;
    }

    // 必须修改同一份 config，确保选择新模型时旧模型同步取消激活。
    config.stt.forEach((modelItem) => {
      modelItem.activated = modelItem.id === id;
    });
    this.saveConfig(config);
    return true;
  }

  getActivatedModel(): STTModel | null {
    const config = this.loadConfig();

    const model = config.stt.find((modelItem) => modelItem.activated);

    if (!model) {
      return null;
    }

    return model;
  }

  private loadConfig(): STTConfig {
    const json = fs.readFileSync(this.configPath, 'utf-8');
    return JSON.parse(json);
  }

  private saveConfig(config: STTConfig): void {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 4), 'utf-8');
  }
}
