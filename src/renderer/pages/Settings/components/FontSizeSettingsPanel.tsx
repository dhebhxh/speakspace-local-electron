import { FONT_SIZE_OPTIONS } from '../SettingsOptions';
import { SettingsPanelProps } from '../SettingsPanelTypes';

export default function FontSizeSettingsPanel({
  settings,
  disabled,
  save,
}: SettingsPanelProps) {
  return (
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
            disabled={disabled}
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
  );
}
