import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function MainLayout() {
  return (
    <div className="main-layout">
      <a className="skip-link" href="#main-content">
        跳到主要内容 / Skip to content
      </a>
      <Sidebar />
      <main className="content-area" id="main-content" tabIndex="-1">
        <Outlet />
      </main>
    </div>
  );
}
