import fs from 'fs';
import path from 'path';

type ActiveModelState = {
  activeModelId: string | null;
};

/** 在 userData 中保存某一类模型的当前激活 ID。 */
export default class ActiveModelStateStore {
  private readonly statePath: string;

  public constructor(statePath: string) {
    this.statePath = statePath;
  }

  public getActiveModelId(): string | null {
    try {
      const state = JSON.parse(
        fs.readFileSync(this.statePath, 'utf8'),
      ) as Partial<ActiveModelState>;
      return typeof state.activeModelId === 'string'
        ? state.activeModelId
        : null;
    } catch {
      return null;
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
