import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import ollama from 'ollama';

import { ModelManager } from './ModelManager';
import { LLMModel } from './LLMModel';

type LLMConfig = {
  llm: {
    id: string;
    name: string;
    language: string;
    engine: string;
    format: string;
    quantization: string | null;
    size: string;
    modelName: string;
    downloaded: boolean;
    activated: boolean;
  }[];
};

// 保留命名导出，与现有 IPC 和 AI 模块导入方式一致。
// eslint-disable-next-line import/prefer-default-export
export class LLMModelManager implements ModelManager {
  private configPath: string;

  constructor() {
    const projectRoot = app.getAppPath();

    this.configPath = path.join(projectRoot, 'config', 'llm-catalog.json');
  }

  getModelList(): LLMModel[] {
    const config = this.loadConfig();

    const modelList = [];

    for (let i = 0; i < config.llm.length; i += 1) {
      const model = config.llm[i];

      modelList.push(
        new LLMModel(
          model.id,
          model.name,
          model.language,
          model.engine,
          model.format,
          model.quantization,
          model.size,
          model.modelName,
          model.downloaded,
          model.activated,
        ),
      );
    }

    return modelList;
  }

  async downloadModel(id: string): Promise<void> {
    const config = this.loadConfig();

    const model = config.llm.find((modelItem: LLMModel) => modelItem.id === id);

    if (!model) {
      throw new Error('Model not found.');
    }

    if (model.downloaded) {
      throw new Error('Model has already been downloaded.');
    }

    await ollama.pull({ model: model.modelName });

    model.downloaded = true;
    this.saveConfig(config);
  }

  async deleteModel(id: string): Promise<void> {
    const config = this.loadConfig();

    const model = config.llm.find((modelItem: LLMModel) => modelItem.id === id);

    if (!model) {
      throw new Error('Model not found.');
    }

    if (!model.downloaded) {
      throw new Error('Model has not been downloaded.');
    }

    await ollama.delete({ model: model.modelName });

    model.downloaded = false;
    model.activated = false;

    this.saveConfig(config);
  }

  activateModel(id: string): boolean {
    const config = this.loadConfig();

    const model = config.llm.find((modelItem: LLMModel) => modelItem.id === id);

    if (!model) {
      return false;
    }

    if (!model.downloaded) {
      return false;
    }

    // 必须修改同一份 config，确保选择新模型时旧模型同步取消激活。
    config.llm.forEach((modelItem) => {
      modelItem.activated = modelItem.id === id;
    });
    this.saveConfig(config);
    return true;
  }

  getActivatedModel(): LLMModel | null {
    const config = this.loadConfig();
    const model = config.llm.find((modelItem) => modelItem.activated);

    if (!model) {
      return null;
    }
    return model;
  }

  private loadConfig(): LLMConfig {
    const json = fs.readFileSync(this.configPath, 'utf-8');
    return JSON.parse(json);
  }

  private saveConfig(config: LLMConfig): void {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 4), 'utf-8');
  }
}
