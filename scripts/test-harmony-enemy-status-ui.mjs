import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { STATUS_DEFINITIONS } from "../games/harmony/statuses.js";
import { enemyIntentPlayerEffectsHtml } from "../games/harmony/enemy-status-ui.js";

// The intent UI describes statuses the enemy is about to apply to the player.
let markup = enemyIntentPlayerEffectsHtml(
  { applyPlayer: { burning: 3 } },
  STATUS_DEFINITIONS,
);
assert.match(markup, /intent-effect-row/);
assert.match(markup, /data-intent-status-id="burning"/);
assert.match(markup, />연소<\/b><strong>3<\/strong>/);
assert.match(markup, /플레이어에게 연소 3중첩 부여/);
assert.doesNotMatch(markup, /enemy-status-rail/, "planned player status is not current enemy status UI");

// Object values preserve the distinction between stack count and duration.
markup = enemyIntentPlayerEffectsHtml(
  { applyPlayer: { bind: { stacks: 1, turns: 2 } } },
  STATUS_DEFINITIONS,
);
assert.match(markup, />속박<\/b><strong>1<\/strong><em>2턴<\/em>/);
assert.match(markup, /속박 1중첩 · 2턴 부여/);

// Future multi-status actions remain compact and support +N overflow.
markup = enemyIntentPlayerEffectsHtml(
  {
    applyPlayer: {
      burning: 3,
      vulnerable: 1,
      poison: 4,
      bleed: 2,
    },
  },
  STATUS_DEFINITIONS,
);
assert.equal((markup.match(/data-intent-status-id=/g) || []).length, 2);
assert.match(markup, /intent-effect-more/);
assert.match(markup, />\+2<\/strong>/);
assert.match(markup, /중독 4중첩/);
assert.match(markup, /출혈 2중첩/);

markup = enemyIntentPlayerEffectsHtml(
  { applyPlayer: { burning: 3, vulnerable: 1, poison: 4 } },
  STATUS_DEFINITIONS,
  { maxVisible: 1 },
);
assert.equal((markup.match(/data-intent-status-id=/g) || []).length, 1);
assert.match(markup, />\+2<\/strong>/, "three-enemy intent can collapse planned statuses to one chip plus overflow");

assert.equal(
  enemyIntentPlayerEffectsHtml({ applySelf: { burning: 3 } }, STATUS_DEFINITIONS),
  "",
  "self statuses must never be rendered as player-bound intent effects",
);
assert.equal(
  enemyIntentPlayerEffectsHtml({ applyAllies: { regeneration: 3 } }, STATUS_DEFINITIONS),
  "",
  "ally statuses must never be rendered as player-bound intent effects",
);

