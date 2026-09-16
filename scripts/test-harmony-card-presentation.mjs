import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as E from "../games/harmony/engine.js";
import { CARDS } from "../games/harmony/data.js";
import { STATUS_DEFINITIONS } from "../games/harmony/statuses.js";
import { createCardPresentation } from "../games/harmony/card-presentation.js";

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const source = await readFile(new URL("../games/harmony/card-presentation.js", import.meta.url), "utf8");
assert.match(main, /from "\.\/card-presentation\.js"/);
assert.match(
  main,
  /createCardPresentation\(\{[\s\S]*?engine:\s*E[\s\S]*?cards:\s*CARDS[\s\S]*?statusDefinitions:\s*STATUS_DEFINITIONS[\s\S]*?getRun:[\s\S]*?getStarted:[\s\S]*?tierStars[\s\S]*?\}\)/s,
);
for (const name of [
  "statusAmountText",
  "cardEffectText",
  "compactCardEffectSummary",
  "cardHtml",
]) {
  assert.doesNotMatch(
    main,
    new RegExp(`function ${name}\\(`),
    `${name} implementation should live outside main.js`,
  );
}
assert.match(source, /engine\.cardDefinition\(card\)/);
assert.match(source, /engine\.cardStatusValueBreakdown\(/);
assert.match(source, /engine\.cardPlayBlockReason\(/);
assert.match(source, /statusDefinitions\[id\]/);

let run = E.newRun(7301);
let started = true;
const tierStars = (tier, className) =>
  `<span class="${className}" aria-label="${tier}티어">${"★".repeat(tier)}</span>`;
const presentation = createCardPresentation({
  engine: E,
  cards: CARDS,
  statusDefinitions: STATUS_DEFINITIONS,
  getRun: () => run,
  getStarted: () => started,
  tierStars,
});

assert.equal(
  presentation.statusAmountText("burning", {
    stacks: 2,
    notes: ["top"],
    cardTypes: ["attack"],
    cardIds: ["contact_glass_dropper_strike"],
  }),
  "연소 +2 (TOP·공격 카드·유리 스포이트 타격)",
  "status labels keep note/type/card selectors",
);

const basicAttack = { id: "contact_glass_dropper_strike", level: 0 };
assert.equal(
  presentation.cardEffectText(basicAttack, true),
  "피해 8",
  "expanded effect text keeps the base attack value outside battle modifiers",
);
const compact = presentation.compactCardEffectSummary(basicAttack);
assert.ok(compact, "starter contact attack has compact presentation data");
assert.match(compact.body, /card-summary-row/);
assert.match(compact.body, /피해 <b>8<\/b>/);
assert.deepEqual(compact.rows, [
  { value: "피해 <b>8</b>", density: "", label: "피해", result: "8" },
]);

const cardMarkup = presentation.cardHtml(basicAttack);
assert.match(cardMarkup, /card-type-attack/);
assert.match(cardMarkup, /note-top/);
assert.match(cardMarkup, /card-tier-1/);
assert.match(cardMarkup, /유리 스포이트 타격/);
assert.match(cardMarkup, /pattern-contact/);
assert.match(cardMarkup, /card-effect-compact/);

const starterAbsorb = { id: "absorb_precision_pipette", level: 0 };
const absorbMarkup = presentation.cardHtml(starterAbsorb);
assert.match(absorbMarkup, /흡수/);
assert.match(
  absorbMarkup,
  /--summary-row-color:#cba3e8/,
  "starter deck absorb cards render through the extracted presentation module",
);

run.phase = "battle";
run.battle = {
  ...run.battle,
  enemies: [{ hp: 20, maxHp: 20, status: {} }],
  selectedTarget: 0,
};
const originalBreakdown = E.cardStatusValueBreakdown;
assert.equal(typeof originalBreakdown, "function");
const engineWithModifier = {
  ...E,
  cardStatusValueBreakdown: (_run, base, kind) => ({ base, kind, delta: 3 }),
};
const modifiedPresentation = createCardPresentation({
  engine: engineWithModifier,
  cards: CARDS,
  statusDefinitions: STATUS_DEFINITIONS,
  getRun: () => run,
  getStarted: () => started,
  tierStars,
});
assert.match(
  modifiedPresentation.cardEffectText(basicAttack, true),
  /피해 8<span class="card-value-modifier positive">\(\+3\)<\/span>/,
  "battle status modifier remains visible in card values",
);

started = false;
const inactivePresentation = createCardPresentation({
  engine: engineWithModifier,
  cards: CARDS,
  statusDefinitions: STATUS_DEFINITIONS,
  getRun: () => run,
  getStarted: () => started,
  tierStars,
});
assert.equal(
  inactivePresentation.cardEffectText(basicAttack, true),
  "피해 8",
  "battle modifier is suppressed before the run UI is started",
);

console.log("Harmony card presentation tests passed");
