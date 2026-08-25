import { useTranslation } from "react-i18next";

import type { UiLanguage } from "@/localization/i18n";
import { NOTE_TRANSLATION_COPY } from "@/localization/note-translation-copy";

export function useNoteTranslationCopy() {
  const { i18n } = useTranslation();
  const language = (i18n.resolvedLanguage ?? "en") as UiLanguage;
  return { language, copy: NOTE_TRANSLATION_COPY[language] };
}
