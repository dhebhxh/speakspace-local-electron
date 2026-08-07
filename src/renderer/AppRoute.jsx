import { Routes, Route } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import { ModelManagerPage } from './pages/ModelManager/ModelManagerPage';
import WorkspacePage from './pages/Workspace/WorkspacePage';

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
        {/* 工作空间作为默认首页；/Workspace 保留给旧书签。 / Workspace is the home page; keep /Workspace for old bookmarks. */}
        <Route path="/" element={<WorkspacePage />} />
        <Route
          path="/Transcription"
          element={<PlaceholderPage title="Transcription" />}
        />
        <Route path="/AIChat" element={<PlaceholderPage title="AI Chat" />} />
        <Route path="/Workspace" element={<WorkspacePage />} />
        <Route path="/ModelManagement" element={<ModelManagerPage />} />
        <Route
          path="/Settings"
          element={<PlaceholderPage title="Settings" />}
        />
      </Route>
    </Routes>
  );
}
