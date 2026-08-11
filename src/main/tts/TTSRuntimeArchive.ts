import fs from 'fs/promises';
import path from 'path';

/** 定位模型根目录并完整复制字典、词典与 ONNX 文件。 */
export default class TTSRuntimeArchive {
  public static async findModelRoot(root: string): Promise<string | null> {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const names = new Set(entries.map((entry) => entry.name));
    if (
      names.has('model.onnx') &&
      names.has('voices.bin') &&
      names.has('tokens.txt') &&
      names.has('espeak-ng-data')
    ) {
      return root;
    }

    const nested = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) =>
          TTSRuntimeArchive.findModelRoot(path.join(root, entry.name)),
        ),
    );
    return nested.find((result) => result !== null) ?? null;
  }

  public static async copyModel(
    source: string,
    destination: string,
  ): Promise<void> {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.cp(source, destination, { recursive: true });
  }
}
