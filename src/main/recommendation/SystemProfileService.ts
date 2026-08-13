import fs from 'fs/promises';
import os from 'os';
import { ManagedPaths } from '../runtime/ManagedPaths';
import GpuProbeService from './GpuProbeService';
import { StorageProfile, SystemProfile } from './ModelRecommendationTypes';

/** 仅采集推荐需要的硬件摘要，不读取用户文件或网络信息。 */
export default class SystemProfileService {
  public static async detect(): Promise<SystemProfile> {
    const totalMemoryGb = os.totalmem() / 1024 ** 3;
    const availableMemoryGb = os.freemem() / 1024 ** 3;
    const logicalCores = os.cpus().length;
    const gpu = await new GpuProbeService().probe();
    // 主显卡取第一块非虚拟设备，虚拟显示适配器不参与推荐判断。
    const primaryGpu = gpu.gpus.find((device) => !device.virtual) ?? null;

    let level: SystemProfile['level'] = '入门';
    if (totalMemoryGb >= 24 && logicalCores >= 12) level = '高性能';
    else if (totalMemoryGb >= 12 && logicalCores >= 6) level = '均衡';

    return {
      cpuModel: os.cpus()[0]?.model?.trim() || 'Unknown CPU',
      logicalCores,
      totalMemoryGb: Number(totalMemoryGb.toFixed(1)),
      availableMemoryGb: Number(availableMemoryGb.toFixed(1)),
      gpuName: primaryGpu?.name ?? null,
      gpus: gpu.gpus,
      cuda: gpu.cuda,
      storage: await SystemProfileService.detectStorage(),
      platform: os.platform(),
      arch: os.arch(),
      level,
    };
  }

  /** 只统计模型和运行时所在的分区，用户其他磁盘不做扫描。 */
  private static async detectStorage(): Promise<StorageProfile | null> {
    const root = ManagedPaths.getInstance().getDataRoot();

    try {
      const stats = await fs.statfs(root);
      const blockSize = Number(stats.bsize);
      const toGb = (blocks: number | bigint) =>
        Number(((Number(blocks) * blockSize) / 1024 ** 3).toFixed(1));

      return {
        root,
        totalGb: toGb(stats.blocks),
        freeGb: toGb(stats.bavail),
      };
    } catch {
      // 部分虚拟盘或网络盘不支持 statfs，缺容量信息时不影响其他硬件展示。
      return null;
    }
  }
}
