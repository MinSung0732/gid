import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as E from "../games/harmony/engine.js";
import { CARDS, ITEMS } from "../games/harmony/data.js";
import { STATUS_DEFINITIONS } from "../games/harmony/statuses.js";
import { createCardPresentation } from "../games/harmony/card-presentation.js";
import { formatStatusKeywords } from "../games/harmony/status-text.js";

const handCss = await readFile(new URL("../games/harmony/card-hand-ui.css", import.meta.url), "utf8");
const rewardCss = await readFile(new URL("../games/harmony/reward-card-layout.css", import.meta.url), "utf8");
const stylesCss = await readFile(new URL("../games/harmony/styles.css", import.meta.url), "utf8");
const lateGameUiFixCss = await readFile(new URL("../games/harmony/late-game-ui-fix.css", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");

const presentation = createCardPresentation({
  engine: E,
  cards: CARDS,
  statusDefinitions: STATUS_DEFINITIONS,
  getRun: () => E.newRun(9041),
  getStarted: () => false,
  tierStars: () => "",
});

// 1) Multi-hit count is structural damage information, not a separate summary row/cell.
const multiHit = presentation.compactCardEffectSummary({ id: "contact_fierce_rub", level: 0 });
assert.deepEqual(multiHit.rows.map((entry) => entry.text), ["피해 3 ×3"]);
assert.match(
  multiHit.body,
  /<span class="card-summary-row">피해 <b>3<\/b> <b>×3<\/b><\/span>/,
  "damage and inherent hit count stay in one summary row",
);
const handRowRule = handCss.match(/\.card-effect-compact > \.card-summary-row \{([\s\S]*?)\n  \}/)?.[1] || "";
assert.match(handRowRule, /display:\s*block/, "battle hand rows use inline text flow inside one row");
assert.doesNotMatch(handRowRule, /grid-template-columns/, "battle hand rows must not split bold values into grid cells");

// 2) Reward cards own their fixed sizing without changing the shared .card surface.
assert.match(rewardCss, /\.card-reward-choices > \.reward-offer-card \{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/);
assert.match(rewardCss, /\.card-reward-choices > \.reward-offer-card > \.card \{[\s\S]*?height:\s*311px;[\s\S]*?min-height:\s*311px;[\s\S]*?max-height:\s*311px;/);
assert.match(rewardCss, /grid-template-rows:\s*38px 72px 68px minmax\(0, 1fr\)/);
assert.doesNotMatch(rewardCss, /(^|\n)\.card\s*\{[\s\S]*?height:\s*311px/m, "reward fix must stay scoped to reward cards");

// 3) New active-card detail copy uses the same status definitions/colors as existing detail UI.
const activeDetail = presentation.cardEffectText(
  { id: "noncontact_compound_vapor_recovery", level: 0 },
  true,
);
for (const id of ["burning", "poison", "corrosion", "bleed"]) {
  const status = STATUS_DEFINITIONS[id];
  assert.ok(
    activeDetail.includes(`<span class="detail-status" style="--detail-status-color:${status.color}">${status.name}</span>`),
    `${status.name} should use its existing Harmony status color in active-card details`,
  );
}
assert.doesNotMatch(
  activeDetail,
  /<span\b[^>]*class=(['"])[^'"]*\bdetail-status\b[^'"]*\1[^>]*>\s*<span\b[^>]*class=(['"])[^'"]*\bdetail-status\b[^'"]*\2/i,
  "shared status formatting must not nest detail-status markup",
);

// Stat / trait / relic descriptions all share the same keyword formatter.
for (const [itemId, statusId] of [
  ["stat_corrosive_catalyst", "corrosion"],
  ["trait_friction_spark", "burning"],
  ["relic_resonance_capture_flask", "resonance"],
]) {
  const item = ITEMS[itemId], status = STATUS_DEFINITIONS[statusId];
  const formatted = formatStatusKeywords(item.description, STATUS_DEFINITIONS);
  assert.ok(
    formatted.includes(`<span class="detail-status" style="--detail-status-color:${status.color}">${status.name}</span>`),
    `${item.kind} detail should color ${status.name} from STATUS_DEFINITIONS`,
  );
}
assert.match(mainSource, /formatStatusKeywords\(text, STATUS_DEFINITIONS\)/, "item details should use the shared status keyword formatter");
assert.match(stylesCss, /\.item-effect-tooltip \.detail-status/, "item detail status markup should inherit the shared status color variable");



assert.match(
  mainSource,
  /run\.phase === "battle" \? playerEffectsRow\("side"\) : hasPlayerStatuses\(\) \? playerStatusRow\("side"\) : ""/,
  "carried player statuses remain visible in the side panel outside combat",
);
assert.match(
  mainSource,
  /function playerStatusRow\(location = "side"\)[\s\S]*?statusList\(run, "플레이어 상태"\)/,
  "non-combat status visibility reuses the canonical player status renderer",
);
assert.match(
  stylesCss,
  /\.card-compact-status \.card-effect-compact > span > \.card-value-modifier\.positive \{[\s\S]*?color:\s*var\(--color-positive\)\s*!important;[\s\S]*?opacity:\s*1;/,
  "positive runtime card modifiers stay green inside compact summaries",
);
assert.match(
  stylesCss,
  /\.card-compact-status \.card-effect-compact > span > \.card-value-modifier\.negative \{[\s\S]*?color:\s*#d94141\s*!important;[\s\S]*?opacity:\s*1;/,
  "negative runtime card modifiers stay red inside compact summaries",
);


// 4) Discard-choice card headers keep a fixed action slot and a separate right-side meta area.
assert.match(
  stylesCss,
  /\.hand-discard-choice \.card \.card-top \{[\s\S]*?grid-template-columns:\s*50px minmax\(0,1fr\);[\s\S]*?grid-template-rows:\s*20px 14px;[\s\S]*?column-gap:\s*8px;/,
  "discard-choice headers reserve a stable left action column and right meta column",
);
assert.match(
  stylesCss,
  /\.card-discard-action \{[\s\S]*?width:\s*50px;[\s\S]*?height:\s*20px;[\s\S]*?padding:\s*0 7px;[\s\S]*?border-radius:\s*6px;[\s\S]*?background:\s*#8f4638;/,
  "discard action has one compact size and muted brick-red treatment",
);
assert.match(
  stylesCss,
  /\.hand-discard-choice \.card \.card-meta \{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*1 \/ span 2;[\s\S]*?justify-content:\s*end;/,
  "discard metadata stays in the right-side header region",
);
assert.match(
  stylesCss,
  /\.hand-discard-choice \.card \.card-tier-stars \{[\s\S]*?position:\s*static;[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*2;/,
  "tier stars use the fixed second-row slot instead of overlapping header metadata",
);


// Enemy death presentation keeps engine indices while hiding dead records from the panel/turn order.
assert.match(
  mainSource,
  /visibleEnemies = b\.enemies[\s\S]*?\.map\(\(enemy, index\) => \(\{ enemy, index \}\)\)[\s\S]*?\.filter\(\(\{ enemy \}\) => enemy\.hp > 0\)/,
  "enemy presentation list filters dead records without renumbering engine indices",
);
assert.match(
  mainSource,
  /maxVisible:\s*visibleEnemies\.length >= 3 \? 1 : 2/,
  "intent status visibility follows visible living panel count",
);
assert.match(
  mainSource,
  /field = `<div class="enemies-field enemies-\$\{visibleEnemies\.length\}">\$\{visibleEnemies[\s\S]*?\.map\(\(\{ enemy, index \}\) =>/,
  "enemy layout class and cards use living visible enemies while preserving original indices",
);
assert.match(
  mainSource,
  /await new Promise\(\(resolve\) => setTimeout\(resolve, 760\)\);[\s\S]*?enemy\.remove\(\);[\s\S]*?syncVisibleEnemyFieldCount/,
  "monster panel is removed only after the death animation delay",
);
assert.match(
  stylesCss,
  /\.monster-dying > \.enemy-status-rail[\s\S]*?\.monster-dying > \.enemy-defense-rail[\s\S]*?animation:\s*monster-death 0\.75s/,
  "restored enemy rails participate in the existing death animation",
);

// Next-action status chips remain compact but readable, including the late-game desktop override.
assert.match(
  stylesCss,
  /\.enemies-field \.intent-effect-chip \{[\s\S]*?height:\s*21px;[\s\S]*?font-size:\s*10\.5px;/,
  "base intent effect chips use the readable 21px/10.5px sizing",
);
assert.match(
  stylesCss,
  /\.enemies-field \.intent-effect-chip > i \{[\s\S]*?font-size:\s*11px;/,
  "intent effect icons stay legible",
);
assert.match(
  stylesCss,
  /\.enemies-field \.intent-effect-chip > b \{[\s\S]*?font-size:\s*10\.5px;/,
  "intent effect status names stay legible",
);
assert.match(
  stylesCss,
  /\.enemies-field \.intent-effect-chip > strong \{[\s\S]*?font-size:\s*11px;/,
  "intent effect stack values stay legible",
);
assert.match(
  lateGameUiFixCss,
  /\.enemy\[data-enemy-card-ui="1"\] \.intent-effect-chip \{[\s\S]*?height:\s*21px !important;[\s\S]*?font-size:\s*10\.5px !important;/,
  "late-game desktop override does not shrink intent status chips back to 8px",
);

console.log("PASS Harmony UI regressions: enemy death panel lifecycle, living enemy layout count, intent chip readability, persistent status visibility, runtime modifier colors, inline multi-hit summary, fixed reward-card height, shared status colors in augment details, compact discard header alignment.");
