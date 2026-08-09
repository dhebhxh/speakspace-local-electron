import { Routes, Route } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import { ModelManagerPage } from './pages/ModelManager/ModelManagerPage';
import AskAIPage from './pages/AskAI/AskAIPage';

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
        <Route path="/" element={<PlaceholderPage title="Transcription" />} />
        <Route path="/AIChat" element={<AskAIPage />} />
        <Route
          path="/Workspace"
          element={<PlaceholderPage title="Workspace" />}
        />
        <Route path="/ModelManagement" element={<ModelManagerPage />} />
        <Route
          path="/Settings"
          element={<PlaceholderPage title="Settings" />}
        />
      </Route>
    </Routes>
  );
}
