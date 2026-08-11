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
    title: '欢迎使用 SpeakSpace',
    description:
      '所有录音、笔记和 AI 处理都围绕本机工作空间组织。先用一分钟认识主要流程。',
    route: '/',
    action: '查看工作空间',
  },
  {
    icon: 'W',
    title: '建立工作空间',
    description: '在首页输入名称即可开始；最近打开的空间会自动排在最前面。',
    route: '/',
    action: '前往首页',
  },
  {
    icon: '◇',
    title: '让系统协助整理',
    description:
      '忙碌时可以采用自动生成的分类和名称，也可以稍后在详情页重命名。',
    route: '/',
    action: '查看整理建议',
  },
  {
    icon: '●',
    title: '录音与转录',
    description:
      '从实时转录开始记录，完成后将录音、全文和相关内容归入工作空间。',
    route: '/Transcription',
    action: '查看实时转录',
  },
  {
    icon: 'AI',
    title: '选择本机模型',
    description:
      '模型管理会读取 CPU、内存和 GPU 摘要，推荐平衡速度与效果的模型。',
    route: '/ModelManagement',
    action: '查看模型推荐',
  },
  {
    icon: 'Aa',
    title: '调整界面并开始使用',
    description:
      '在设置中选择字号和深浅色。以后也可以从设置页重新打开这份指南。',
    route: '/Settings',
    action: '打开设置',
  },
];
