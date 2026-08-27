import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourcePath = new URL("../src/app/transcription.tsx", import.meta.url);
const editorModalPath = new URL(
  "../src/components/safe-area-modal.tsx",
  import.meta.url,
);

test("empty live transcription cannot enter an unsavable modal", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /result\.transcript\.trim\(\)\.length === 0/);
  assert.match(source, /No speech detected/);
  assert.match(source, /Discard recording/);
});

test("Finish opens the save modal directly without a redundant confirmation", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /const result = await transcriptionService\.finish\(\);[\s\S]*void prepareSave\(result\);/);
  assert.doesNotMatch(source, /Finish transcription\?/);
  assert.doesNotMatch(source, /text: "Save", onPress: \(\) => void prepareSave\(result\)/);
});

test("finished transcription modal exposes a confirmed discard exit", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /onRequestClose=\{confirmDiscardFinishedSession\}/);
  assert.match(source, /<ModalCloseButton[\s\S]*label="Close save transcription"[\s\S]*onPress=\{confirmDiscardFinishedSession\}/);
  assert.doesNotMatch(source, />Discard<\/Text>/);
  assert.match(source, /This permanently deletes the finished recording and transcript/);
});

test("finished transcription receives a local automatic title without overwriting edits", async () => {
  const [source, container] = await Promise.all([
    readFile(sourcePath, "utf8"),
    readFile(new URL("../src/application/app-container.ts", import.meta.url), "utf8"),
  ]);

  assert.match(source, /createDefaultNoteTitle\(\)/);
  assert.match(source, /noteTitleGenerationService\.generate\(result\.transcript\)/);
  assert.match(source, /noteNameEditedRef\.current/);
  assert.match(source, /Generating a title locally/);
  assert.match(container, /new NoteTitleGenerationService\(/);
});

test("finished transcription modal centers its card inside the safe area", async () => {
  const [source, editorModal] = await Promise.all([
    readFile(sourcePath, "utf8"),
    readFile(editorModalPath, "utf8"),
  ]);

  assert.match(source, /<SafeAreaModal[\s\S]*androidPresentation="center"/);
  assert.doesNotMatch(source, /autoFocus/);
  assert.match(editorModal, /paddingTop: Spacing\.lg \+ insets\.top/);
  assert.match(editorModal, /paddingBottom: Spacing\.lg \+ insets\.bottom/);
  assert.match(editorModal, /centeredDismissArea:[\s\S]*justifyContent: "center"/);
  assert.match(editorModal, /accessibilityViewIsModal/);
});
