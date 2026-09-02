import { createRoot } from 'react-dom/client';
import App from './App';
import migrateLegacyLocalStorage from './storage/LocalStorageMigration';
import '../i18n';

// 必须在任何组件读取 localStorage 之前跑：改名后键前缀变了。
migrateLegacyLocalStorage();

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<App />);

// calling IPC exposed from preload script
window.electron?.ipcRenderer.once('ipc-example', (arg) => {
  // eslint-disable-next-line no-console
  console.log(arg);
});
window.electron?.ipcRenderer.sendMessage('ipc-example', ['ping']);
