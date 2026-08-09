import { HashRouter } from 'react-router-dom';
import './App.css';
import './settings/AppSettings.css';
import AppRoute from './AppRoute';
import { AppSettingsProvider } from './settings/AppSettingsProvider';

export default function App() {
  return (
    <AppSettingsProvider>
      <HashRouter>
        <AppRoute />
      </HashRouter>
    </AppSettingsProvider>
  );
}
