import Storage from "expo-sqlite/kv-store";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";

export const UI_LANGUAGES = ["en", "zh-CN", "es", "fr", "de", "ja", "ko", "pt"] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

export const UI_LANGUAGE_STORAGE_KEY = "settings.ui-language";

export const languageNames: Record<UiLanguage, string> = {
  en: "English",
  "zh-CN": "简体中文",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  ja: "日本語",
  ko: "한국어",
  pt: "Português",
};

const en = {
  nav: { back: "Back", home: "Home", workspaces: "Workspaces", ai: "AI", settings: "Settings", askAi: "Ask AI", transcription: "Transcription", audioTranscription: "Transcribe audio file" },
  settings: {
    kicker: "SETTINGS", appearance: "Appearance", appearanceDescription: "Choose how SpeakSpace looks on this device.",
    light: "Light", lightDescription: "Always use the light appearance.", dark: "Dark", darkDescription: "Always use the dark appearance.", system: "System", systemDescription: "Follow the system appearance setting.",
    language: "Language", languageDescription: "Choose the language used by the interface.",
    languageScope: "This setting changes UI text only. Speech recognition and AI detect language automatically, and speech output follows the input text.",
    appearanceSaveError: "Unable to save the appearance setting.", languageSaveError: "Unable to save the language setting.",
  },
};

