const ONBOARDING_STORAGE_KEY = 'speakspace:onboarding:v1';
export const ONBOARDING_OPEN_EVENT = 'speakspace:open-onboarding';

/** 新手指南状态保存在当前设备；升级步骤版本时可更换 storage key。 */
export class OnboardingController {
  public static shouldOpen(): boolean {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) !== 'completed';
  }

  public static complete(): void {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'completed');
  }

  public static open(): void {
    window.dispatchEvent(new Event(ONBOARDING_OPEN_EVENT));
  }
}
