import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import { ModelManagerPage } from './pages/ModelManager/ModelManagerPage';
import WorkspacePage from './pages/Workspace/WorkspacePage';
import WorkspaceHomePage from './pages/Workspace/WorkspaceHomePage';
import SettingsPage from './pages/Settings/SettingsPage';
import StudioPage from './pages/Studio/StudioPage';
import WorkflowPage from './pages/Workflow/WorkflowPage';
import AgentPage from './pages/Agent/AgentPage';

export default function AppRoute() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/* 首页只显示最近入口；Workspace 详情使用独立路由。 */}
        <Route
          path="/"
          element={<WorkspaceHomePage directory={false} limit={6} />}
        />
        {/* 对话工作台：AI 对话为主，深度整合录音/转录/保存。 */}
        <Route path="/Transcription" element={<StudioPage />} />
        {/* 旧的独立 AI 对话路由重定向到工作台，兼容书签/引导。 */}
        <Route path="/AIChat" element={<Navigate to="/Transcription" replace />} />
        <Route path="/Agent" element={<AgentPage />} />
        <Route
          path="/Workspace"
          element={<WorkspaceHomePage directory limit={100} />}
        />
        <Route path="/Workspace/:workspaceId" element={<WorkspacePage />} />
        <Route path="/Workflow" element={<WorkflowPage />} />
        <Route path="/ModelManagement" element={<ModelManagerPage />} />
        <Route path="/Settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
