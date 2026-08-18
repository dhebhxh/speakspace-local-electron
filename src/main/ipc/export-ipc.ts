import { ipcMain } from 'electron';
import { ExportService, ExportRequest } from '../export/ExportService';

ipcMain.handle('Export:note', (_event, request: ExportRequest) =>
  ExportService.exportNote(request),
);
