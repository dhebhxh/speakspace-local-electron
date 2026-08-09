import { useState } from 'react';
import { AppSettings } from '../../settings/SettingsController';
import { useAppSettings } from '../../settings/AppSettingsProvider';
import FontSizeSettingsPanel from './components/FontSizeSettingsPanel';
import OnboardingSettingsPanel from './components/OnboardingSettingsPanel';
import ThemeSettingsPanel from './components/ThemeSettingsPanel';
import './SettingsPage.css';

/** 设置主页面只管理加载/保存状态，具体选项由独立面板展示。 */
export default function SettingsPage() {
  const { settings, resolvedTheme, loading, loadError, updateSettings } =
    useAppSettings();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  let statusText = '设置已同步';
  if (loading) statusText = '正在读取设置';
  else if (saving) statusText = '正在保存';

  const save = async (nextSettings: AppSettings) => {
    setSaving(true);
    setSaveError('');
    try {
      await updateSettings(nextSettings);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : '保存设置失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="settings-page">
      <header className="settings-header">
        <div>
          <span className="settings-eyebrow">APPEARANCE</span>
          <h1>系统外观</h1>
          <p>调整整个应用的阅读尺寸和颜色模式，修改会自动保存。</p>
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

      <div className="settings-grid">
        <FontSizeSettingsPanel
          disabled={loading || saving}
          save={save}
          settings={settings}
        />
        <ThemeSettingsPanel
          disabled={loading || saving}
          resolvedTheme={resolvedTheme}
          save={save}
          settings={settings}
        />
        <OnboardingSettingsPanel />
      </div>
    </section>
  );
}
