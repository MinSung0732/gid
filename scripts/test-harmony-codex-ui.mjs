import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const codex = await readFile(new URL("../games/harmony/codex-ui.js", import.meta.url), "utf8");
const codexLayout = await readFile(new URL("../games/harmony/codex-pc-master-detail.css", import.meta.url), "utf8");

assert.match(main, /from "\.\/codex-ui\.js(?:\?v=[^"]+)?"/, "main should consume the codex UI module");
assert.match(
  main,
  /createCodexUi\(\{[\s\S]*?meta[\s\S]*?cardEffectText[\s\S]*?glossaryTermsHtml[\s\S]*?itemHtml[\s\S]*?statusAmountText[\s\S]*?statusGlossaryHtml[\s\S]*?\}\)/,
  "main should inject existing codex rendering dependencies",
);
assert.match(main, /\$\("tools"\)\.addEventListener\("click", handleCodexClick\)/);
assert.doesNotMatch(main, /function codexTabs\(/);
assert.doesNotMatch(main, /function codexCardEntry\(/);
assert.doesNotMatch(main, /function codexItemEntry\(/);
assert.doesNotMatch(main, /function codexIntent\(/);
assert.doesNotMatch(main, /function codexMonsterEntry\(/);
assert.doesNotMatch(main, /function codexProgress\(/);
assert.doesNotMatch(main, /function renderCodex\(/);

for (const marker of [
  "CODEX_AUGMENTS",
  "CODEX_MONSTERS",
  "CODEX_MONSTER_TYPES",
  "codex-progress",
  "codex-major",
  "codex-middle",
  "codex-minor",
  "codex-view",
  "data-codex-level",
]) {
  assert.match(codex, new RegExp(marker), `codex module should preserve ${marker}`);
}
assert.match(codex, /export function createCodexUi\(/);
assert.match(codex, /function handleCodexClick\(event\)/);
assert.match(codex, /function renderCodex\(/);
assert.match(codex, /Object\.hasOwn\(EARLY_MONSTERS, monster\.id\)/);
assert.match(codex, /meta\.discoveredCards/);
assert.match(codex, /meta\.defeatedMonsters/);
assert.match(codex, /from "\.\/late-game-content\.js"/, "codex should consume late-game monster definitions");
for (const act of ["act4", "act5", "act6", "act7"]) {
  assert.match(codex, new RegExp(`\\b${act}: \\{ label:`), `codex should expose ${act}`);
}
assert.match(codex, /ACT7_CODEX_MONSTERS/);
assert.match(codex, /patternName = intent\.name/);
assert.match(codexLayout, /#tools\[open\]/, "codex dialog layout must only override display while open");
assert.match(codexLayout, /#codex-view[\s\S]*?overflow-y:\s*auto/, "codex detail pane should own vertical scrolling");
assert.doesNotMatch(codexLayout, /#tools\s*\{[\s\S]{0,180}?display:\s*grid/, "closed dialog must not be forced visible by author CSS");
assert.match(
  codex,
  /return \{[\s\S]*?handleCodexClick[\s\S]*?renderCodex[\s\S]*?\};/,
  "codex factory should expose only orchestration-facing UI functions",
);

console.log("PASS Harmony codex UI is modular without changing discovery, tabs, or progress contracts.");
