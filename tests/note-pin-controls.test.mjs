import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("single-note pin controls are available from home, search, and note detail", async () => {
  const [home, search, detail] = await Promise.all([
    read("src/app/(tabs)/index.tsx"),
    read("src/app/notes/search.tsx"),
    read("src/app/notes/[noteId].tsx"),
  ]);

  assert.match(home, /onPinPress=\{\(\) => void togglePinned\(note\)\}/);
  assert.match(search, /onPinPress=\{frozenResults === null \? \(\) => void togglePinned\(result\) : undefined\}/);
  assert.match(detail, /label=\{state\.note\.getIsPinned\(\) \? "Unpin note" : "Pin note"\}/);
  for (const screen of [home, search, detail]) assert.match(screen, /setNotePinned\(/);
});

test("the Open tasks card and its note filter share calendar task-note identities", async () => {
  const home = await read("src/app/(tabs)/index.tsx");

  assert.match(home, /const openTaskNoteIds = getOpenTaskNoteIds\(calendarByDate\)/);
  assert.match(home, /openTaskNoteCount: openTaskNoteIds\.size/);
  assert.match(home, /noteFilter === "todos" \? openTaskNoteIds\.has\(note\.getId\(\)\)/);
});
