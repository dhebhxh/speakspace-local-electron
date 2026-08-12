import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import i18n from '../../i18n';
import { AppSettings, SettingsController } from './SettingsController';

type SettingsContextValue = {
  settings: AppSettings;
  resolvedTheme: 'light' | 'dark';
  loading: boolean;
  loadError: string;
  updateSettings(nextSettings: AppSettings): Promise<void>;
};

const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 'medium',
  theme: 'system',
  language: 'zh',
};

const SettingsContext = createContext<SettingsContextValue | null>(null);
const settingsController = new SettingsController();

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const mediaQuery = useMemo(
    () => window.matchMedia('(prefers-color-scheme: dark)'),
    [],
  );
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [systemUsesDarkTheme, setSystemUsesDarkTheme] = useState(
    mediaQuery.matches,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      setSystemUsesDarkTheme(event.matches);
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () =>
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [mediaQuery]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setSettings(await settingsController.getSettings());
      } catch (reason) {
        setLoadError(
          reason instanceof Error ? reason.message : '读取应用设置失败',
        );
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const resolvedTheme = SettingsController.resolveTheme(
    settings.theme,
    systemUsesDarkTheme,
  );

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.fontSize = settings.fontSize;
    root.dataset.theme = resolvedTheme;
    root.dataset.themePreference = settings.theme;
  }, [resolvedTheme, settings.fontSize, settings.theme]);

  // 语言设置变化时同步 i18next，并反映到 <html lang> 便于无障碍与样式。
  useEffect(() => {
    if (i18n.language !== settings.language) {
      i18n.changeLanguage(settings.language);
    }
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  const contextValue = useMemo<SettingsContextValue>(
    () => ({
      settings,
      resolvedTheme,
      loading,
      loadError,
      async updateSettings(nextSettings: AppSettings) {
        const savedSettings =
          await settingsController.updateSettings(nextSettings);
        setSettings(savedSettings);
        setLoadError('');
      },
    }),
    [loadError, loading, resolvedTheme, settings],
  );

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useAppSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used inside AppSettingsProvider');
  }
  return context;
}
