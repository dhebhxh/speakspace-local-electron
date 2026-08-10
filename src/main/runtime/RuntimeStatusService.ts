import fs from 'fs';
import path from 'path';
import { ManagedPaths, RuntimeKind, RuntimeStoragePaths } from './ManagedPaths';
import WhisperRuntimeService, {
  WhisperRuntimeStatus,
} from '../transcription/WhisperRuntimeService';

export type ManagedRuntimeState = 'missing' | 'partial' | 'ready';

export type RuntimeComponentStatus = {
  kind: RuntimeKind;
  managedState: ManagedRuntimeState;
  runtimePresent: boolean;
  manifestPresent: boolean;
  installedModelCount: number;
};

export type RuntimeStatusSummary = {
  storageRoot: string;
  components: RuntimeComponentStatus[];
  transcription: WhisperRuntimeStatus;
};

/**
 * 汇总应用自己管理的运行时和模型状态。
 * 此服务只读文件系统，不会在状态查询时创建、下载或删除文件。
 */
export class RuntimeStatusService {
  private readonly managedPaths: ManagedPaths;

  private readonly whisperRuntime: WhisperRuntimeService;

  public constructor(
    managedPaths = ManagedPaths.getInstance(),
    whisperRuntime = new WhisperRuntimeService(managedPaths),
  ) {
    this.managedPaths = managedPaths;
    this.whisperRuntime = whisperRuntime;
  }

  public getStatus(): RuntimeStatusSummary {
    const kinds: RuntimeKind[] = ['stt', 'llm', 'tts'];

    return {
      storageRoot: this.managedPaths.getDataRoot(),
      components: kinds.map((kind) => this.getComponentStatus(kind)),
      transcription: this.whisperRuntime.getStatus(),
    };
  }

  private getComponentStatus(kind: RuntimeKind): RuntimeComponentStatus {
    const runtimePaths = this.managedPaths.getRuntimePaths(kind);
    const runtimeEntries = RuntimeStatusService.readDirectory(
      runtimePaths.runtimeRoot,
    ).filter(
      (entryName) =>
        path.join(runtimePaths.runtimeRoot, entryName) !==
        runtimePaths.manifestPath,
    );
    const installedModelCount = RuntimeStatusService.countModels(runtimePaths);
    const runtimePresent = runtimeEntries.length > 0;
    const manifestPresent = fs.existsSync(runtimePaths.manifestPath);

    let managedState: ManagedRuntimeState = 'missing';
    if (runtimePresent && installedModelCount > 0) {
      managedState = 'ready';
    } else if (runtimePresent || manifestPresent || installedModelCount > 0) {
      managedState = 'partial';
    }

    return {
      kind,
      managedState,
      runtimePresent,
      manifestPresent,
      installedModelCount,
    };
  }

  private static countModels(runtimePaths: RuntimeStoragePaths): number {
    return RuntimeStatusService.readDirectory(runtimePaths.modelsRoot).length;
  }

  private static readDirectory(directory: string): string[] {
    try {
      return fs.readdirSync(directory);
    } catch {
      // 目录未创建或暂时不可读都按空目录处理，避免阻止设置页面加载。
      return [];
    }
  }
}
