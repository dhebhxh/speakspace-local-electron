import { HashRouter } from 'react-router-dom';
import './App.css';
import './settings/AppSettings.css';
import AppRoute from './AppRoute';
import { AppSettingsProvider } from './settings/AppSettingsProvider';
import OnboardingGuide from './onboarding/OnboardingGuide';
import AmbientBackground from './components/AmbientBackground';

export default function App() {
  return (
    <AppSettingsProvider>
      {/* 环境光铺在最底层，外壳（.main-layout）压在它上面 */}
      <AmbientBackground />
      <HashRouter>
        <AppRoute />
        <OnboardingGuide />
      </HashRouter>
    </AppSettingsProvider>
  );
}
