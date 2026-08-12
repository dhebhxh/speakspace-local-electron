import {
  FontSizeSetting,
  LanguageSetting,
  ThemeSetting,
} from '../../settings/SettingsController';

/**
 * 选项只保留取值与 i18n key，可读文案由面板通过 t() 渲染，
 * 以便随界面语言切换而更新。
 */
export const FONT_SIZE_OPTIONS: Array<{
  value: FontSizeSetting;
  labelKey: string;
  descKey: string;
  sample: string;
}> = [
  {
    value: 'small',
    labelKey: 'settings.font.small',
    descKey: 'settings.font.small.desc',
    sample: 'Aa',
  },
  {
    value: 'medium',
    labelKey: 'settings.font.medium',
    descKey: 'settings.font.medium.desc',
    sample: 'Aa',
  },
  {
    value: 'large',
    labelKey: 'settings.font.large',
    descKey: 'settings.font.large.desc',
    sample: 'Aa',
  },
];

export const THEME_OPTIONS: Array<{
  value: ThemeSetting;
  labelKey: string;
  descKey: string;
}> = [
  {
    value: 'light',
    labelKey: 'settings.theme.light',
    descKey: 'settings.theme.light.desc',
  },
  {
    value: 'dark',
    labelKey: 'settings.theme.dark',
    descKey: 'settings.theme.dark.desc',
  },
  {
    value: 'system',
    labelKey: 'settings.theme.system',
    descKey: 'settings.theme.system.desc',
  },
];

export const LANGUAGE_OPTIONS: Array<{
  value: LanguageSetting;
  labelKey: string;
  descKey: string;
  glyph: string;
}> = [
  {
    value: 'zh',
    labelKey: 'settings.language.zh',
    descKey: 'settings.language.zh.desc',
    glyph: '中',
  },
  {
    value: 'en',
    labelKey: 'settings.language.en',
    descKey: 'settings.language.en.desc',
    glyph: 'EN',
  },
];
