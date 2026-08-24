import Storage from "expo-sqlite/kv-store";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  i18n,
  languageNames,
  UI_LANGUAGE_STORAGE_KEY,
  type UiLanguage,
} from "@/localization/i18n";

export function useUiLanguage() {
  const { t } = useTranslation();
  const [savingLanguage, setSavingLanguage] = useState<UiLanguage | null>(null);
  const language = i18n.resolvedLanguage as UiLanguage;

  const setLanguage = useCallback(async (next: UiLanguage) => {
    if (savingLanguage !== null || next === i18n.resolvedLanguage) return;
    const previous = i18n.resolvedLanguage as UiLanguage;
    setSavingLanguage(next);
    await i18n.changeLanguage(next);
    try {
      await Storage.setItem(UI_LANGUAGE_STORAGE_KEY, next);
    } catch (error) {
      await i18n.changeLanguage(previous);
      throw new Error(i18n.t("settings.languageSaveError"), {
        cause: error instanceof Error ? error : undefined,
      });
    } finally {
      setSavingLanguage(null);
    }
  }, [savingLanguage]);

  return { language, languageNames, savingLanguage, setLanguage, t };
}
