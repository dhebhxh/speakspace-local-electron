import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ONBOARDING_OPEN_EVENT,
  OnboardingController,
} from './OnboardingController';
import { ONBOARDING_STEPS } from './OnboardingSteps';
import './OnboardingGuide.css';

/** 首次启动显示 6 步指南；内容独立于业务页面，避免影响现有交互。 */
export default function OnboardingGuide() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => OnboardingController.shouldOpen());
  const [stepIndex, setStepIndex] = useState(0);
  const step = ONBOARDING_STEPS[stepIndex];

  useEffect(() => {
    const reopen = () => {
      setStepIndex(0);
      setOpen(true);
    };
    window.addEventListener(ONBOARDING_OPEN_EVENT, reopen);
    return () => window.removeEventListener(ONBOARDING_OPEN_EVENT, reopen);
  }, []);

  if (!open) return null;

  const close = () => {
    OnboardingController.complete();
    setOpen(false);
  };
  const next = () => {
    if (stepIndex === ONBOARDING_STEPS.length - 1) close();
    else setStepIndex((current) => current + 1);
  };

  return (
    <div className="onboarding-backdrop" role="presentation">
      <section
        aria-describedby="onboarding-description"
        aria-labelledby="onboarding-title"
        aria-modal="true"
        className="onboarding-dialog"
        role="dialog"
      >
        <header className="onboarding-progress-header">
          <span>
            {t('onboarding.titlePrefix')} · {stepIndex + 1}/
            {ONBOARDING_STEPS.length}
          </span>
          <button onClick={close} type="button">
            {t('onboarding.skip')}
          </button>
        </header>

        <div className="onboarding-visual" aria-hidden="true">
          {step.icon}
        </div>
        <h2 id="onboarding-title">{t(step.title)}</h2>
        <p id="onboarding-description">{t(step.description)}</p>

        <button
          className="onboarding-route-button"
          onClick={() => navigate(step.route)}
          type="button"
        >
          {t(step.action)} ↗
        </button>

        <div
          className="onboarding-dots"
          aria-label={t('onboarding.progressAria')}
        >
          {ONBOARDING_STEPS.map((item, index) => (
            <button
              aria-label={`${t('onboarding.stepPrefix')}${index + 1}${t('onboarding.stepSuffix')}${t(item.title)}`}
              className={index === stepIndex ? 'is-current' : ''}
              key={item.title}
              onClick={() => setStepIndex(index)}
              type="button"
            />
          ))}
        </div>

        <footer className="onboarding-actions">
          <button
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((current) => current - 1)}
            type="button"
          >
            {t('onboarding.prev')}
          </button>
          <button className="is-primary" onClick={next} type="button">
            {stepIndex === ONBOARDING_STEPS.length - 1
              ? t('onboarding.finish')
              : t('onboarding.next')}
          </button>
        </footer>
      </section>
    </div>
  );
}
