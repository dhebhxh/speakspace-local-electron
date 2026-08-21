import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourcePath = new URL("../src/app/transcription.tsx", import.meta.url);

test("empty live transcription cannot enter an unsavable modal", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /result\.transcript\.trim\(\)\.length === 0/);
  assert.match(source, /No speech detected/);
  assert.match(source, /Discard recording/);
});

test("finished transcription modal exposes a confirmed discard exit", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /onRequestClose=\{confirmDiscardFinishedSession\}/);
  assert.match(source, /accessibilityLabel="Discard recording"/);
  assert.match(source, /This permanently deletes the finished recording and transcript/);
});

test("finished transcription modal centers its card inside the safe area", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(
    source,
    /contentContainerStyle=\{\[\s*styles\.modalViewport,/,
  );
  assert.match(source, /paddingTop: Spacing\.lg \+ insets\.top/);
  assert.match(source, /paddingBottom: Spacing\.lg \+ insets\.bottom/);
  assert.match(
    source,
    /modalViewport:\s*\{[^}]*flexGrow: 1,[^}]*justifyContent: "center"/s,
  );
  assert.match(
    source,
    /<View\s+accessibilityViewIsModal\s+style=\{\[\s*styles\.modal,/,
  );
});
