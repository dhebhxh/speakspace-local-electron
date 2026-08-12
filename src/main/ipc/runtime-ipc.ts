import { BrowserWindow, ipcMain } from 'electron';
import { RuntimeStatusService } from '../runtime/RuntimeStatusService';
import WhisperRuntimeInstaller from '../transcription/WhisperRuntimeInstaller';
import OllamaRuntimeInstaller from '../llm/OllamaRuntimeInstaller';
import TTSRuntimeInstaller from '../tts/TTSRuntimeInstaller';
import FfmpegInstaller from '../runtime/FfmpegInstaller';

const runtimeStatusService = new RuntimeStatusService();
const whisperRuntimeInstaller = new WhisperRuntimeInstaller();
const ollamaRuntimeInstaller = new OllamaRuntimeInstaller();
const ttsRuntimeInstaller = new TTSRuntimeInstaller();
const ffmpegInstaller = new FfmpegInstaller();

// Renderer 只读取汇总状态，实际文件检查保留在 Electron 主进程。
ipcMain.handle('Runtime:getStatus', () => runtimeStatusService.getStatus());

ipcMain.handle('Runtime:installWhisper', () =>
  whisperRuntimeInstaller.install((progress) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('Runtime:installProgress', progress);
    });
  }),
);

ipcMain.handle('Runtime:installOllama', () =>
  ollamaRuntimeInstaller.install((progress) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('Runtime:installOllamaProgress', progress);
    });
  }),
);

ipcMain.handle('Runtime:installTTS', () =>
  ttsRuntimeInstaller.install((progress) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('Runtime:installTTSProgress', progress);
    });
  }),
);

ipcMain.handle('Runtime:installFfmpeg', () =>
  ffmpegInstaller.install((progress) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('Runtime:installFfmpegProgress', progress);
    });
  }),
);
