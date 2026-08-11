import { app } from 'electron';
import os from 'os';
import { SystemProfile } from './ModelRecommendationTypes';

type BasicGpuInfo = {
  gpuDevice?: Array<{ deviceString?: string }>;
};

/** 仅采集推荐需要的硬件摘要，不读取用户文件或网络信息。 */
export default class SystemProfileService {
  public static async detect(): Promise<SystemProfile> {
    const totalMemoryGb = os.totalmem() / 1024 ** 3;
    const availableMemoryGb = os.freemem() / 1024 ** 3;
    const logicalCores = os.cpus().length;
    let gpuName: string | null = null;

    try {
      const gpuInfo = (await app.getGPUInfo('basic')) as BasicGpuInfo;
      gpuName = gpuInfo.gpuDevice?.[0]?.deviceString?.trim() || null;
    } catch {
      // Virtual or remote sessions may not expose GPU details.
    }

    let level: SystemProfile['level'] = '入门';
    if (totalMemoryGb >= 24 && logicalCores >= 12) level = '高性能';
    else if (totalMemoryGb >= 12 && logicalCores >= 6) level = '均衡';

    return {
      cpuModel: os.cpus()[0]?.model?.trim() || 'Unknown CPU',
      logicalCores,
      totalMemoryGb: Number(totalMemoryGb.toFixed(1)),
      availableMemoryGb: Number(availableMemoryGb.toFixed(1)),
      gpuName,
      level,
    };
  }
}
