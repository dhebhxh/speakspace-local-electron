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


export default function AppRoute() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/* é¦–é??¹ç‚ºå¯¦æ?è½‰é? (StudioPage) */}
        <Route path="/" element={<StudioPage />} />
        
        {/* ?¸å®¹?Ÿæœ¬??/Transcriptionï¼Œè‹¥?‰äººè·³è??Žä?å°±æ­£å¸¸é¡¯ç¤?*/}
        <Route path="/Transcription" element={<StudioPage />} />

        {/* ?¸å®¹?Šç? /AIChat è·¯ç”± */}
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
