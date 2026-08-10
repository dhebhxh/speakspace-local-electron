import { BrowserWindow, ipcMain } from 'electron';
import { RuntimeStatusService } from '../runtime/RuntimeStatusService';
import WhisperRuntimeInstaller from '../transcription/WhisperRuntimeInstaller';

const runtimeStatusService = new RuntimeStatusService();
const whisperRuntimeInstaller = new WhisperRuntimeInstaller();

// Renderer 只读取汇总状态，实际文件检查保留在 Electron 主进程。
ipcMain.handle('Runtime:getStatus', () => runtimeStatusService.getStatus());

ipcMain.handle('Runtime:installWhisper', () =>
  whisperRuntimeInstaller.install((progress) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('Runtime:installProgress', progress);
    });
  }),
);
