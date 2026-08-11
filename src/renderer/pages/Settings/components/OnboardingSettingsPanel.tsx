import { OnboardingController } from '../../../onboarding/OnboardingController';

export default function OnboardingSettingsPanel() {
  return (
    <section className="settings-panel" aria-labelledby="guide-title">
      <div className="settings-panel-heading">
        <span className="settings-panel-icon guide-icon" aria-hidden="true">
          ?
        </span>
        <div>
          <h2 id="guide-title">新用户使用指南</h2>
          <p>重新查看工作空间、转录、模型推荐和设置流程。</p>
        </div>
      </div>
      <button
        className="settings-guide-button"
        onClick={() => OnboardingController.open()}
        type="button"
      >
        打开 6 步指南
      </button>
    </section>
  );
}
