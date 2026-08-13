import fs from 'fs';
import os from 'os';
import path from 'path';
import TTSModelManager from '../../AI-module/TTSModelManager';
import ActiveModelStateStore from '../../AI-module/ActiveModelStateStore';
import { ManagedPaths } from '../../runtime/ManagedPaths';
import {
  getTTSModelCatalogItem,
  KOKORO_TTS_MODEL_ID,
  MELO_TTS_MODEL_ID,
} from '../TTSModelCatalog';

function createRequiredFiles(root: string, modelId: string): void {
  const item = getTTSModelCatalogItem(modelId);
  item.requiredFiles.forEach((relativePath) => {
    const target = path.join(root, 'models', 'tts', modelId, relativePath);
    if (path.extname(relativePath)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, 'test');
    } else {
      fs.mkdirSync(target, { recursive: true });
    }
  });
}

describe('TTSModelManager', () => {
  let root: string;
  let manager: TTSModelManager;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'speakspace-tts-manager-'));
    createRequiredFiles(root, KOKORO_TTS_MODEL_ID);
    createRequiredFiles(root, MELO_TTS_MODEL_ID);
    manager = new TTSModelManager({
      managedPaths: new ManagedPaths(root),
      stateStore: new ActiveModelStateStore(
        path.join(root, 'model-state', 'tts.json'),
      ),
    });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('does not auto-activate downloaded models and persists explicit activation', () => {
    expect(manager.getActivatedModel()).toBeNull();
    expect(manager.activateModel(KOKORO_TTS_MODEL_ID)).toBe(true);

    const reloaded = new TTSModelManager({
      managedPaths: new ManagedPaths(root),
    });
    expect(reloaded.getActivatedModel()?.id).toBe(KOKORO_TTS_MODEL_ID);
  });

  it('refuses to delete the active model, then deletes it after switching', async () => {
    manager.activateModel(KOKORO_TTS_MODEL_ID);
    await expect(manager.deleteModel(KOKORO_TTS_MODEL_ID)).rejects.toThrow(
      '正在使用',
    );
    expect(manager.activateModel(MELO_TTS_MODEL_ID)).toBe(true);
    await manager.deleteModel(KOKORO_TTS_MODEL_ID);
    expect(
      manager.getModelList().find((model) => model.id === KOKORO_TTS_MODEL_ID)
        ?.downloaded,
    ).toBe(false);
  });
});
