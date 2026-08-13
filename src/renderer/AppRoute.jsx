import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import { ModelManagerPage } from './pages/ModelManager/ModelManagerPage';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import WorkspacePage from './pages/Workspace/WorkspacePage';
import WorkspaceHomePage from './pages/Workspace/WorkspaceHomePage';
import SettingsPage from './pages/Settings/SettingsPage';
import StudioPage from './pages/Studio/StudioPage';
import WorkflowPage from './pages/Workflow/WorkflowPage';
import AgentPage from './pages/Agent/AgentPage';
import { RoutePath } from './router/RouteManager';
import './SystemPolish.css';

export default function AppRoute() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/* 首頁改為實時轉錄 (StudioPage) */}
        <Route path="/" element={<StudioPage />} />

        {/* 相容原本的 /Transcription，若有人跳轉過來就正常顯示 */}
        <Route path="/Transcription" element={<StudioPage />} />

        {/* 相容舊版 /AIChat 路由 */}
        <Route path="/AIChat" element={<Navigate to="/" replace />} />

        <Route path="/Agent" element={<AgentPage />} />

        <Route
          path="/Workspace"
          element={<WorkspaceHomePage directory limit={100} />}
        />
        <Route path="/Workspace/:workspaceId" element={<WorkspacePage />} />
        <Route path="/Workflow" element={<WorkflowPage />} />
        <Route path="/ModelManagement" element={<ModelManagerPage />} />
        <Route path="/Settings" element={<SettingsPage />} />
        <Route path={RoutePath.Dashboard} element={<DashboardPage />} />
      </Route>
    </Routes>
  );
}
