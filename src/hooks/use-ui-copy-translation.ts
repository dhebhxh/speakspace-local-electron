import { useTranslation } from "react-i18next";

import type { UiLanguage } from "@/localization/i18n";
import { translateUiCopy } from "@/localization/ui-copy";

export function useUiCopyTranslation() {
  const { i18n } = useTranslation();
  const language = (i18n.resolvedLanguage ?? "en") as UiLanguage;
  return (value: string) => translateUiCopy(value, language);
}
