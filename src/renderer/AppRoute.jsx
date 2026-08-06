import { Routes, Route } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import { ModelManagerPage } from './pages/ModelManager/ModelManagerPage';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { RoutePath } from './router/RouteManager';

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
                <Route path={RoutePath.Transcription} element={<PlaceholderPage title="Transcription" />} />
                <Route path={RoutePath.AIChat} element={<PlaceholderPage title="AI Chat" />} />
                <Route path={RoutePath.Workspace} element={<PlaceholderPage title="Workspace" />} />
                <Route path={RoutePath.ModelManagement} element={<ModelManagerPage />} />
                <Route path={RoutePath.Dashboard} element={<DashboardPage />} />
                <Route path={RoutePath.Settings} element={<PlaceholderPage title="Settings" />} />
            </Route>
        </Routes>
    );
}
