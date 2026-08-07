import { ipcMain, IpcMain } from 'electron';
import { WorkspaceService } from '../workspace/WorkspaceService';

/**
 * 工作空间 IPC 控制器：只负责连接 Electron channel 与业务服务。
 * Workspace IPC controller: connects Electron channels to the service layer.
 *
 * 将注册集中在类中可以避免页面或 main.ts 散落数据库逻辑。
 * Keeping registration in one class prevents database logic from leaking into views or main.ts.
 */
class WorkspaceIpcController {
  private readonly service: WorkspaceService;

  private readonly ipc: IpcMain;

  public constructor(service = new WorkspaceService(), ipc: IpcMain = ipcMain) {
    this.service = service;
    this.ipc = ipc;
  }

  public register(): void {
    this.ipc.handle('Workspace:getList', () => this.service.listWorkspaces());
    this.ipc.handle('Workspace:create', (_event, name: unknown) =>
      this.service.createWorkspace(name),
    );
    this.ipc.handle('Workspace:getNotes', (_event, workspaceId: unknown) =>
      this.service.listNotes(workspaceId),
    );
    this.ipc.handle(
      'Workspace:rename',
      (_event, workspaceId: unknown, name: unknown) =>
        this.service.renameWorkspace(workspaceId, name),
    );
    this.ipc.handle('Workspace:delete', (_event, workspaceId: unknown) =>
      this.service.deleteWorkspace(workspaceId),
    );
  }
}

// 主进程加载本文件时注册一次 / Register once when the main process imports this file.
new WorkspaceIpcController().register();
