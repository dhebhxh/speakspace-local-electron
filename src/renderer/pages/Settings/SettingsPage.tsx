import { useState } from 'react';
import {
  AppSettings,
  FontSizeSetting,
  ThemeSetting,
} from '../../settings/SettingsController';
import { useAppSettings } from '../../settings/AppSettingsProvider';
import './SettingsPage.css';

const FONT_SIZE_OPTIONS: Array<{
  value: FontSizeSetting;
  label: string;
  description: string;
  sample: string;
}> = [
  {
    value: 'small',
    label: '小',
    description: '适合显示更多内容',
    sample: 'Aa',
  },
  { value: 'medium', label: '中', description: '默认平衡尺寸', sample: 'Aa' },
  { value: 'large', label: '大', description: '更易阅读', sample: 'Aa' },
];

const THEME_OPTIONS: Array<{
  value: ThemeSetting;
  label: string;
  description: string;
}> = [
  { value: 'light', label: '浅色', description: '明亮、清晰的工作界面' },
  { value: 'dark', label: '深色', description: '降低暗光环境下的视觉刺激' },
  { value: 'system', label: '跟随系统', description: '随操作系统外观自动切换' },
];

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
        <section className="settings-panel" aria-labelledby="font-size-title">
          <div className="settings-panel-heading">
            <span className="settings-panel-icon" aria-hidden="true">
              A
            </span>
            <div>
              <h2 id="font-size-title">输出文字字号</h2>
              <p>用于导航、页面文字和输出内容。</p>
            </div>
          </div>

          <div
            className="settings-options"
            role="radiogroup"
            aria-label="输出文字字号"
          >
            {FONT_SIZE_OPTIONS.map((option) => (
              <button
                aria-checked={settings.fontSize === option.value}
                className={`settings-option font-${option.value}${
                  settings.fontSize === option.value ? ' is-selected' : ''
                }`}
                disabled={loading || saving}
                key={option.value}
                onClick={() => save({ ...settings, fontSize: option.value })}
                role="radio"
                type="button"
              >
                <span className="settings-font-sample">{option.sample}</span>
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
                <span className="settings-check" aria-hidden="true">
                  ✓
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-panel" aria-labelledby="theme-title">
          <div className="settings-panel-heading">
            <span className="settings-panel-icon theme-icon" aria-hidden="true">
              ◐
            </span>
            <div>
              <h2 id="theme-title">系统颜色</h2>
              <p>选择浅色、深色，或自动跟随系统。</p>
            </div>
          </div>

          <div
            className="settings-options theme-options"
            role="radiogroup"
            aria-label="系统颜色"
          >
            {THEME_OPTIONS.map((option) => (
              <button
                aria-checked={settings.theme === option.value}
                className={`settings-option theme-${option.value}${
                  settings.theme === option.value ? ' is-selected' : ''
                }`}
                disabled={loading || saving}
                key={option.value}
                onClick={() => save({ ...settings, theme: option.value })}
                role="radio"
                type="button"
              >
                <span className="settings-theme-preview" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
                <span className="settings-check" aria-hidden="true">
                  ✓
                </span>
              </button>
            ))}
          </div>

          <p className="settings-resolved-theme">
            当前实际显示：{resolvedTheme === 'dark' ? '深色模式' : '浅色模式'}
          </p>
        </section>
      </div>
    </section>
  );
}
