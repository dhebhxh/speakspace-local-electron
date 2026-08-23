import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourcePath = new URL(
  "../src/app/workspaces/index.tsx",
  import.meta.url,
);

test("new workspace form is a safe-area-aware centered dialog", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /styles\.modalViewport/);
  assert.match(source, /paddingTop: Spacing\.lg \+ insets\.top/);
  assert.match(source, /paddingBottom: Spacing\.lg \+ insets\.bottom/);
  assert.match(source, /accessibilityViewIsModal/);
  assert.match(source, /modalViewport: \{ flexGrow: 1, justifyContent: "center"/);
  assert.match(source, /modal: \{[\s\S]*borderRadius: Radius\.lg/);
  assert.doesNotMatch(
    source,
    /modalBackdrop: \{[\s\S]*?justifyContent: "flex-end"[\s\S]*?\},/,
  );
});
