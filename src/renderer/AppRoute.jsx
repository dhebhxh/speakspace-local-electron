import { Routes, Route } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import { ModelManagerPage } from './pages/ModelManager/ModelManagerPage';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import WorkspacePage from './pages/Workspace/WorkspacePage';
import WorkspaceHomePage from './pages/Workspace/WorkspaceHomePage';
import SettingsPage from './pages/Settings/SettingsPage';
import RecordingPage from './pages/Recording/RecordingPage';
import AskAIPage from './pages/AskAI/AskAIPage';
import WorkflowPage from './pages/Workflow/WorkflowPage';
import AgentPage from './pages/Agent/AgentPage';
import { RoutePath } from './router/RouteManager';

export default function AppRoute() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/* 首页只显示最近入口；Workspace 详情使用独立路由。 */}
        <Route
          path="/"
          element={<WorkspaceHomePage directory={false} limit={6} />}
        />
        <Route path="/Transcription" element={<RecordingPage />} />
        <Route path="/AIChat" element={<AskAIPage />} />
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
