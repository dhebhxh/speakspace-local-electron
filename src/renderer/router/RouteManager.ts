import { NavigateFunction } from "react-router-dom";

export enum RoutePath {
    Transcription = "/",
    AIChat = "/AIChat",
    Workspace = "/Workspace",
    ModelManagement = "/ModelManagement",
    Dashboard = "/DashBoard",
    Settings = "/Settings"
}

/**
 * RouteManager provides an OOP service layer over React Router navigation,
 * eliminating repeated route string literals and centralizing page transition behavior (DRY principle).
 */
export class RouteManager {
    private navigator: NavigateFunction;

    public constructor(navigator: NavigateFunction) {
        this.navigator = navigator;
    }

    public navigateTo(path: RoutePath): void {
        this.navigator(path);
    }

    public navigateToSettings(): void {
        this.navigator(RoutePath.Settings);
    }

    public navigateToDashboard(): void {
        this.navigator(RoutePath.Dashboard);
    }

    public navigateToTranscription(): void {
        this.navigator(RoutePath.Transcription);
    }
}
