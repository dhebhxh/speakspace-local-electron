import {
  FontSizeSetting,
  ThemeSetting,
} from '../../settings/SettingsController';

export const FONT_SIZE_OPTIONS: Array<{
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

export const THEME_OPTIONS: Array<{
  value: ThemeSetting;
  label: string;
  description: string;
}> = [
  { value: 'light', label: '浅色', description: '明亮、清晰的工作界面' },
  { value: 'dark', label: '深色', description: '降低暗光环境下的视觉刺激' },
  { value: 'system', label: '跟随系统', description: '随操作系统外观自动切换' },
];
