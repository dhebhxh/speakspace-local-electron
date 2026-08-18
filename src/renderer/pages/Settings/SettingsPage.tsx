import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../../settings/SettingsController';
import { useAppSettings } from '../../settings/AppSettingsProvider';
import AgentSettingsPanel from './components/AgentSettingsPanel';
import FontSizeSettingsPanel from './components/FontSizeSettingsPanel';
import HardwareSettingsPanel from './components/HardwareSettingsPanel';
import LanguageSettingsPanel from './components/LanguageSettingsPanel';
import OnboardingSettingsPanel from './components/OnboardingSettingsPanel';
import ThemeSettingsPanel from './components/ThemeSettingsPanel';
import './SettingsPage.css';

type CategoryId = 'appearance' | 'language' | 'agent' | 'hardware' | 'guide';

const CATEGORIES: Array<{
  id: CategoryId;
  labelKey: string;
  descKey: string;
  glyph: string;
}> = [
  {
    id: 'appearance',
    labelKey: 'settings.category.appearance',
    descKey: 'settings.category.appearance.desc',
    glyph: '◐',
  },
  {
    id: 'language',
    labelKey: 'settings.category.language',
    descKey: 'settings.category.language.desc',
    glyph: '文',
  },
  {
    id: 'agent',
    labelKey: 'settings.category.agent',
    descKey: 'settings.category.agent.desc',
    glyph: '✦',
  },
  {
    id: 'hardware',
    labelKey: 'settings.category.hardware',
    descKey: 'settings.category.hardware.desc',
    glyph: '▣',
  },
  {
    id: 'guide',
    labelKey: 'settings.category.guide',
    descKey: 'settings.category.guide.desc',
    glyph: '?',
  },
];

/** 设置主页面：左侧分类导航 + 右侧对应内容面板，加载/保存状态集中管理。 */
export default function SettingsPage() {
  const { t } = useTranslation();
  const { settings, resolvedTheme, loading, loadError, updateSettings } =
    useAppSettings();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [activeCategory, setActiveCategory] =
    useState<CategoryId>('appearance');

  let statusText = t('settings.status.synced');
  if (loading) statusText = t('settings.status.loading');
  else if (saving) statusText = t('settings.status.saving');

  const save = async (nextSettings: AppSettings) => {
    setSaving(true);
    setSaveError('');
    try {
      await updateSettings(nextSettings);
    } catch (reason) {
      setSaveError(
        reason instanceof Error ? reason.message : t('settings.error.save'),
      );
    } finally {
      setSaving(false);
    }
  };

  const disabled = loading || saving;

  return (
    <section className="settings-page">
      <header className="settings-header">
        <div>
          <span className="settings-eyebrow">SETTINGS</span>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.subtitle')}</p>
        </div>
        <div className="settings-status" aria-live="polite">
          <span
            className={`settings-status-dot${saving ? ' is-saving' : ''}`}
          />
          {statusText}
        </div>
      </header>

      {(loadError || saveError) && (
        <p className="settings-error" role="alert">
          {saveError || loadError}
        </p>
      )}

      <div className="settings-layout">
        <nav className="settings-nav" aria-label={t('settings.title')}>
          {CATEGORIES.map((category) => (
            <button
              type="button"
              key={category.id}
              className={`settings-nav-item${
                activeCategory === category.id ? ' is-active' : ''
              }`}
              aria-current={activeCategory === category.id}
              onClick={() => setActiveCategory(category.id)}
              // 手把手引导按分类 id 定位到具体某一项（见 OnboardingSteps.ts）
              data-tour={`settings-${category.id}`}
            >
              <span className="settings-nav-glyph" aria-hidden="true">
                {category.glyph}
              </span>
              <span>
                <strong>{t(category.labelKey)}</strong>
                <small>{t(category.descKey)}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {activeCategory === 'appearance' && (
            <>
              <ThemeSettingsPanel
                disabled={disabled}
                resolvedTheme={resolvedTheme}
                save={save}
                settings={settings}
              />
              <FontSizeSettingsPanel
                disabled={disabled}
                save={save}
                settings={settings}
              />
            </>
          )}

          {activeCategory === 'language' && (
            <LanguageSettingsPanel
              disabled={disabled}
              save={save}
              settings={settings}
            />
          )}

          {activeCategory === 'agent' && (
            <AgentSettingsPanel
              disabled={disabled}
              save={save}
              settings={settings}
            />
          )}

          {activeCategory === 'hardware' && <HardwareSettingsPanel />}

          {activeCategory === 'guide' && <OnboardingSettingsPanel />}
        </div>
      </div>
    </section>
  );
}
