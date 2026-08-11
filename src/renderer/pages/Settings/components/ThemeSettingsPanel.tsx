import { THEME_OPTIONS } from '../SettingsOptions';
import { SettingsPanelProps } from '../SettingsPanelTypes';

type ThemeSettingsPanelProps = SettingsPanelProps & {
  resolvedTheme: 'light' | 'dark';
};

export default function ThemeSettingsPanel({
  settings,
  disabled,
  save,
  resolvedTheme,
}: ThemeSettingsPanelProps) {
  return (
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
            disabled={disabled}
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
  );
}
