import { Routes, Route } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import { ModelManagerPage } from './pages/ModelManager/ModelManagerPage';
import WorkspacePage from './pages/Workspace/WorkspacePage';
import WorkspaceHomePage from './pages/Workspace/WorkspaceHomePage';
import SettingsPage from './pages/Settings/SettingsPage';

// 这是临时占位页；真实功能页接入后可删除。 / Temporary placeholder until each feature page is connected.
// eslint-disable-next-line react/prop-types
function PlaceholderPage({ title }) {
  return (
    <section>
      <h1>{title}</h1>
    </section>
  );
}

export default function AppRoute() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/* 首页只显示最近入口；Workspace 详情使用独立路由。 */}
        <Route
          path="/"
          element={<WorkspaceHomePage directory={false} limit={6} />}
        />
        <Route
          path="/Transcription"
          element={<PlaceholderPage title="Transcription" />}
        />
        <Route path="/AIChat" element={<PlaceholderPage title="AI Chat" />} />
        <Route
          path="/Workspace"
          element={<WorkspaceHomePage directory limit={100} />}
        />
        <Route path="/Workspace/:workspaceId" element={<WorkspacePage />} />
        <Route path="/ModelManagement" element={<ModelManagerPage />} />
        <Route path="/Settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
