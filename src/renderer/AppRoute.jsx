import { Routes, Route } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import ModelManagerPage from './pages/ModelManager/ModelManagerPage';
import AskAIPage from './pages/AskAI/AskAIPage';
import RecordingPage from './pages/Recording/RecordingPage';
import WorkflowPage from './pages/Workflow/WorkflowPage';

function SettingsPage() {
  return (
    <section>
      <h1>Settings</h1>
    </section>
  );
}

export default function AppRoute() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<RecordingPage />} />
        <Route path="/AIChat" element={<AskAIPage />} />
        <Route path="/Workspace" element={<WorkflowPage />} />
        <Route path="/ModelManagement" element={<ModelManagerPage />} />
        <Route path="/Settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
