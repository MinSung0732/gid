import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { STATUS_DEFINITIONS } from "../games/harmony/statuses.js";
import {
  enemyStatusPanelHtml,
  enemyStatusVisibleLimit,
} from "../games/harmony/enemy-status-ui.js";

const enemy = {
  statuses: {
    burning: { stacks: 3 },
    poison: { stacks: 2 },
    vulnerable: { stacks: 1 },
    bleed: { stacks: 2 },
    regeneration: { stacks: 4, turns: 2 },
  },
};

assert.equal(enemyStatusVisibleLimit(1), 4);
assert.equal(enemyStatusVisibleLimit(2), 3);
assert.equal(enemyStatusVisibleLimit(3), 2);
assert.equal(enemyStatusVisibleLimit(5), 2);

let markup = enemyStatusPanelHtml(
  { statuses: { burning: { stacks: 3 } } },
  STATUS_DEFINITIONS,
  1,
  "단일 상태이상",
);
assert.equal((markup.match(/enemy-status-compact/g) || []).length, 1);
assert.match(markup, /enemy-status-name">연소<\/span><b>3<\/b>/, "one status remains immediately readable");
assert.doesNotMatch(markup, /enemy-status-overflow/);

markup = enemyStatusPanelHtml(enemy, STATUS_DEFINITIONS, 1, "테스트 상태이상");
assert.match(markup, /class="enemy-info-panel enemy-status-panel/);
assert.match(markup, />상태이상<\/span>/, "status panel has its own visible section label");
assert.equal((markup.match(/enemy-status-compact/g) || []).length, 4);
assert.match(markup, /enemy-status-overflow/);
assert.match(markup, />\+1<\/b>/);
assert.match(markup, /data-status-id="burning"/);
assert.match(markup, /enemy-status-name">연소<\/span><b>3<\/b>/, "status name and stacks are visible in the panel");

markup = enemyStatusPanelHtml(enemy, STATUS_DEFINITIONS, 2, "테스트 상태이상");
assert.equal((markup.match(/enemy-status-compact/g) || []).length, 3);
assert.match(markup, />\+2<\/b>/);

markup = enemyStatusPanelHtml(enemy, STATUS_DEFINITIONS, 3, "테스트 상태이상");
assert.equal((markup.match(/enemy-status-compact/g) || []).length, 2);
assert.match(markup, />\+3<\/b>/, "three-enemy layout reduces count instead of shrinking/removing status UI");
assert.match(markup, /추가 상태 3개/);
assert.match(markup, /취약/);
assert.match(markup, /출혈/);
assert.match(markup, /재생/);

markup = enemyStatusPanelHtml({ statuses: {} }, STATUS_DEFINITIONS, 3, "빈 상태이상");
assert.match(markup, /enemy-status-panel-empty/);
assert.match(markup, /enemy-status-empty">없음<\/span>/, "status section remains visible even when empty");

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8"),
  supportCss = await readFile(new URL("../games/harmony/player-support-ui.css", import.meta.url), "utf8"),
  lateCss = await readFile(new URL("../games/harmony/late-game-ui-fix.css", import.meta.url), "utf8"),
  lateUi = await readFile(new URL("../games/harmony/late-game-ui.js", import.meta.url), "utf8"),
  desktopPolish = await readFile(new URL("../games/harmony/combat-layout-phase2-finish.js", import.meta.url), "utf8"),
  mobileCss = await readFile(new URL("../games/harmony/mobile-battle-ui.css", import.meta.url), "utf8"),
  mobileUi = await readFile(new URL("../games/harmony/mobile-battle-ui.js", import.meta.url), "utf8");

assert.match(main, /enemyStatusPanelHtml\(/);
assert.doesNotMatch(main, /class="intent-heading"/, "statuses no longer live inside the next-action heading");
assert.match(main, /class="intent-wrap enemy-info-panel enemy-action-panel"/);
assert.doesNotMatch(main, /intent-copy"><strong>\$\{display\.label\}<\/strong>\$\{display\.detail/, "action block does not render status/detail prose as small subtext");
assert.match(main, /\$\{intentHtml\(enemy\)\}\$\{statusPanel\}/, "status panel is a direct sibling after next action");
assert.doesNotMatch(main, /\$\{statusList\(enemy, `\$\{enemy\.name\} 상태`\)\}/, "legacy vertical status-list is not duplicated");

assert.match(supportCss, /\.enemy-status-panel\s*\{[\s\S]*?min-height:\s*47px;/s);
assert.match(supportCss, /\.enemy-status-summary\s*\{[\s\S]*?display:\s*flex;/s);
assert.match(supportCss, /\.enemy-status-summary > \.status-chip[\s\S]*?height:\s*27px;/s);
assert.match(supportCss, /\.enemy-status-name[\s\S]*?font-size:\s*10px;/s);
assert.match(lateCss, /> \.intent-wrap[\s\S]*?grid-row:\s*1\s*!important/);
assert.match(lateCss, /> \.enemy-status-panel[\s\S]*?grid-row:\s*2\s*!important/);
assert.match(lateCss, /> \.late-enemy-summary[\s\S]*?grid-row:\s*3\s*!important/);
assert.match(lateUi, /label\.textContent = "패턴 \/ 기믹"/);
assert.match(lateUi, /empty\.textContent = "정보 없음"/, "third section remains visible without pattern/mechanic data");
assert.match(lateUi, /enemy-status-panel/);
assert.doesNotMatch(desktopPolish, /enemy-status-rail/, "desktop polish does not move statuses away from the dedicated panel");
assert.match(mobileCss, /mobile-battle-active \.enemy-status-panel/);
assert.doesNotMatch(mobileUi, /statusList\.className = `status-list/, "mobile restore does not recreate a legacy status row");

console.log("PASS Harmony enemy information UI: independent action/status/pattern blocks, visible status names/stacks, 1/2/3 enemy compression, and no action-subtext status regression.");
