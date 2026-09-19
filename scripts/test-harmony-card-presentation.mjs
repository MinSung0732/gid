import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as E from "../games/harmony/engine.js";
import { CARDS } from "../games/harmony/data.js";
import { STATUS_DEFINITIONS } from "../games/harmony/statuses.js";
import { createCardPresentation } from "../games/harmony/card-presentation.js";
import {
  DETAIL_TERM_REGISTRY,
  formatSemanticText,
} from "../games/harmony/card-semantic-text.js";

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const source = await readFile(new URL("../games/harmony/card-presentation.js", import.meta.url), "utf8");
const baseSource = await readFile(new URL("../games/harmony/card-presentation-base.js", import.meta.url), "utf8");
assert.match(main, /from "\.\/card-presentation\.js(?:\?v=[^"]+)?"/);
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
assert.match(source, /card-presentation-base\.js/);
assert.match(source, /card-copy-policy\.js/);
assert.match(source, /card-copy-overrides\.js/);
assert.match(baseSource, /engine\.cardDefinition\(card\)/);
assert.match(baseSource, /engine\.cardStatusValueBreakdown\(/);
assert.match(baseSource, /engine\.cardPlayBlockReason\(/);
assert.match(baseSource, /statusDefinitions\[id\]/);

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

// Tooltip requirement text uses the same resolved requirement as canPlay/play.
{
  const definition = CARDS.contact_execution_stamp,
    hadRequired = Object.prototype.hasOwnProperty.call(definition, "requiredAbsorb"),
    previousRequired = definition.requiredAbsorb;
  definition.requiredAbsorb = 0;
  try {
    delete run.eventPowers.requiredAbsorbModifier;
    assert.doesNotMatch(
      presentation.cardEffectText({ id: "contact_execution_stamp", level: 0 }, true),
      /흡수 0 소모/,
      "zero requiredAbsorb stays a schema value and is not presented as a requirement",
    );
    run.eventPowers.requiredAbsorbModifier = 5;
    const dynamicRequirementText = presentation.cardEffectText(
      { id: "contact_execution_stamp", level: 0 },
      true,
    );
    assert.match(dynamicRequirementText, /detail-absorb[^>]*>흡수<\/span> <b[^>]*>5<\/b> 소모/);
    assert.match(dynamicRequirementText, /흡수<\/span>가 부족시 사용불가합니다/);
    delete run.eventPowers.requiredAbsorbModifier;
  } finally {
    if (hadRequired) definition.requiredAbsorb = previousRequired;
    else delete definition.requiredAbsorb;
  }
}

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

const summaryTexts = (id) =>
  presentation.compactCardEffectSummary({ id, level: 0 }).rows.map((entry) => entry.text);

const basicAttack = { id: "contact_glass_dropper_strike", level: 0 };
const expandedBasic = presentation.cardEffectText(basicAttack, true);
assert.match(expandedBasic, /피해/);
assert.match(expandedBasic, />8</);
const compact = presentation.compactCardEffectSummary(basicAttack);
assert.ok(compact, "starter contact attack has compact presentation data");
assert.match(compact.body, /card-summary-row/);
assert.match(compact.body, /피해 <b>8<\/b>/);
assert.deepEqual(compact.rows, [
  {
    key: "damage",
    text: "피해 8",
    value: "피해 <b>8</b>",
    label: "damage",
    result: "피해 8",
  },
]);

assert.deepEqual(
  summaryTexts("contact_fierce_rub"),
  ["피해 3 ×3"],
  "inherent multihit count stays on the damage summary row",
);
assert.deepEqual(
  summaryTexts("contact_pestle_grind"),
  ["피해 6 ×2", "흡수"],
  "absorb is name-only while multihit remains part of the base attack structure",
);
assert.deepEqual(
  summaryTexts("heal_aloe_salve"),
  ["회복 5"],
  "direct healing keeps only its primary value",
);
assert.deepEqual(
  summaryTexts("contact_shattered_ampoule"),
  ["피해 6", "취약"],
  "single status summaries hide stack amounts",
);
assert.deepEqual(
  summaryTexts("contact_steel_pierce"),
  ["피해 9", "취약", "약화"],
  "multiple statuses render as separate name-only rows",
);
assert.deepEqual(
  summaryTexts("heal_celestial_ambrosia"),
  ["회복 18", "HARMONY 보너스"],
  "HARMONY conditions collapse to a name-only bonus row",
);
assert.deepEqual(
  summaryTexts("heal_vital_sap_concoction"),
  ["회복 6", "콤보 보너스"],
  "conditional combo healing hides threshold and multiplier details",
);

const statusDetail = presentation.cardEffectText(
  { id: "contact_steel_pierce", level: 0 },
  true,
);
assert.match(statusDetail, /취약/);
assert.match(statusDetail, /2중첩/);
assert.match(statusDetail, /약화/);
assert.match(statusDetail, /1중첩/);
const comboDetail = presentation.cardEffectText(
  { id: "heal_vital_sap_concoction", level: 0 },
  true,
);
assert.match(comboDetail, /3장 이상/);
assert.match(comboDetail, /2배/);

const cardMarkup = presentation.cardHtml(basicAttack);
assert.match(cardMarkup, /card-type-attack/);
assert.match(cardMarkup, /note-top/);
assert.match(cardMarkup, /card-tier-1/);
assert.match(cardMarkup, /유리 스포이트 타격/);
assert.match(cardMarkup, /pattern-contact/);
assert.match(cardMarkup, /card-effect-compact/);
assert.doesNotMatch(
  cardMarkup,
  /hand-card-visual/,
  "non-hand card surfaces should not inherit the battle hand presentation",
);

const handCardMarkup = presentation.cardHtml(basicAttack, 0);
assert.match(
  handCardMarkup,
  /class="card hand-card-visual /,
  "battle hand cards expose the shared presentation class copied by VFX clones",
);

const discardRun = E.newRun(7302);
discardRun.phase = "battle";
discardRun.battle = {
  enemies: [{ hp: 20, maxHp: 20, statuses: {} }],
  selectedTarget: 0,
  pendingDiscard: 1,
  shield: 0,
  absorb: 0,
  ap: 3,
};
const discardEngine = {
  ...E,
  cost: () => 1,
  canDiscard: () => true,
  cardDiscardBlockReason: () => null,
};
const discardPresentation = createCardPresentation({
  engine: discardEngine,
  cards: CARDS,
  statusDefinitions: STATUS_DEFINITIONS,
  getRun: () => discardRun,
  getStarted: () => started,
  tierStars,
});
const discardMarkup = discardPresentation.cardHtml(basicAttack, 0);
assert.match(
  discardMarkup,
  /class="card-discard-action">버리기<\/b>/,
  "discard-choice card header uses the compact discard action label",
);
assert.doesNotMatch(
  discardMarkup,
  /이 카드 버리기|버리기 불가/,
  "discard-choice card header no longer uses variable-width discard copy",
);
assert.match(
  discardMarkup,
  /data-action="discard-choice"/,
  "discard-choice interaction wiring remains unchanged",
);

const resonance = STATUS_DEFINITIONS.resonance;
const resonanceDetail = presentation.cardEffectText(
  { id: "noncontact_resonance_chain_collapse", level: 0 },
  true,
);
assert.match(resonanceDetail, new RegExp(resonance.name), "resonance detail contains the status name");
assert.ok(
  resonanceDetail.includes(
    `<span class="detail-status" style="--detail-status-color:${resonance.color}">${resonance.name}</span>`,
  ),
  "plain resonance detail text receives the shared detail-status color markup",
);
const resonanceOccurrences = resonanceDetail.split(resonance.name).length - 1;
const semanticResonanceOccurrences = [...resonanceDetail.matchAll(
  new RegExp(`<span\\b([^>]*)>\\s*${resonance.name}\\s*<\\/span>`, "g"),
)].filter((match) => {
  const className = match[1].match(/\bclass=(['"])(.*?)\1/)?.[2] || "";
  return className.split(/\s+/).includes("detail-status");
}).length;
assert.equal(
  semanticResonanceOccurrences,
  resonanceOccurrences,
  "every resonance label in the expanded detail is semantic detail-status markup",
);
assert.doesNotMatch(
  resonanceDetail,
  /<span\b[^>]*class=(['"])[^'"]*\bdetail-status\b[^'"]*\1[^>]*>\s*<span\b[^>]*class=(['"])[^'"]*\bdetail-status\b[^'"]*\2/i,
  "resonance detail-status markup must not be nested",
);

for (const card of Object.values(CARDS)) {
  const markup = presentation.cardHtml({ id: card.id, level: 0 });
  assert.match(
    markup,
    new RegExp(`>${card.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<`),
    `card presentation renders ${card.id} without missing module dependencies`,
  );
}

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
  /card-value-modifier positive[^>]*>\(\+3\)/,
  "battle status modifier remains visible in card detail values",
);
const modifiedCompact = modifiedPresentation.compactCardEffectSummary(basicAttack);
assert.match(
  modifiedCompact.body,
  /피해 <b>8<\/b><span class="card-value-modifier positive">\(\+3\)<\/span>/,
  "compact summary keeps the primary damage value and shows the live status delta",
);
assert.match(
  modifiedCompact.body,
  /card-value-modifier positive/,
  "compact summary exposes runtime calculation modifiers alongside detail tooltip values",
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
const inactiveDetail = inactivePresentation.cardEffectText(basicAttack, true);
assert.match(inactiveDetail, /피해/);
assert.doesNotMatch(inactiveDetail, /card-value-modifier/);

function plain(value) {
  return String(value).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

{
  const drawDetail = presentation.cardEffectText({ id: "guard_kraft_wrapping", level: 0 }, true);
  assert.equal(
    (plain(drawDetail).match(/뽑습니다/g) || []).length,
    1,
    "draw effect is owned by one detail renderer",
  );

  const boosterDetail = presentation.cardEffectText({ id: "absorb_fragrance_primer", level: 0 }, true);
  assert.match(plain(boosterDetail), /다음 2장의 카드가 얻는 흡수를 각각 3 증가/);
  assert.doesNotMatch(
    plain(boosterDetail),
    /흡수 획득 \+3 효과가 적용됩니다/,
    "absorbBooster does not leak through fallback",
  );

  const oilDetail = presentation.cardEffectText({ id: "burst_condensed_essence_drop", level: 0 }, true);
  assert.match(plain(oilDetail), /오일 카드 AP 비용을 1 낮춥니다/);
  assert.doesNotMatch(
    plain(oilDetail),
    /최소 0 효과가 적용됩니다/,
    "reduceOilCost owns its minimum-cost metadata",
  );

  const searchDetail = presentation.cardEffectText({ id: "absorb_vacuum_distill", level: 0 }, true);
  assert.match(plain(searchDetail), /공간 확산 1장을 찾아 손패로 가져옵니다/);
  assert.doesNotMatch(
    plain(searchDetail),
    /손패가 가득 차면 유지 효과가 적용됩니다/,
    "searchDrawCard owns its hand-full fallback metadata",
  );

  const intentDetail = presentation.cardEffectText({ id: "noncontact_scent_shockwave", level: 0 }, true);
  assert.equal(
    (plain(intentDetail).match(/공격을 준비 중인 적에게/g) || []).length,
    1,
    "conditionalEnemyIntent is rendered once",
  );
  assert.doesNotMatch(plain(intentDetail), /취약 \+2 효과가 적용됩니다/);

  const randomDetail = presentation.cardEffectText({ id: "noncontact_perpetual_storm", level: 0 }, true);
  assert.match(plain(randomDetail), /매 타격마다 새로 고른 무작위 적에게/);
  assert.doesNotMatch(
    plain(randomDetail),
    /무작위 생존 적 대상 효과가 적용됩니다|도탄 효과가 적용됩니다/,
    "randomEachHit target metadata stays inside its parent effect sentence",
  );
}

{
  const bleed = STATUS_DEFINITIONS.bleed,
    statusDetailMarkup = presentation.cardEffectText(
      { id: "contact_beveled_scent_strip", level: 0 },
      true,
    );
  assert.ok(
    statusDetailMarkup.includes(`--detail-status-color:${bleed.color}`),
    "detail status color follows STATUS_DEFINITIONS",
  );

  const pierceMarkup = formatSemanticText("방어막 관통", {
    context: "detail",
    statusDefinitions: STATUS_DEFINITIONS,
  });
  assert.equal(
    (pierceMarkup.match(/semantic-term/g) || []).length,
    1,
    "long canonical terms are tokenized before shorter terms",
  );
  assert.ok(pierceMarkup.includes(`--semantic-term-color:${DETAIL_TERM_REGISTRY.shieldPierce.color}`));

  const upgradeMarkup = formatSemanticText("강화 단계가 증가합니다.", {
    context: "detail",
    statusDefinitions: STATUS_DEFINITIONS,
  });
  assert.doesNotMatch(
    upgradeMarkup,
    /detail-status|--detail-status-color/,
    "card upgrade wording is not confused with the strength status",
  );
}

{
  const attackBody = presentation.compactCardEffectSummary({
      id: "contact_shattered_ampoule",
      level: 0,
    }).body,
    defenseBody = presentation.compactCardEffectSummary({
      id: "guard_kraft_wrapping",
      level: 0,
    }).body,
    absorbBody = presentation.compactCardEffectSummary({
      id: "absorb_solvent_percolation",
      level: 0,
    }).body,
    healBody = presentation.compactCardEffectSummary({
      id: "heal_chamomile_infusion",
      level: 0,
    }).body;

  assert.match(attackBody, /card-summary-row[^>]*>피해 <b>6<\/b><\/span>/);
  assert.doesNotMatch(
    attackBody,
    /card-summary-row[^>]*><span class="semantic-term[^"]*"[^>]*>피해<\/span> <b>6<\/b>/,
    "attack primary damage stays neutral in hand summary",
  );
  assert.ok(
    attackBody.includes(`--semantic-term-color:${STATUS_DEFINITIONS.vulnerable.color}`),
    "attack secondary status uses the status representative color",
  );

  assert.match(defenseBody, /card-summary-row[^>]*>방어막 <b>6<\/b><\/span>/);
  assert.ok(
    defenseBody.includes(`--semantic-term-color:${DETAIL_TERM_REGISTRY.draw.color}`),
    "defense secondary draw term uses the shared representative color",
  );

  assert.match(absorbBody, /card-summary-row[^>]*>흡수<\/span>/);
  assert.ok(
    absorbBody.includes(`--semantic-term-color:${DETAIL_TERM_REGISTRY.damage.color}`),
    "absorb card treats damage as a colored secondary effect",
  );

  assert.match(healBody, /card-summary-row[^>]*>회복 <b>4<\/b><\/span>/);
  assert.ok(
    healBody.includes(`--semantic-term-color:${DETAIL_TERM_REGISTRY.shield.color}`),
    "heal card treats shield as a colored secondary effect",
  );

  for (const body of [attackBody, defenseBody, absorbBody, healBody]) {
    const summaryOnly = body.split('<span class="card-effect-tooltip"')[0];
    assert.doesNotMatch(
      summaryOnly,
      /semantic-(?:gain|loss)/,
      "hand summary numbers do not inherit detail gain/loss colors",
    );
  }
}

console.log("Harmony card presentation tests passed");
