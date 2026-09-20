import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const modalSource = await readFile(new URL("../games/harmony/harmony-confirm-ui.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const actionSource = await readFile(new URL("../games/harmony/game-action-orchestrator.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../games/harmony/styles.css", import.meta.url), "utf8");

assert.match(modalSource, /createHarmonyConfirmUi/);
assert.match(modalSource, /aria-labelledby/);
assert.match(modalSource, /aria-describedby/);
assert.match(modalSource, /modal\.showModal\(\)/);
assert.match(modalSource, /primary\.focus\?\.\(\)/, "primary action should receive focus when the modal opens");
assert.match(modalSource, /focusTarget\?\.focus\?\.\(\)/, "closing the modal should restore trigger focus");
assert.match(modalSource, /event\.target === dialog/, "backdrop click should follow Harmony dialog close behavior");
assert.match(modalSource, /primary\.disabled = true/, "primary action should lock after confirmation");
assert.match(modalSource, /data-harmony-confirm-cancel/);
assert.match(modalSource, /data-harmony-confirm-close/);

assert.doesNotMatch(mainSource, /\b(?:window\.)?confirm\s*\(/, "journey entry must not use browser confirm");
assert.doesNotMatch(mainSource, /\b(?:window\.)?alert\s*\(/, "journey entry must not use browser alert");
assert.doesNotMatch(actionSource, /\b(?:window\.)?confirm\s*\(/);
assert.doesNotMatch(actionSource, /\b(?:window\.)?alert\s*\(/);

assert.match(mainSource, /title:\s*"새로운 여정을 시작할까요\?"/);
assert.match(mainSource, /title:\s*"LOCAL · 카드 테스트 모드"/);
assert.match(mainSource, /primaryLabel:\s*"덱 구성하기 →"/);
assert.match(mainSource, /현재 진행은 종료되고 새 여정으로 전환됩니다/);
assert.match(actionSource, /if \(testMode \|\| hasActiveRun\)/, "normal new journey should skip confirmation when no active run exists");
assert.match(actionSource, /runEntryPending/, "entry flow should prevent rapid duplicate execution");

assert.match(styles, /\.harmony-confirm-dialog\s*\{[\s\S]*?width:min\(520px,calc\(100vw - 32px\)\)/);
assert.match(styles, /@media \(max-width:560px\)[\s\S]*?\.harmony-confirm-dialog/);
assert.match(styles, /\.harmony-confirm-actions[\s\S]*?justify-content:flex-end/);

console.log("PASS Harmony journey confirm modal contracts.");
