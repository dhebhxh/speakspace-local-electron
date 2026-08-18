import { ipcMain } from 'electron';
import { DashboardService } from '../dashboard/DashboardService';
import { TodoExtractionService } from '../dashboard/TodoExtractionService';

class DashboardIpcController {
  private service: DashboardService;

  private extractionService: TodoExtractionService;

  public constructor() {
    this.service = new DashboardService();
    this.extractionService = new TodoExtractionService();
  }

  public register(): void {
    ipcMain.handle('Dashboard:getDashboardOverview', () => {
      return this.service.getDashboardOverview();
    });

    ipcMain.handle(
      'Dashboard:extractTodosForNote',
      async (event, noteId: number) => {
        return await this.extractionService.extractTodosForNote(noteId);
      },
    );

    ipcMain.handle(
      'Dashboard:toggleNotePin',
      async (event, noteId: number, isPinned: boolean) => {
        return await this.service.toggleNotePin(noteId, isPinned);
      },
    );
  }
}

new DashboardIpcController().register();
