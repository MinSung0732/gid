import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { STATUS_DEFINITIONS } from "../games/harmony/statuses.js";
import {
  enemyStatusSummaryHtml,
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

let markup = enemyStatusSummaryHtml(enemy, STATUS_DEFINITIONS, 1, "테스트 상태");
assert.equal((markup.match(/enemy-status-compact/g) || []).length, 4);
assert.match(markup, /enemy-status-overflow/);
assert.match(markup, />\+1<\/b>/);
assert.match(markup, /data-status-id="burning"/);
assert.match(markup, /<b>3<\/b>/);
assert.doesNotMatch(markup, />연소 3</, "long status names are not visible in the compact header");

markup = enemyStatusSummaryHtml(enemy, STATUS_DEFINITIONS, 3, "테스트 상태");
assert.equal((markup.match(/enemy-status-compact/g) || []).length, 2);
assert.match(markup, />\+3<\/b>/, "three-enemy layout reduces count instead of badge size");
assert.match(markup, /추가 상태 3개/);
assert.match(markup, /취약/);
assert.match(markup, /출혈/);
assert.match(markup, /재생/);

assert.equal(enemyStatusSummaryHtml({ statuses: {} }, STATUS_DEFINITIONS, 3), "");

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8"),
  supportCss = await readFile(new URL("../games/harmony/player-support-ui.css", import.meta.url), "utf8"),
  desktopPolish = await readFile(new URL("../games/harmony/combat-layout-phase2-finish.js", import.meta.url), "utf8"),
  mobileUi = await readFile(new URL("../games/harmony/mobile-battle-ui.js", import.meta.url), "utf8");

assert.match(main, /enemyStatusSummaryHtml\(/);
assert.match(main, /class="intent-heading"/);
assert.doesNotMatch(main, /\$\{statusList\(enemy, `\$\{enemy\.name\} 상태`\)\}/, "enemy status row is removed from card body");
assert.match(supportCss, /\.enemy-status-summary > \.status-chip[\s\S]*?height:\s*20px/);
assert.doesNotMatch(supportCss, /\.enemies-field \.enemy > \.status-list\s*\{[\s\S]*?display:\s*flex\s*!important/);
assert.doesNotMatch(desktopPolish, /enemy-status-rail/, "desktop polish no longer moves statuses into a side rail");
assert.doesNotMatch(mobileUi, /statusList\.className = `status-list/, "mobile restore no longer recreates a vertical enemy status list");

console.log("PASS Harmony enemy status header: fixed-size badges, encounter-count compression, overflow tooltip, and no vertical enemy status row.");
