import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export type FontSizeSetting = 'small' | 'medium' | 'large';
export type ThemeSetting = 'light' | 'dark' | 'system';
export type LanguageSetting = 'zh' | 'en';

export type AppSettings = {
  fontSize: FontSizeSetting;
  theme: ThemeSetting;
  language: LanguageSetting;
};

const DEFAULT_APPEARANCE = {
  fontSize: 'medium' as FontSizeSetting,
  theme: 'system' as ThemeSetting,
};

/**
 * 根据操作系统语言推断默认界面语言：中文区域用中文，其余一律英文。
 * 仅用于首次运行 / 旧配置缺省语言字段的兜底，用户手动选择后不再参与。
 */
function detectSystemLanguage(): LanguageSetting {
  let locale = '';
  try {
    // app.getLocale 需在 app ready 后可用；异常时安全回退。
    locale = app.getLocale();
  } catch {
    locale = '';
  }
  return locale.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function buildDefaultSettings(): AppSettings {
  return { ...DEFAULT_APPEARANCE, language: detectSystemLanguage() };
}

/**
 * 通用应用设置服务：负责验证并持久化设置，不包含页面展示逻辑。
 * 文件保存在 Electron userData 目录，应用升级时仍会保留。
 */
export class SettingsService {
  private readonly settingsPath: string;

  public constructor(
    settingsPath = path.join(app.getPath('userData'), 'app-settings.json'),
  ) {
    this.settingsPath = settingsPath;
  }

  public getSettings(): AppSettings {
    if (!fs.existsSync(this.settingsPath)) {
      // 首次运行：按设备系统语言给出默认界面语言。
      return buildDefaultSettings();
    }

    try {
      const storedValue = JSON.parse(
        fs.readFileSync(this.settingsPath, 'utf8'),
      ) as unknown;
      return SettingsService.normalizeSettings(storedValue);
    } catch {
      // 文件损坏或无法读取时使用安全默认值，避免阻止应用启动。
      return buildDefaultSettings();
    }
  }

  public updateSettings(rawSettings: unknown): AppSettings {
    const settings = SettingsService.normalizeSettings(rawSettings);
    fs.mkdirSync(path.dirname(this.settingsPath), { recursive: true });
    fs.writeFileSync(
      this.settingsPath,
      `${JSON.stringify(settings, null, 2)}\n`,
      'utf8',
    );
    return settings;
  }

  private static normalizeSettings(value: unknown): AppSettings {
    if (typeof value !== 'object' || value === null) {
      throw new Error('无效的应用设置 / Invalid application settings');
    }

    const candidate = value as Partial<AppSettings>;
    const fontSizes: FontSizeSetting[] = ['small', 'medium', 'large'];
    const themes: ThemeSetting[] = ['light', 'dark', 'system'];
    const languages: LanguageSetting[] = ['zh', 'en'];

    if (!candidate.fontSize || !fontSizes.includes(candidate.fontSize)) {
      throw new Error('无效的字号设置 / Invalid font size setting');
    }
    if (!candidate.theme || !themes.includes(candidate.theme)) {
      throw new Error('无效的主题设置 / Invalid theme setting');
    }
    // 语言字段为后续新增：已保存的合法值优先使用（尊重用户手动选择），
    // 旧配置缺省时按系统语言兜底，保证向后兼容。
    const language =
      candidate.language && languages.includes(candidate.language)
        ? candidate.language
        : detectSystemLanguage();

    return {
      fontSize: candidate.fontSize,
      theme: candidate.theme,
      language,
    };
  }
}
