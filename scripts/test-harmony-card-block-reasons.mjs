import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as E from "../games/harmony/engine.js";
import { CARDS } from "../games/harmony/data.js";

const styles = await readFile(new URL("../games/harmony/styles.css", import.meta.url), "utf8");
const supportStyles = await readFile(
  new URL("../games/harmony/player-support-ui.css", import.meta.url),
  "utf8",
);
const supportScript = await readFile(
  new URL("../games/harmony/player-support-ui.js", import.meta.url),
  "utf8",
);
const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const engineCore = await readFile(
  new URL("../games/harmony/engine-core.js", import.meta.url),
  "utf8",
);
const signatureRuntime = await readFile(
  new URL("../games/harmony/signature-relic-runtime.js", import.meta.url),
  "utf8",
);
const presentationBase = await readFile(
  new URL("../games/harmony/card-presentation-base.js", import.meta.url),
  "utf8",
);
assert.match(
  styles,
  /\.battle > \.hand \.card \.card-symbol\s*\{[^}]*grid-row:\s*2;[^}]*grid-column:\s*1;/s,
  "the hand card icon stays pinned under the unavailable-reason overlay",
);
assert.match(
  styles,
  /\.battle > \.hand \.card \.card-unavailable-reason\s*\{[^}]*visibility:\s*hidden;[^}]*opacity:\s*0;/s,
  "disabled-card reason stays hidden until the card is actively inspected",
);
assert.match(
  styles,
  /:hover \.card-unavailable-reason,[\s\S]*?:focus-visible \.card-unavailable-reason\s*\{[^}]*visibility:\s*visible;[^}]*opacity:\s*1;/s,
  "disabled-card reason is shown only while hover/focus is active",
);
const unavailableReasonRule = styles.match(
  /\.battle > \.hand \.card \.card-unavailable-reason\s*\{([\s\S]*?)\n\}/,
)?.[1] || "";
assert.match(unavailableReasonRule, /transition:\s*opacity \.14s ease, transform \.14s ease;/);
assert.doesNotMatch(
  unavailableReasonRule,
  /transition:[^;]*visibility/,
  "mouseleave/blur must hide the disabled reason immediately instead of delaying visibility cleanup",
);
assert.match(
  main,
  /function showNotice\(message, \{ transient = false, duration = 1800 \} = \{\}\)[\s\S]*?notice\.dataset\.noticeMode = transient \? "transient" : "persistent";[\s\S]*?setTimeout\(/,
  "global notice reuses the existing element with an explicit transient lifecycle",
);
assert.match(
  main,
  /if \(button\.closest\("\.hand"\)[\s\S]*?if \(reason\) showNotice\(reason, \{ transient: true \}\);/,
  "disabled hand-card clicks use transient notice feedback instead of a sticky HUD message",
);
assert.match(
  main,
  /function render\(\) \{\s*clearTransientNotice\(\);/,
  "every full UI rerender invalidates stale transient AP feedback",
);
assert.doesNotMatch(
  main,
  /if \(reason\) \$(?:\("notice"\))\.textContent = reason;/,
  "disabled-card reasons must not be copied into the notice without lifecycle cleanup",
);
assert.match(presentationBase, /disabled\s*\?\s*" card-ap-unavailable"\s*:\s*" card-ap-available"/s);
assert.match(supportStyles, /\.card-ap-value\.card-ap-available\s*\{[^}]*color:\s*#086b45;[^}]*background:\s*transparent\s*!important;/s);
assert.match(supportStyles, /\.card-ap-value\.card-ap-unavailable\s*\{[^}]*color:\s*#ad2929;[^}]*background:\s*transparent\s*!important;/s);
assert.match(supportStyles, /content:\s*"회복약"/);
assert.match(supportStyles, /\.player-status-heading\s*\{/);
assert.match(supportStyles, /\.player-effects-side \.status-list\s*\{[^}]*overflow-y:\s*auto;/s);
assert.match(supportStyles, /\.enemies-field \.enemy > \.status-list\s*\{[^}]*display:\s*flex\s*!important;[^}]*max-height:\s*52px;/s);
assert.match(supportStyles, /\.enemies-field \.enemy > \.status-list > \.status-chip/);
assert.match(supportScript, /querySelectorAll\("\.enemy \.status-chip"\)/);
assert.match(supportScript, /STATUS_BADGE_SELECTOR\s*=\s*"\.player-effects-side \.status-chip, \.enemy \.status-chip"/);
assert.match(supportScript, /event\.stopPropagation\(\)/);

assert.match(engineCore, /export function requiredAbsorbForCard\(s, card\)/);
assert.match(engineCore, /requiredAbsorb > 0 && battle\.absorb < requiredAbsorb/);
assert.match(engineCore, /requiredAbsorb > 0 && b\.absorb < requiredAbsorb/);
assert.match(engineCore, /Math\.max\(0, absorbBeforeLoss - absorbLoss\)/);
assert.doesNotMatch(engineCore, /if \(c\.requiredAbsorb && b\.absorb < c\.requiredAbsorb\)/);
assert.match(signatureRuntime, /Core\.requiredAbsorbForCard\(state, card\)/);
assert.match(presentationBase, /engine\.requiredAbsorbForCard\(run, card\)/);

assert.match(supportScript, /SYNERGY_HELP_SELECTOR\s*=\s*"\[data-synergy-tip-name\]"/);
assert.match(supportScript, /trigger\?\.dataset\.synergyTipName/);
assert.match(supportScript, /title:\s*trigger\.dataset\.synergyTipName[\s\S]*?body:\s*trigger\.dataset\.synergyTipBody/);
assert.match(
  supportScript,
  /right \+ bounds\.width <= window\.innerWidth - gap[\s\S]*?window\.innerHeight - bounds\.height - gap/,
  "shared tooltip should keep horizontal and vertical viewport clamping for synergy details",
);

function combat(cardId, seed = 7310) {
  const run = E.newRun(seed), meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  run.battle.enemyPhase = false;
  run.battle.pendingDiscard = 0;
  run.battle.ap = 99;
  run.battle.absorb = 99;
  run.battle.hand = [{ id: cardId, level: 0 }];
  run.hp = run.maxHp - 1;
  return run;
}

{
  const run = combat("strike"), card = run.battle.hand[0];
  run.battle.ap = 0;
  assert.equal(E.cardPlayBlockReason(run, card), "1 AP 필요 · 현재 0");
  assert.equal(E.canPlay(run, card), false);
}
{
  const run = combat("heal_aloe_salve"), card = run.battle.hand[0];
  run.hp = run.maxHp;
  assert.equal(E.cardPlayBlockReason(run, card), "체력이 이미 최대");
}
{
  const run = combat("contact_pure_absorb_overload"), card = run.battle.hand[0];
  run.battle.absorb = 7;
  assert.equal(E.cardPlayBlockReason(run, card), "흡수 20 필요 · 현재 7");
}
{
  const run = combat("strike"), card = run.battle.hand[0];
  run.statuses.stun = { stacks: 1 };
  assert.equal(E.cardPlayBlockReason(run, card), "기절 · 행동 불가");
}
{
  const run = combat("strike"), card = run.battle.hand[0];
  run.statuses.disarm = { stacks: 1, turns: 1 };
  assert.equal(E.cardPlayBlockReason(run, card), "무장 해제 · 공격 카드 사용 불가");
}
{
  const run = combat("strike"), card = run.battle.hand[0];
  run.statuses.seal = { stacks: 1, turns: 1, cardIds: ["strike"] };
  assert.equal(E.cardPlayBlockReason(run, card), "봉인 · 이 카드 사용 불가");
}
{
  const run = combat("strike"), card = run.battle.hand[0];
  card.traitLocked = run.battle.turn;
  assert.equal(E.cardPlayBlockReason(run, card), "특성 효과로 이번 턴 잠김");
}
{
  const run = combat("impurity");
  run.statuses.impurityLock = { stacks: 1, turns: 1 };
  assert.equal(
    E.cardDiscardBlockReason(run, run.battle.hand[0]),
    "불순물 고정 · 버리기 불가",
  );
  assert.equal(E.canDiscard(run, run.battle.hand[0]), false);
}


// requiredAbsorb === 0 is schema data, not a resource gate. Negative absorb can
// still be repaid by normal absorb-generation cards.
{
  const definition = CARDS.contact_execution_stamp,
    hadRequired = Object.prototype.hasOwnProperty.call(definition, "requiredAbsorb"),
    previousRequired = definition.requiredAbsorb;
  definition.requiredAbsorb = 0;
  try {
    let run = combat("contact_execution_stamp"), card = run.battle.hand[0];
    run.battle.absorb = -10;
    assert.equal(E.requiredAbsorbForCard(run, card), 0);
    assert.equal(E.cardPlayBlockReason(run, card), null, "-10 absorb must not fail a zero requirement");
    assert.equal(E.canPlay(run, card), true);

    run = combat("contact_execution_stamp");
    card = run.battle.hand[0];
    run.battle.absorb = 0;
    assert.equal(E.cardPlayBlockReason(run, card), null, "zero absorb satisfies a zero requirement");

    // Generic dynamic extension point for future trait/relic/curse/event effects.
    run = combat("contact_execution_stamp");
    card = run.battle.hand[0];
    run.eventPowers.requiredAbsorbModifier = 5;
    run.battle.absorb = -10;
    assert.equal(E.requiredAbsorbForCard(run, card), 5);
    assert.equal(E.cardPlayBlockReason(run, card), "흡수 5 필요 · 현재 -10");

    run.battle.absorb = 4;
    assert.equal(E.cardPlayBlockReason(run, card), "흡수 5 필요 · 현재 4");
    assert.equal(E.canPlay(run, card), false);

    run.battle.absorb = 5;
    run.battle.enemies[0].hp = 200;
    run.battle.enemies[0].maxHp = 200;
    run.battle.enemies[0].shield = 0;
    assert.equal(E.canPlay(run, card), true);
    assert.equal(E.play(run, 0, E.freshMeta()), true);
    assert.equal(run.battle.absorb, 0, "the same dynamic required amount is actually consumed");
  } finally {
    if (hadRequired) definition.requiredAbsorb = previousRequired;
    else delete definition.requiredAbsorb;
  }
}

// Upgraded cardDefinition values are the canonical base for the resolved requirement.
{
  const run = combat("contact_pure_absorb_overload"), card = run.battle.hand[0];
  card.level = 2;
  run.battle.absorb = 17;
  assert.equal(E.requiredAbsorbForCard(run, card), 18);
  assert.equal(E.cardPlayBlockReason(run, card), "흡수 18 필요 · 현재 17");
  run.battle.absorb = 18;
  run.battle.enemies[0].hp = 300;
  run.battle.enemies[0].maxHp = 300;
  run.battle.enemies[0].shield = 0;
  assert.equal(E.play(run, 0, E.freshMeta()), true);
  assert.equal(run.battle.absorb, 0);
}

// A negative absorb balance must not block an absorb producer; generated absorb
// repays the existing debt instead of requiring the gauge to be non-negative first.
{
  const run = combat("absorb_precision_pipette"), card = run.battle.hand[0];
  run.battle.absorb = -10;
  assert.equal(E.requiredAbsorbForCard(run, card), 0);
  assert.equal(E.canPlay(run, card), true);
  assert.equal(E.play(run, 0, E.freshMeta()), true);
  assert.equal(run.battle.absorb, -2, "absorb +8 repays -10 debt to -2");
}

// absorbCost remains an optional fuel threshold, not a play requirement.
{
  let run = combat("contact_resin_smash"), card = run.battle.hand[0];
  run.battle.absorb = 0;
  run.battle.enemies[0].hp = 200;
  run.battle.enemies[0].maxHp = 200;
  run.battle.enemies[0].shield = 0;
  const hpWithoutFuel = run.battle.enemies[0].hp;
  assert.equal(E.canPlay(run, card), true);
  assert.equal(E.play(run, 0, E.freshMeta()), true);
  assert.equal(run.battle.absorb, 0);
  assert.equal(hpWithoutFuel - run.battle.enemies[0].hp, 9);

  run = combat("contact_resin_smash");
  card = run.battle.hand[0];
  run.battle.absorb = 8;
  run.battle.enemies[0].hp = 200;
  run.battle.enemies[0].maxHp = 200;
  run.battle.enemies[0].shield = 0;
  const hpWithFuel = run.battle.enemies[0].hp;
  assert.equal(E.canPlay(run, card), true);
  assert.equal(E.play(run, 0, E.freshMeta()), true);
  assert.equal(run.battle.absorb, 0, "absorbCost consumes fuel only when available");
  assert.equal(hpWithFuel - run.battle.enemies[0].hp, 17);
}

// healAbsorbLoss is a loss of stored positive absorb only; it cannot create or
// deepen debt.
{
  let run = combat("heal_aloe_salve");
  run.eventPowers.healAbsorbLoss = 5;
  run.hp = run.maxHp - 20;
  run.battle.absorb = 3;
  assert.equal(E.play(run, 0, E.freshMeta()), true);
  assert.equal(run.battle.absorb, 0, "3 absorb loses only the stored 3, not 5");
  assert.equal(run._absorbLossFeedback, 3);

  run.battle.hand = [{ id: "heal_aloe_salve", level: 0 }];
  run.battle.ap = 99;
  run.hp = run.maxHp - 20;
  assert.equal(E.play(run, 0, E.freshMeta()), true);
  assert.equal(run.battle.absorb, 0, "healing at zero absorb must stay at zero");

  run = combat("heal_aloe_salve");
  run.eventPowers.healAbsorbLoss = 5;
  run.hp = run.maxHp - 20;
  run.battle.absorb = -10;
  assert.equal(E.play(run, 0, E.freshMeta()), true);
  assert.equal(run.battle.absorb, -10, "healing must not deepen an explicit absorb debt");
}

// Explicit openingAbsorb debt remains a supported mechanic.
{
  const run = E.newRun(7388), meta = E.freshMeta();
  run.eventPowers.openingAbsorb = -10;
  run.route[0] = "battle";
  E.enter(run, meta);
  assert.equal(run.battle.absorb, -10, "openingAbsorb debt remains unchanged");
}

console.log("PASS Harmony card block reasons and compact player/enemy status styling are wired.");
