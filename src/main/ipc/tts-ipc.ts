import { app, ipcMain } from 'electron';
import TTSRuntimeService from '../tts/TTSRuntimeService';
import TTSService from '../tts/TTSService';

const runtimeService = new TTSRuntimeService();
const ttsService = new TTSService(runtimeService);

ipcMain.handle('TTS:getStatus', () => runtimeService.getStatus());

// 只接受文字、音色 id 和语速；模型路径与原生模块不会暴露给 Renderer。
ipcMain.handle('TTS:synthesize', (_event, text: unknown, options: unknown) =>
  ttsService.synthesize(text, options),
);

app.on('before-quit', () => ttsService.dispose());
