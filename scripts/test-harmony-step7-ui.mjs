import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("games/harmony/index.html", "utf8"),
  codex = fs.readFileSync("games/harmony/codex-ui.js", "utf8"),
  patch = fs.readFileSync("games/harmony/patch-notes-ui.js", "utf8"),
  version = fs.readFileSync("games/harmony/version.js", "utf8"),
  main = fs.readFileSync("games/harmony/main.js", "utf8"),
  styles = fs.readFileSync("games/harmony/styles.css", "utf8");

for (const id of ["version-toggle", "patch-notes", "patch-notes-toggle", "codex-search"])
  assert.match(html, new RegExp(`id=["']${id}["']`));
for (const label of ["카드", "아이템", "적", "상태", "기본 용어", "중첩·표시형", "지속 턴형", "행동 제한형"])
  assert.ok(codex.includes(label), `missing codex label: ${label}`);
assert.ok(codex.includes("handleCodexInput"));
assert.ok(patch.includes("GAME_VERSION"));
assert.match(version, /GAME_VERSION\s*=\s*"0\.3\.0"/, "Harmony game version should match the latest patch note");
assert.match(html, /id="settings-game-version">v0\.3\.0<\/b>/, "settings fallback version should match GAME_VERSION");
for (const note of [
  'version: "0.3.0"',
  "134종",
  "mechanic metadata",
  "#65D68A",
  "공명 연쇄붕괴",
  "사망 애니메이션",
  "새로고침",
  "LOCAL CARD LAB",
  "도전과제",
  "Supabase",
  "2026.09.20",
])
  assert.ok(patch.includes(note), `missing v0.3.0 patch note: ${note}`);
for (const legacyVersion of ['version: "0.2.0"', 'version: "0.1.0"'])
  assert.ok(patch.includes(legacyVersion), `missing retained patch history: ${legacyVersion}`);
assert.ok(main.includes("createPatchNotesUi();"));
assert.ok(main.includes("result-build-panel"));
assert.ok(styles.includes("body:has(dialog[open])"));
assert.ok(!main.includes("MutationObserver"));
assert.ok(!patch.includes("MutationObserver"));
assert.ok(!codex.includes("MutationObserver"));
console.log("PASS Harmony Step 7 static UI contracts.");
