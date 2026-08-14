import { NavigateFunction, NavigateOptions } from "react-router-dom";

export enum RoutePath {
    Transcription = "/Transcription",
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

    public navigateTo(path: RoutePath, options?: NavigateOptions): void {
        this.navigator(path, options);
    }

    public navigateToSettings(options?: NavigateOptions): void {
        this.navigator(RoutePath.Settings, options);
    }

    public navigateToDashboard(options?: NavigateOptions): void {
        this.navigator(RoutePath.Dashboard, options);
    }

    public navigateToTranscription(options?: NavigateOptions): void {
        this.navigator(RoutePath.Transcription, options);
    }
}
