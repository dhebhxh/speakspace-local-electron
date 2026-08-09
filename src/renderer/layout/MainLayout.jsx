import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function MainLayout() {
  return (
    <div className="main-layout">
      <Sidebar />
      <main className="content-area">
        <Outlet />
      </main>
    </div>
  );
}
