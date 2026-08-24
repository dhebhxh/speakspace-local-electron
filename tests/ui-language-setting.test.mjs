import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("UI language setting exposes exactly the eight supported locales", async () => {
  const source = await read("src/localization/i18n.ts");
  assert.match(source, /UI_LANGUAGES = \["en", "zh-CN", "es", "fr", "de", "ja", "ko", "pt"\] as const/);
  assert.match(source, /UI_LANGUAGE_STORAGE_KEY = "settings\.ui-language"/);
});

test("UI locale remains isolated from STT, LLM, and TTS services", async () => {
  const servicePaths = [
    "src/services/transcription-service.ts",
    "src/services/llm-inference-service.ts",
    "src/services/speech-playback-service.ts",
    "src/services/tts-model-service.ts",
  ];
  for (const path of servicePaths) {
    const source = await read(path);
    assert.doesNotMatch(source, /UI_LANGUAGE_STORAGE_KEY|settings\.ui-language|useUiLanguage|localization\/i18n/);
  }
});
