import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("games/harmony/index.html", "utf8"),
  codex = fs.readFileSync("games/harmony/codex-ui.js", "utf8"),
  patch = fs.readFileSync("games/harmony/patch-notes-ui.js", "utf8"),
  main = fs.readFileSync("games/harmony/main.js", "utf8"),
  styles = fs.readFileSync("games/harmony/styles.css", "utf8");

for (const id of ["version-toggle", "patch-notes", "patch-notes-toggle", "codex-search"])
  assert.match(html, new RegExp(`id=["']${id}["']`));
for (const label of ["카드", "아이템", "적", "상태", "기본 용어", "중첩·표시형", "지속 턴형", "행동 제한형"])
  assert.ok(codex.includes(label), `missing codex label: ${label}`);
assert.ok(codex.includes("handleCodexInput"));
assert.ok(patch.includes("GAME_VERSION"));
for (const note of ["Signature", "덱 빌더", "LOCAL 테스트", "도전과제", "2026.09.20"])
  assert.ok(patch.includes(note), `missing current patch note: ${note}`);
assert.ok(main.includes("createPatchNotesUi();"));
assert.ok(main.includes("result-build-panel"));
assert.ok(styles.includes("body:has(dialog[open])"));
assert.ok(!main.includes("MutationObserver"));
assert.ok(!patch.includes("MutationObserver"));
assert.ok(!codex.includes("MutationObserver"));
console.log("PASS Harmony Step 7 static UI contracts.");
