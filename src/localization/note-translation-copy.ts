import type { UiLanguage } from "@/localization/i18n";

export type NoteTranslationCopy = {
  languageName: string;
  translate: string;
  translating: string;
  restore: string;
  translatedInto: (language: string) => string;
  translateInto: (language: string) => string;
  localHint: string;
  genericError: string;
  restoreError: string;
};

export const NOTE_TRANSLATION_COPY: Record<UiLanguage, NoteTranslationCopy> = {
  en: { languageName: "English", translate: "Translate", translating: "Translating…", restore: "Restore original", translatedInto: (language) => `Translated into ${language}`, translateInto: (language) => `Translate into ${language}`, localHint: "Runs privately with your active local LLM.", genericError: "Unable to translate this section.", restoreError: "Unable to restore the original text." },
  "zh-CN": { languageName: "简体中文", translate: "翻译", translating: "正在翻译…", restore: "恢复原文", translatedInto: (language) => `已翻译为${language}`, translateInto: (language) => `翻译为${language}`, localHint: "使用当前启用的本地 LLM 私密处理。", genericError: "无法翻译此部分。", restoreError: "无法恢复原始文本。" },
  es: { languageName: "Español", translate: "Traducir", translating: "Traduciendo…", restore: "Restaurar original", translatedInto: (language) => `Traducido al ${language}`, translateInto: (language) => `Traducir al ${language}`, localHint: "Se ejecuta de forma privada con el LLM local activo.", genericError: "No se pudo traducir esta sección.", restoreError: "No se pudo restaurar el texto original." },
  fr: { languageName: "Français", translate: "Traduire", translating: "Traduction…", restore: "Restaurer l’original", translatedInto: (language) => `Traduit en ${language}`, translateInto: (language) => `Traduire en ${language}`, localHint: "Traitement privé avec le LLM local actif.", genericError: "Impossible de traduire cette section.", restoreError: "Impossible de restaurer le texte original." },
  de: { languageName: "Deutsch", translate: "Übersetzen", translating: "Wird übersetzt…", restore: "Original wiederherstellen", translatedInto: (language) => `In ${language} übersetzt`, translateInto: (language) => `In ${language} übersetzen`, localHint: "Wird privat mit dem aktiven lokalen LLM ausgeführt.", genericError: "Dieser Abschnitt konnte nicht übersetzt werden.", restoreError: "Der Originaltext konnte nicht wiederhergestellt werden." },
  ja: { languageName: "日本語", translate: "翻訳", translating: "翻訳中…", restore: "原文に戻す", translatedInto: (language) => `${language}に翻訳済み`, translateInto: (language) => `${language}に翻訳`, localHint: "有効なローカル LLM で非公開に処理します。", genericError: "このセクションを翻訳できませんでした。", restoreError: "原文を復元できませんでした。" },
  ko: { languageName: "한국어", translate: "번역", translating: "번역 중…", restore: "원문 복원", translatedInto: (language) => `${language}(으)로 번역됨`, translateInto: (language) => `${language}(으)로 번역`, localHint: "활성 로컬 LLM으로 기기에서 비공개 처리됩니다.", genericError: "이 섹션을 번역할 수 없습니다.", restoreError: "원문을 복원할 수 없습니다." },
  pt: { languageName: "Português", translate: "Traduzir", translating: "A traduzir…", restore: "Restaurar original", translatedInto: (language) => `Traduzido para ${language}`, translateInto: (language) => `Traduzir para ${language}`, localHint: "Executado de forma privada com o LLM local ativo.", genericError: "Não foi possível traduzir esta secção.", restoreError: "Não foi possível restaurar o texto original." },
};
