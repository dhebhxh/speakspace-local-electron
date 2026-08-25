import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const servicePath = new URL("../src/services/speech-playback-service.ts", import.meta.url);
const buttonPath = new URL("../src/components/speech-playback-button.tsx", import.meta.url);
const notePath = new URL("../src/app/notes/[noteId].tsx", import.meta.url);

test("speech playback uses cancellable streaming TTS with serialized lifecycle", async () => {
  const source = await readFile(servicePath, "utf8");

  assert.match(source, /createStreamingTTS/);
  assert.match(source, /generateSpeechStream/);
  assert.match(source, /writePcmChunk/);
  assert.match(source, /cancelSpeechStream/);
  assert.match(source, /stopPcmPlayer/);
  assert.match(source, /engine\.destroy\(\)/);
  assert.match(source, /lifecycleChain/);
  assert.match(source, /interruptPromise/);
  assert.match(source, /session\.interruptPromise \?\? this\.interruptEngine\(engine\)/);
  assert.match(source, /if \(session\.streamStarted\) await session\.streamEnded/);
  assert.match(source, /session\.resolveStreamEnded\(\)/);
  assert.match(source, /if \(!this\.isCurrent\(session\)\) session\.interruptPromise = this\.interruptEngine\(engine\)/);
  assert.doesNotMatch(source, /createTTS\(/);
  assert.doesNotMatch(source, /public async pause/);
  assert.doesNotMatch(source, /public async resume/);
});

test("speech button only exposes start and stop semantics", async () => {
  const source = await readFile(buttonPath, "utf8");

  assert.match(source, /"Stop"/);
  assert.match(source, /"Read aloud"/);
  assert.doesNotMatch(source, /"Pause"/);
  assert.doesNotMatch(source, /"Resume"/);
});

test("leaving note detail stops the global TTS session", async () => {
  const source = await readFile(notePath, "utf8");

  assert.match(source, /useEffect\(\(\) => \(\) => \{/);
  assert.match(source, /speechPlaybackService\.stop\(\)/);
});
