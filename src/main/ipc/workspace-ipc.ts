import { ipcMain, IpcMain } from 'electron';
import { WorkspaceService } from '../workspace/WorkspaceService';

/**
 * 转发接口
 * Forwarding interface
 * register()方法将注册一组IPC处理器，调用WorkspaceService.ts中已有方法
 * The register() method registers a set of IPC handlers that call existing methods in WorkspaceService.ts
 *
 * 将固定IPC名称与业务对应起来，调动WorkspaceService.ts中已有方法，避免renderer调用时未注册导致报错。
 * The fixed IPC names correspond to business logic, invoking existing methods in WorkspaceService.ts
 */
class WorkspaceIpcController {
  // read-only
  private readonly service: WorkspaceService;
  private readonly ipc: IpcMain;

  // initialize
  public constructor(service = new WorkspaceService(), ipc: IpcMain = ipcMain) {
    this.service = service;
    this.ipc = ipc;
  }

  // ipcMain.handle调用WorkspaceService.ts中已有方法
  public register(): void {
    // getlist
    this.ipc.handle('Workspace:getList', () => this.service.listWorkspaces());
    // create创建
    this.ipc.handle('Workspace:create', (_event, name: unknown) =>
      this.service.createWorkspace(name),);
    // getNotes获取笔记列表
    this.ipc.handle('Workspace:getNotes', (_event, workspaceId: unknown) =>
      this.service.listNotes(workspaceId),);
    // rename重命名
    this.ipc.handle('Workspace:rename', (_event, workspaceId: unknown, name: unknown) =>
        this.service.renameWorkspace(workspaceId, name),);
    // delete删除
    this.ipc.handle('Workspace:delete', (_event, workspaceId: unknown) =>
      this.service.deleteWorkspace(workspaceId),);
  }
}

// 导入文件时执行一次，提前register固定一组IPC处理器，避免renderer调用时未注册导致报错。
new WorkspaceIpcController().register();
