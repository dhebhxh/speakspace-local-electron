import { ipcMain } from "electron";
import { DashboardService } from "../dashboard/DashboardService";

class DashboardIpcController {
    private service: DashboardService;

    public constructor() {
        this.service = new DashboardService();
    }

    public register(): void {
        ipcMain.handle("Dashboard:getDashboardOverview", () => {
            return this.service.getDashboardOverview();
        });
    }
}

new DashboardIpcController().register();
