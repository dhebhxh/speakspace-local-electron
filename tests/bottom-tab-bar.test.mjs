import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourcePath = new URL("../src/app/(tabs)/_layout.tsx", import.meta.url);

test("bottom tabs use the requested dashboard, folder, and cube icons", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /name="rectangle\.grid\.2x2"/);
  assert.match(source, /name="folder"/);
  assert.match(source, /name="cube"/);
  assert.match(source, /import \{ SymbolView/);
});

test("bottom tabs stay above the iPhone home indicator", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /useSafeAreaInsets\(\)/);
  assert.match(source, /const bottomInset = Math\.max\(insets\.bottom, 8\)/);
  assert.match(source, /height: 56 \+ bottomInset/);
  assert.match(source, /paddingBottom: bottomInset \+ 2/);
});
