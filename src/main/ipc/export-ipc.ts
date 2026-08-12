import { ipcMain } from 'electron';
import { ExportService, ExportRequest } from '../export/ExportService';

const exportService = new ExportService();

ipcMain.handle('Export:note', (_event, request: ExportRequest) =>
  exportService.exportNote(request)
);
