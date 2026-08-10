import fs from 'fs';
import path from 'path';
import { ManagedPaths } from '../runtime/ManagedPaths';

// 保留命名导出，与现有 WorkspaceService 的导入方式一致。
// eslint-disable-next-line import/prefer-default-export
export class BlobStorage {
  // 类内部的单例类型属于正常自引用，不是运行时的提前访问。
  // eslint-disable-next-line no-use-before-define
  private static instance: BlobStorage | null = null;

  private blobRootPath: string;

  private constructor() {
    this.blobRootPath = ManagedPaths.getInstance().getBlobRoot();
  }

  public static getInstance(): BlobStorage {
    if (BlobStorage.instance === null) {
      BlobStorage.instance = new BlobStorage();
    }

    return BlobStorage.instance;
  }

  public async save(relativePath: string, data: Blob): Promise<void> {
    const absolutePath = this.resolveAbsolutePath(relativePath);

    const directory = path.dirname(absolutePath);

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, {
        recursive: true,
      });
    }

    const buffer = Buffer.from(await data.arrayBuffer());

    fs.writeFileSync(absolutePath, buffer);
  }

  public load(relativePath: string): Blob {
    const absolutePath = this.resolveAbsolutePath(relativePath);

    const buffer = fs.readFileSync(absolutePath);

    return new Blob([new Uint8Array(buffer)]);
  }

  public delete(relativePath: string): void {
    const absolutePath = this.resolveAbsolutePath(relativePath);

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  }

  public exists(relativePath: string): boolean {
    const absolutePath = this.resolveAbsolutePath(relativePath);

    return fs.existsSync(absolutePath);
  }

  public resolveAbsolutePath(relativePath: string): string {
    return path.join(this.blobRootPath, relativePath);
  }
}