const resources = {
  en: { translation: en },
  "zh-CN": { translation: { nav: { back: "返回", home: "首页", workspaces: "工作区", ai: "AI", settings: "设置", askAi: "询问 AI", transcription: "转录", audioTranscription: "转录音频文件" }, settings: { kicker: "设置", appearance: "外观", appearanceDescription: "选择 SpeakSpace 在此设备上的显示方式。", light: "浅色", lightDescription: "始终使用浅色外观。", dark: "深色", darkDescription: "始终使用深色外观。", system: "跟随系统", systemDescription: "跟随系统的外观设置。", language: "语言", languageDescription: "选择界面所使用的语言。", languageScope: "此设置仅更改界面文字。语音识别和 AI 会自动检测语言，语音输出由输入文本决定。", appearanceSaveError: "无法保存外观设置。", languageSaveError: "无法保存语言设置。" } } },
  es: { translation: { nav: { back: "Atrás", home: "Inicio", workspaces: "Espacios", ai: "IA", settings: "Ajustes", askAi: "Preguntar a la IA", transcription: "Transcripción", audioTranscription: "Transcribir archivo de audio" }, settings: { kicker: "AJUSTES", appearance: "Apariencia", appearanceDescription: "Elige cómo se ve SpeakSpace en este dispositivo.", light: "Claro", lightDescription: "Usar siempre la apariencia clara.", dark: "Oscuro", darkDescription: "Usar siempre la apariencia oscura.", system: "Sistema", systemDescription: "Seguir la apariencia del sistema.", language: "Idioma", languageDescription: "Elige el idioma de la interfaz.", languageScope: "Este ajuste solo cambia el texto de la interfaz. El reconocimiento de voz y la IA detectan el idioma automáticamente, y la voz sigue el texto de entrada.", appearanceSaveError: "No se pudo guardar la apariencia.", languageSaveError: "No se pudo guardar el idioma." } } },
  fr: { translation: { nav: { back: "Retour", home: "Accueil", workspaces: "Espaces", ai: "IA", settings: "Réglages", askAi: "Demander à l’IA", transcription: "Transcription", audioTranscription: "Transcrire un fichier audio" }, settings: { kicker: "RÉGLAGES", appearance: "Apparence", appearanceDescription: "Choisissez l’apparence de SpeakSpace sur cet appareil.", light: "Clair", lightDescription: "Toujours utiliser l’apparence claire.", dark: "Sombre", darkDescription: "Toujours utiliser l’apparence sombre.", system: "Système", systemDescription: "Suivre l’apparence du système.", language: "Langue", languageDescription: "Choisissez la langue de l’interface.", languageScope: "Ce réglage modifie uniquement le texte de l’interface. La reconnaissance vocale et l’IA détectent automatiquement la langue, et la voix suit le texte saisi.", appearanceSaveError: "Impossible d’enregistrer l’apparence.", languageSaveError: "Impossible d’enregistrer la langue." } } },
  de: { translation: { nav: { back: "Zurück", home: "Start", workspaces: "Arbeitsbereiche", ai: "KI", settings: "Einstellungen", askAi: "KI fragen", transcription: "Transkription", audioTranscription: "Audiodatei transkribieren" }, settings: { kicker: "EINSTELLUNGEN", appearance: "Darstellung", appearanceDescription: "Wähle das Erscheinungsbild von SpeakSpace auf diesem Gerät.", light: "Hell", lightDescription: "Immer die helle Darstellung verwenden.", dark: "Dunkel", darkDescription: "Immer die dunkle Darstellung verwenden.", system: "System", systemDescription: "Der Systemdarstellung folgen.", language: "Sprache", languageDescription: "Wähle die Sprache der Benutzeroberfläche.", languageScope: "Diese Einstellung ändert nur UI-Texte. Spracherkennung und KI erkennen die Sprache automatisch, und die Sprachausgabe folgt dem Eingabetext.", appearanceSaveError: "Darstellung konnte nicht gespeichert werden.", languageSaveError: "Sprache konnte nicht gespeichert werden." } } },
  ja: { translation: { nav: { back: "戻る", home: "ホーム", workspaces: "ワークスペース", ai: "AI", settings: "設定", askAi: "AIに質問", transcription: "文字起こし", audioTranscription: "音声ファイルを文字起こし" }, settings: { kicker: "設定", appearance: "外観", appearanceDescription: "このデバイスでのSpeakSpaceの表示を選択します。", light: "ライト", lightDescription: "常にライト表示を使用します。", dark: "ダーク", darkDescription: "常にダーク表示を使用します。", system: "システム", systemDescription: "システムの外観設定に従います。", language: "言語", languageDescription: "インターフェースの言語を選択します。", languageScope: "この設定で変更されるのはUIテキストのみです。音声認識とAIは言語を自動検出し、音声出力は入力テキストに従います。", appearanceSaveError: "外観設定を保存できません。", languageSaveError: "言語設定を保存できません。" } } },
  ko: { translation: { nav: { back: "뒤로", home: "홈", workspaces: "작업 공간", ai: "AI", settings: "설정", askAi: "AI에게 질문", transcription: "전사", audioTranscription: "오디오 파일 전사" }, settings: { kicker: "설정", appearance: "화면 모드", appearanceDescription: "이 기기에서 SpeakSpace의 표시 방식을 선택하세요.", light: "라이트", lightDescription: "항상 라이트 모드를 사용합니다.", dark: "다크", darkDescription: "항상 다크 모드를 사용합니다.", system: "시스템", systemDescription: "시스템 화면 모드 설정을 따릅니다.", language: "언어", languageDescription: "인터페이스에 사용할 언어를 선택하세요.", languageScope: "이 설정은 UI 텍스트만 변경합니다. 음성 인식과 AI는 언어를 자동 감지하며, 음성 출력은 입력 텍스트를 따릅니다.", appearanceSaveError: "화면 모드 설정을 저장할 수 없습니다.", languageSaveError: "언어 설정을 저장할 수 없습니다." } } },
  pt: { translation: { nav: { back: "Voltar", home: "Início", workspaces: "Espaços", ai: "IA", settings: "Definições", askAi: "Perguntar à IA", transcription: "Transcrição", audioTranscription: "Transcrever ficheiro de áudio" }, settings: { kicker: "DEFINIÇÕES", appearance: "Aspeto", appearanceDescription: "Escolha o aspeto do SpeakSpace neste dispositivo.", light: "Claro", lightDescription: "Usar sempre o aspeto claro.", dark: "Escuro", darkDescription: "Usar sempre o aspeto escuro.", system: "Sistema", systemDescription: "Seguir o aspeto do sistema.", language: "Idioma", languageDescription: "Escolha o idioma da interface.", languageScope: "Esta definição altera apenas o texto da interface. O reconhecimento de voz e a IA detetam o idioma automaticamente, e a voz segue o texto introduzido.", appearanceSaveError: "Não foi possível guardar o aspeto.", languageSaveError: "Não foi possível guardar o idioma." } } },
} as const;

function isUiLanguage(value: string | null): value is UiLanguage {
  return UI_LANGUAGES.some((language) => language === value);
}

function readInitialLanguage(): UiLanguage {
  try {
    const stored = Storage.getItemSync(UI_LANGUAGE_STORAGE_KEY);
    return isUiLanguage(stored) ? stored : "en";
  } catch (error) {
    console.warn("[i18n] Unable to read the saved UI language; using English.", { error });
    return "en";
  }
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: readInitialLanguage(),
  fallbackLng: "en",
  supportedLngs: [...UI_LANGUAGES],
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export { i18n };
