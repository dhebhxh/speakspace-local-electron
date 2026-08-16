export type OnboardingStep = {
  icon: string;
  title: string;
  description: string;
  route: string;
  action: string;
};

/** 指南内容与弹窗交互分离，产品人员可独立维护步骤文案。 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    icon: '✦',
    title: 'onboarding.step1.title',
    description: 'onboarding.step1.desc',
    route: '/',
    action: 'onboarding.step1.action',
  },
  {
    icon: 'W',
    title: 'onboarding.step2.title',
    description: 'onboarding.step2.desc',
    route: '/',
    action: 'onboarding.step2.action',
  },
  {
    icon: '◇',
    title: 'onboarding.step3.title',
    description: 'onboarding.step3.desc',
    route: '/',
    action: 'onboarding.step3.action',
  },
  {
    icon: '●',
    title: 'onboarding.step4.title',
    description: 'onboarding.step4.desc',
    route: '/Transcription',
    action: 'onboarding.step4.action',
  },
  {
    icon: 'AI',
    title: 'onboarding.step5.title',
    description: 'onboarding.step5.desc',
    route: '/ModelManagement',
    action: 'onboarding.step5.action',
  },
  {
    icon: 'Aa',
    title: 'onboarding.step6.title',
    description: 'onboarding.step6.desc',
    route: '/Settings',
    action: 'onboarding.step6.action',
  },
];
