import { Routes, Route } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import { ModelManagerPage } from './pages/ModelManager/ModelManagerPage';
import { Model } from '../main/AI-module/Model';
// 现有问题说明：渲染进程不应直接导入主进程模块；该导入目前也未被使用，后续应通过 preload 暴露的 IPC API 获取数据。
import WorkspacePage from './pages/Workspace/WorkspacePage';


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
                <Route path="/AIChat" element={<PlaceholderPage title="AI Chat" />} />
                <Route path="/Workspace" element={<WorkspacePage />} />
                <Route path="/ModelManagement" element={<ModelManagerPage />} />
                <Route path="/Settings" element={<PlaceholderPage title="Settings" />} />
            </Route>
        </Routes>
    );
}
