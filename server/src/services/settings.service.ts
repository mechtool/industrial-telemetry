export interface AppSettings {
  appName: string;
  language: string;
  theme: string;
  version: string;
  updatedAt: string;
}

const defaults: AppSettings = {
  appName: 'Industrial Telemetry',
  language: 'ru',
  theme: 'ng-zorro',
  version: '1.0.0',
  updatedAt: new Date().toISOString(),
};

class SettingsService {
  private settings: AppSettings = { ...defaults };

  get(): AppSettings {
    return { ...this.settings };
  }

  update(input: Partial<Pick<AppSettings, 'appName' | 'language' | 'theme'>>): AppSettings {
    if (typeof input.appName === 'string' && input.appName.trim()) {
      this.settings.appName = input.appName.trim();
    }
    if (typeof input.language === 'string' && input.language.trim()) {
      this.settings.language = input.language.trim();
    }
    if (typeof input.theme === 'string' && input.theme.trim()) {
      this.settings.theme = input.theme.trim();
    }
    this.settings.updatedAt = new Date().toISOString();
    return this.get();
  }
}

// Синглтон
export const settingsService = new SettingsService();
