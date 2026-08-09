import { HashRouter } from 'react-router-dom';
import './App.css';
import './settings/AppSettings.css';
import AppRoute from './AppRoute';
import { AppSettingsProvider } from './settings/AppSettingsProvider';
import OnboardingGuide from './onboarding/OnboardingGuide';

export default function App() {
  return (
    <AppSettingsProvider>
      <HashRouter>
        <AppRoute />
        <OnboardingGuide />
      </HashRouter>
    </AppSettingsProvider>
  );
}
