import { ipcMain } from 'electron';
import { RuntimeStatusService } from '../runtime/RuntimeStatusService';

const runtimeStatusService = new RuntimeStatusService();

// Renderer 只读取汇总状态，实际文件检查保留在 Electron 主进程。
ipcMain.handle('Runtime:getStatus', () => runtimeStatusService.getStatus());