const longDefinitions = {
  ...STATUS_DEFINITIONS,
  longStatus: {
    name: "아주긴플레이어상태이상이름",
    icon: "※",
    color: "#c79bd8",
    kind: "debuff",
    description: "긴 상태 이름 레이아웃 검증용",
  },
};
markup = enemyIntentPlayerEffectsHtml(
  { applyPlayer: { longStatus: 2 } },
  longDefinitions,
);
assert.match(markup, /아주긴플레이어상태이상이름<\/b><strong>2<\/strong>/);
assert.match(markup, /title="플레이어에게 아주긴플레이어상태이상이름 2중첩 부여/);

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8"),
  finishJs = await readFile(new URL("../games/harmony/combat-layout-phase2-finish.js", import.meta.url), "utf8"),
  finishCss = await readFile(new URL("../games/harmony/combat-layout-phase2-finish.css", import.meta.url), "utf8"),
  lateUi = await readFile(new URL("../games/harmony/late-game-ui.js", import.meta.url), "utf8"),
  lateFix = await readFile(new URL("../games/harmony/late-game-ui-fix.css", import.meta.url), "utf8"),
  styles = await readFile(new URL("../games/harmony/styles.css", import.meta.url), "utf8"),
  mobileUi = await readFile(new URL("../games/harmony/mobile-battle-ui.js", import.meta.url), "utf8");

// Current enemy statuses are restored to the lower-left STATUS rail.
assert.match(main, /\$\{statusList\(enemy, `\$\{enemy\.name\} 상태`\)\}/);
assert.match(finishJs, /enemy-status-rail/);
assert.match(finishJs, /status-chip/);
assert.match(finishCss, /> \.enemy-status-rail\s*\{[\s\S]*?grid-column:\s*1;/s);
assert.match(finishCss, /> \.enemy-defense-rail\s*\{[\s\S]*?grid-column:\s*3;/s);
assert.match(mobileUi, /statusList\.className = `status-list/);

// Top structure is restored: action + pattern, optionally mechanic.
assert.match(lateUi, /box\.className = "late-pattern-preview"/);
assert.match(lateUi, /button\.className = "late-mechanic-button"/);
assert.doesNotMatch(lateUi, /late-enemy-summary/, "merged pattern/mechanic block must stay removed");
assert.match(lateFix, /> \.intent-wrap[\s\S]*?width:\s*47%\s*!important/s);
assert.match(lateFix, /> \.late-pattern-preview[\s\S]*?width:\s*30%\s*!important/s);
assert.match(lateFix, /> \.late-mechanic-button[\s\S]*?width:\s*18%\s*!important/s);
assert.match(lateFix, /:not\(:has\(> \.late-mechanic-button\)\):has\(> \.late-pattern-preview\)[\s\S]*?width:\s*60%\s*!important/s);

// Planned player effects are visible chips inside next action, never current-status chips.
assert.match(main, /maxVisible: visibleEnemies\.length >= 3 \? 1 : 2/);
assert.match(main, /class="intent-copy"><strong>\$\{display\.label\}<\/strong>\$\{secondary\}<\/span>[\s\S]*?\$\{playerEffects\}<\/div>/);
assert.match(styles, /\.enemies-field \.intent-effect-chip\s*\{[\s\S]*?height:\s*21px;[\s\S]*?font-size:\s*10\.5px;/s);
assert.match(
  finishCss,
  /\.enemy\[data-enemy-card-ui="1"\] > \.intent-wrap > \.intent \{[\s\S]*?height:\s*32px;[\s\S]*?min-height:\s*32px;/s,
  "compact intents without planned statuses keep the 32px height",
);
assert.match(
  finishCss,
  /\.enemy\[data-enemy-card-ui="1"\] > \.intent-wrap > \.intent:has\(> \.intent-effect-row\) \{[\s\S]*?height:\s*auto;[\s\S]*?min-height:\s*52px;/s,
  "planned-status intents escape the 32px fixed-height constraint",
);
assert.match(
  lateFix,
  /\.enemy\[data-enemy-card-ui="1"\] > \.intent-wrap:has\(> \.intent > \.intent-effect-row\) \{[\s\S]*?height:\s*63px !important;[\s\S]*?grid-template-rows:\s*9px 52px !important;/s,
  "late-game top bar expands only the intent slot when planned statuses exist",
);
assert.match(
  lateFix,
  /\.enemy\[data-enemy-card-ui="1"\] > \.intent-wrap > \.intent:has\(> \.intent-effect-row\) \{[\s\S]*?height:\s*52px !important;[\s\S]*?max-height:\s*52px !important;/s,
  "late-game important height override cannot collapse the two-row intent",
);
assert.match(
  styles,
  /\.enemies-field \.intent:has\(> \.intent-effect-row\) > \.intent-icon,[\s\S]*?\.intent-value \{\s*grid-row:\s*1;/s,
  "icon, action copy, and damage value remain on the first intent row",
);
assert.doesNotMatch(styles, /\.enemy > \.status-list\s*\{\s*display:\s*none/s);

console.log("PASS Harmony enemy intent status UI: player-bound planned effects are readable chips while current enemy statuses stay in the restored lower rail layout.");
