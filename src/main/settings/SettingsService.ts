import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export type FontSizeSetting = 'small' | 'medium' | 'large';
export type ThemeSetting = 'light' | 'dark' | 'system';

export type AppSettings = {
  fontSize: FontSizeSetting;
  theme: ThemeSetting;
};

const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 'medium',
  theme: 'system',
};

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
      return { ...DEFAULT_SETTINGS };
    }

    try {
      const storedValue = JSON.parse(
        fs.readFileSync(this.settingsPath, 'utf8'),
      ) as unknown;
      return SettingsService.normalizeSettings(storedValue);
    } catch {
      // 文件损坏或无法读取时使用安全默认值，避免阻止应用启动。
      return { ...DEFAULT_SETTINGS };
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

    if (!candidate.fontSize || !fontSizes.includes(candidate.fontSize)) {
      throw new Error('无效的字号设置 / Invalid font size setting');
    }
    if (!candidate.theme || !themes.includes(candidate.theme)) {
      throw new Error('无效的主题设置 / Invalid theme setting');
    }

    return {
      fontSize: candidate.fontSize,
      theme: candidate.theme,
    };
  }
}
