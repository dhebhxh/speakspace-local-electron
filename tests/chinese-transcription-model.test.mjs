import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalogPath = new URL("../src/constants/stt-model-catalog.ts", import.meta.url);
const servicePath = new URL("../src/services/transcription-service.ts", import.meta.url);

test("the Chinese Whisper model is recommended before English-only models", async () => {
  const source = await readFile(catalogPath, "utf8");
  assert.ok(source.indexOf('id: "whisper-small-multilingual-f16"') < source.indexOf('id: "parakeet-tdt-0.6b-v3-q4_0"'));
  assert.match(source, /transcriptionLanguage: "zh"/);
  assert.match(source, /recommendedForChinese: true/);
  assert.match(source, /languageLabel: "English only"/);
});

test("live Chinese Whisper transcription uses a longer phrase window", async () => {
  const source = await readFile(servicePath, "utf8");
  assert.match(source, /audioSliceSec: isWhisper \? 12 : 8/);
  assert.match(source, /audioMinSec: isWhisper \? 1\.2 : 0\.8/);
});
