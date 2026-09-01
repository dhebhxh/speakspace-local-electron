import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("UI language setting exposes exactly the eight supported locales", async () => {
  const source = await read("src/localization/i18n.ts");
  assert.match(source, /UI_LANGUAGES = \["en", "zh-CN", "es", "fr", "de", "ja", "ko", "pt"\] as const/);
  assert.match(source, /UI_LANGUAGE_STORAGE_KEY = "settings\.ui-language"/);
  assert.doesNotMatch(source, /iPhone/);
  assert.match(source, /选择 SpeakSpace 在此设备上的显示方式。/);
  assert.match(source, /跟随系统的外观设置。/);
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

test("home overview stat cards have localized labels, filters, and weekly deltas", async () => {
  const source = await read("src/localization/ui-copy.ts");
  for (const label of ["Total notes", "Pinned", "Characters", "Open tasks", "Show all notes", "Filter pinned notes", "Filter unfinished notes"]) {
    assert.match(source, new RegExp(`\\b${label.replaceAll(" ", "\\s+")}\\b`));
  }
  assert.match(source, /value\.match\(\/\^\\\+\(\\S\+\) this week\$\//);
});

test("home task groups and dynamic task counts are localized", async () => {
  const source = await read("src/localization/ui-copy.ts");
  for (const label of ["Overdue", "Today", "Upcoming", "Unscheduled", "Calendar follow-ups"]) {
    assert.ok(source.includes(label), `missing localized home task copy: ${label}`);
  }
  assert.match(source, /value\.match\(\/\^Completed/);
  assert.match(source, /value\.match\(\/\^\(\\d\+\) open notes/);

  const taskList = await read("src/components/home-task-list.tsx");
  const home = await read("src/app/(tabs)/index.tsx");
  assert.match(taskList, /\{`Completed \(\$\{groups\.completed\.length\}\)`\}/);
  assert.match(taskList, /calendarOnlyNotes\.map/);
  assert.match(home, /\{`\$\{overviewData\.filteredNotes\.length\} shown`\}/);
});

test("home calendar follows the selected UI locale", async () => {
  const localeSource = await read("src/localization/calendar-locale.ts");
  const home = await read("src/app/(tabs)/index.tsx");
  assert.match(localeSource, /LocaleConfig\.defaultLocale = language/);
  assert.match(localeSource, /monthNames:/);
  assert.match(localeSource, /dayNamesShort:/);
  assert.match(home, /configureCalendarLocale\(language\)/);
  assert.match(home, /<Calendar key=\{language\}/);
});

test("new workspace dialog copy is localized", async () => {
  const source = await read("src/localization/ui-copy.ts");
  for (const label of ["+ New workspace", "New workspace", "Create workspace", "Creating...", "Name"]) {
    assert.ok(source.includes(label), `missing localized workspace copy: ${label}`);
  }
});

test("new note dialog copy is localized", async () => {
  const source = await read("src/localization/ui-copy.ts");
  for (const label of ["New note", "Create note", "Title (optional)", "e.g. Team meeting", "Saving...", "Save name", "Done"]) {
    assert.ok(source.includes(label), `missing localized new note copy: ${label}`);
  }
});

test("AI management header and model descriptions are localized", async () => {
  const copy = await read("src/localization/ui-copy.ts");
  const screen = await read("src/app/(tabs)/ai/index.tsx");
  for (const label of ["AI Management", "Manage the speech and language models", "Speech recognition models for local transcription", "Language models for private", "Local voices for private"]) {
    assert.ok(copy.includes(label), `missing localized AI management copy: ${label}`);
  }
  assert.match(screen, /title: tr\("AI Management"\)/);
});

test("all three model detail screens localize headers and catalog descriptions", async () => {
  const screens = [
    ["src/app/(tabs)/ai/stt-models.tsx", "Speech-to-Text Models"],
    ["src/app/(tabs)/ai/llm-models.tsx", "Large Language Models"],
    ["src/app/(tabs)/ai/tts-models.tsx", "Text-to-Speech Models"],
  ];
  for (const [path, title] of screens) {
    const source = await read(path);
    assert.ok(source.includes(`title: tr("${title}")`), `${path} has an untranslated header`);
    assert.match(source, /description=\{tr\(entry\.description\)\}/);
  }

  const copy = await read("src/localization/ui-copy.ts");
  for (const label of ["Download failed.", "Unable to use this model.", "Unable to remove this model.", "Downloading…", "Installing", "Multiple voices"]) {
    assert.ok(copy.includes(label), `missing localized model management copy: ${label}`);
  }
  assert.match(copy, /ZH_MODEL_DESCRIPTIONS/);
  assert.match(copy, /Remove \"\(\.\+\)\" from this device/);
});

test("read-aloud controls and playback states are localized", async () => {
  const copy = await read("src/localization/ui-copy.ts");
  const button = await read("src/components/speech-playback-button.tsx");
  for (const label of ["Read aloud", "Stop", "Preparing speech…", "Playing", "Open Text-to-Speech Models"]) {
    assert.ok(copy.includes(label), `missing localized speech playback copy: ${label}`);
  }
  assert.match(button, /const buttonLabel = tr\(isActive/);
});

test("core insight actions and knowledge scenario templates are localized", async () => {
  const copy = await read("src/localization/ui-copy.ts");
  for (const label of [
    "Regenerate Core Insights", "Generate Core Insights", "Generate Knowledge",
    "Meeting", "Lecture", "Consultation", "Interview", "Brainstorm", "General",
    "Discussion, decisions, alignment", "Concepts, explanations, examples",
  ]) {
    assert.ok(copy.includes(label), `missing localized knowledge copy: ${label}`);
  }
});

test("Ask AI screen and floating button use localized UI copy", async () => {
  const copy = await read("src/localization/ui-copy.ts");
  const screen = await read("src/app/ask-ai.tsx");
  const floatingButton = await read("src/components/floating-ask-ai-button.tsx");

  for (const label of [
    "Open Ask AI", "LOCAL TRANSCRIPT AI", "AI History", "New conversation",
    "Choose up to 3 transcripts", "AI is working…", "Recording question",
    "Ask about the selected transcripts...",
  ]) {
    assert.ok(copy.includes(label), `missing localized Ask AI copy: ${label}`);
  }

  assert.match(screen, /title: tr\("Ask AI"\)/);
  assert.match(screen, /tr\("Ask about up to three transcripts\. Answers use only the selected note content\."\)/);
  assert.match(screen, /label=\{tr\("History"\)\}/);
  assert.match(screen, /tr\("Based on"\)/);
  assert.match(screen, /contextLabel\(state\.selectedNotes, tr\)/);
  assert.match(screen, /label=\{tr\("Change"\)\}/);
  assert.match(screen, /tr\("Start with a question about the selected transcript\."\)/);
  assert.match(screen, /placeholder=\{tr\("Ask about the selected transcripts\.\.\."\)\}/);
  assert.match(screen, /label=\{tr\("Mic"\)\}/);
  assert.match(floatingButton, /accessibilityLabel=\{tr\("Open Ask AI"\)\}/);

  for (const translation of [
    "本地转写 AI", "可针对最多三篇转写提问，回答仅使用所选笔记的内容。",
    "历史记录", "依据", "更改", "先针对所选转写提出一个问题。",
    "针对所选转写提问……", "麦克风", "发送", "已选择",
  ]) {
    assert.ok(copy.includes(translation), `missing Chinese Ask AI translation: ${translation}`);
  }
});
