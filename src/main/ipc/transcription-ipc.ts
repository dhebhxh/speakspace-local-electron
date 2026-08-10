import { BrowserWindow, ipcMain } from 'electron';
import TranscriptionJobManager from '../transcription/TranscriptionJobManager';
import WhisperTranscriptionService from '../transcription/WhisperTranscriptionService';

const transcriptionService = new WhisperTranscriptionService();
const transcriptionJobManager = new TranscriptionJobManager(
  transcriptionService,
);

transcriptionJobManager.subscribe((job) => {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('Transcription:status', job);
  });
});

ipcMain.handle('Transcription:run', (_event, source: unknown) =>
  transcriptionService.transcribe(source),
);
ipcMain.handle('Transcription:start', (_event, source: unknown) =>
  transcriptionJobManager.start(source),
);
ipcMain.handle('Transcription:get', (_event, jobId: unknown) =>
  transcriptionJobManager.get(jobId),
);
ipcMain.handle('Transcription:cancel', (_event, jobId: unknown) =>
  transcriptionJobManager.cancel(jobId),
);
ipcMain.handle('Transcription:retry', (_event, jobId: unknown) =>
  transcriptionJobManager.retry(jobId),
);
