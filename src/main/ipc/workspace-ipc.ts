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

  // IPC 通道只转发请求，最近打开与内容修改规则由 WorkspaceService 处理。
  public register(): void {
    this.ipc.handle('Workspace:getList', (_event, limit: unknown) =>
      this.service.listWorkspaces(limit),
    );
    this.ipc.handle('Workspace:create', (_event, name: unknown) =>
      this.service.createWorkspace(name),
    );
    this.ipc.handle('Workspace:open', (_event, workspaceId: unknown) =>
      this.service.openWorkspace(workspaceId),
    );
    this.ipc.handle('Workspace:getNotes', (_event, workspaceId: unknown) =>
      this.service.listNotes(workspaceId),
    );
    this.ipc.handle(
      'Workspace:getNoteAudio',
      (_event, workspaceId: unknown, noteId: unknown) =>
        this.service.getNoteAudio(workspaceId, noteId),
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

// 导入文件时执行一次，提前register固定一组IPC处理器，避免renderer调用时未注册导致报错。
new WorkspaceIpcController().register();
