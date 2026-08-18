/**
 * 引导步骤定义。
 *
 * 每一步描述的是「带用户走到哪儿、指着什么说话」，而不是一页文案：
 *   route  —— 先自动跳到这个页面
 *   target —— 再把聚光灯打到这个元素上（CSS 选择器）
 *   说的话 —— 用大白话讲清这块能干嘛
 *
 * target 写 null 表示这一步不指任何具体控件（开场和结束），
 * 卡片会停在屏幕中央。
 *
 * 选择器优先用 data-tour 属性；只有那些本来就语义稳定的类名
 * （.studio-composer 这种）才直接用类名。因为类名是给样式用的，
 * 随时可能因为改版被换掉，而 data-tour 一眼就能看出「这里被引导引用了，
 * 别乱改」。
 */
export type StepPlacement = 'auto' | 'center';

export type OnboardingStep = {
  /** 稳定 id，用作 React key 和进度定位 */
  id: string;
  /**
   * 进入这一步时跳转到的路由。每一步都必须写，不能省略：
   * 往回退的时候也要重新断言一次页面，否则「上一步」只会把弹窗挪回去，
   * 而页面还停在后一步那一页，聚光灯自然就找不到目标了。
   */
  route: string;
  /** 高亮目标的选择器；null 表示居中展示不打光 */
  target: string | null;
  placement: StepPlacement;
  titleKey: string;
  descKey: string;
  /** 可选的一句操作提示，显示在描述下方，带一个跳动的箭头 */
  hintKey?: string;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    route: '/',
    target: null,
    placement: 'center',
    titleKey: 'onboarding.tour.welcome.title',
    descKey: 'onboarding.tour.welcome.desc',
  },
  {
    id: 'nav',
    route: '/',
    target: '[data-tour="sidebar-nav"]',
    placement: 'auto',
    titleKey: 'onboarding.tour.nav.title',
    descKey: 'onboarding.tour.nav.desc',
  },
  {
    id: 'composer',
    route: '/',
    target: '.studio-composer',
    placement: 'auto',
    titleKey: 'onboarding.tour.composer.title',
    descKey: 'onboarding.tour.composer.desc',
    hintKey: 'onboarding.tour.composer.hint',
  },
  {
    id: 'record',
    route: '/',
    target: '.studio-record-button',
    placement: 'auto',
    titleKey: 'onboarding.tour.record.title',
    descKey: 'onboarding.tour.record.desc',
    hintKey: 'onboarding.tour.record.hint',
  },
  {
    id: 'upload',
    route: '/',
    target: '.studio-upload-button',
    placement: 'auto',
    titleKey: 'onboarding.tour.upload.title',
    descKey: 'onboarding.tour.upload.desc',
  },
  {
    id: 'agent',
    route: '/',
    target: '.studio-agent-toggle',
    placement: 'auto',
    titleKey: 'onboarding.tour.agent.title',
    descKey: 'onboarding.tour.agent.desc',
    hintKey: 'onboarding.tour.agent.hint',
  },
  {
    id: 'library',
    route: '/',
    target: '.ask-ai-library',
    placement: 'auto',
    titleKey: 'onboarding.tour.library.title',
    descKey: 'onboarding.tour.library.desc',
  },
  {
    id: 'libraryDrag',
    route: '/',
    target: '.ask-ai-note-list',
    placement: 'auto',
    titleKey: 'onboarding.tour.libraryDrag.title',
    descKey: 'onboarding.tour.libraryDrag.desc',
    hintKey: 'onboarding.tour.libraryDrag.hint',
  },
  {
    id: 'recents',
    route: '/',
    target: '.ask-ai-recents',
    placement: 'auto',
    titleKey: 'onboarding.tour.recents.title',
    descKey: 'onboarding.tour.recents.desc',
  },
  {
    id: 'splitter',
    route: '/',
    target: '.ask-ai-library-splitter',
    placement: 'auto',
    titleKey: 'onboarding.tour.splitter.title',
    descKey: 'onboarding.tour.splitter.desc',
    hintKey: 'onboarding.tour.splitter.hint',
  },
  {
    id: 'workspace',
    route: '/Workspace',
    target: '.workspace-home-create',
    placement: 'auto',
    titleKey: 'onboarding.tour.workspace.title',
    descKey: 'onboarding.tour.workspace.desc',
  },
  {
    id: 'newNote',
    route: '/DashBoard',
    target: '.create-note-btn',
    placement: 'auto',
    titleKey: 'onboarding.tour.newNote.title',
    descKey: 'onboarding.tour.newNote.desc',
  },
  {
    id: 'dashboard',
    route: '/DashBoard',
    target: '.metric-cards-grid',
    placement: 'auto',
    titleKey: 'onboarding.tour.dashboard.title',
    descKey: 'onboarding.tour.dashboard.desc',
  },
  {
    id: 'calendar',
    route: '/DashBoard',
    target: '.calendar-widget',
    placement: 'auto',
    titleKey: 'onboarding.tour.calendar.title',
    descKey: 'onboarding.tour.calendar.desc',
    hintKey: 'onboarding.tour.calendar.hint',
  },
  {
    id: 'models',
    route: '/ModelManagement',
    target: '.model-module-list',
    placement: 'auto',
    titleKey: 'onboarding.tour.models.title',
    descKey: 'onboarding.tour.models.desc',
    hintKey: 'onboarding.tour.models.hint',
  },
  {
    id: 'templates',
    route: '/Workflow',
    target: '.workflow-page',
    placement: 'auto',
    titleKey: 'onboarding.tour.templates.title',
    descKey: 'onboarding.tour.templates.desc',
  },
  {
    id: 'settings',
    route: '/Settings',
    target: '.settings-nav',
    placement: 'auto',
    titleKey: 'onboarding.tour.settings.title',
    descKey: 'onboarding.tour.settings.desc',
  },
  {
    id: 'settingsAgent',
    route: '/Settings',
    target: '[data-tour="settings-agent"]',
    placement: 'auto',
    titleKey: 'onboarding.tour.settingsAgent.title',
    descKey: 'onboarding.tour.settingsAgent.desc',
    hintKey: 'onboarding.tour.settingsAgent.hint',
  },
  {
    id: 'done',
    route: '/',
    target: null,
    placement: 'center',
    titleKey: 'onboarding.tour.done.title',
    descKey: 'onboarding.tour.done.desc',
    hintKey: 'onboarding.tour.done.hint',
  },
];
