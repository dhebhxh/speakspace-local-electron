import { ipcMain } from 'electron';
import { ExportService, ExportRequest } from '../export/ExportService';

ipcMain.handle('Export:note', (_event, request: ExportRequest) => {
  if (!request || typeof request !== 'object') {
    throw new Error('Invalid export request');
  }
  if (request.format !== 'word' && request.format !== 'pdf') {
    throw new Error('Unsupported export format');
  }
  return ExportService.exportNote(request);
});
