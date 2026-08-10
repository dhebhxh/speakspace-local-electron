import fs from 'fs';
import path from 'path';

type STTModelState = {
  activeModelId: string | null;
};

const DEFAULT_STATE: STTModelState = { activeModelId: null };

/** 激活状态保存在 userData，模型目录和应用升级不会覆盖它。 */
export default class STTModelStateStore {
  private readonly statePath: string;

  public constructor(statePath: string) {
    this.statePath = statePath;
  }

  public getActiveModelId(): string | null {
    try {
      const state = JSON.parse(
        fs.readFileSync(this.statePath, 'utf8'),
      ) as Partial<STTModelState>;
      return typeof state.activeModelId === 'string'
        ? state.activeModelId
        : null;
    } catch {
      return DEFAULT_STATE.activeModelId;
    }
  }

  public setActiveModelId(activeModelId: string | null): void {
    fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
    fs.writeFileSync(
      this.statePath,
      `${JSON.stringify({ activeModelId }, null, 2)}\n`,
      'utf8',
    );
  }
}
