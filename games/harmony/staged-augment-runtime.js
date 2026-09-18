import * as S from "./statuses.js";
import { STAGED_AUGMENT_CARDS, STAGED_AUGMENT_ITEMS } from "./staged-augments.js";

const AILMENTS = ["burning", "poison", "corrosion", "bleed"];

export function installStagedAugments(cards, items, testItems = null) {
  Object.assign(cards, STAGED_AUGMENT_CARDS);
  Object.assign(items, STAGED_AUGMENT_ITEMS);
  if (testItems) Object.assign(testItems, STAGED_AUGMENT_ITEMS);
}

function ensureTurnState(battle) {
  if (!battle) return;
  if (battle._stagedAugmentTurn === battle.turn) return;
  battle._stagedAugmentTurn = battle.turn;
  battle._stagedPaidContactCardsPlayed = 0;
  battle._stagedFifthCardRefunded = false;
  battle._stagedResonanceFirstNonContact = false;
  battle._stagedResonanceFirstHitShield = false;
  battle._stagedCriticalDischarge = false;
  battle._stagedDiscardRefundQueue = 0;
}

function ailmentTypeCount(enemy) {
  return AILMENTS.reduce((count, id) => count + (S.stacks(enemy, id) > 0 ? 1 : 0), 0);
}

function consumeResonance(enemy, amount = Infinity) {
  if (!enemy) return 0;
  const before = S.stacks(enemy, "resonance");
  const consumed = Math.min(before, Number.isFinite(amount) ? Math.max(0, amount) : before);
  if (consumed > 0) S.removeStatus(enemy, "resonance", consumed);
  return consumed;
}

function addShield(state, amount) {
  const battle = state?.battle;
  if (!battle || amount <= 0) return 0;
  const gained = Math.max(0, Math.round(S.shieldGain(amount, state)));
  battle.shield += gained;
  return gained;
}

function addAbsorb(state, amount) {
  const battle = state?.battle;
  if (!battle || amount <= 0) return 0;
  const before = battle.absorb || 0;
  battle.absorb = Math.min(100, before + Math.max(0, Math.round(amount)));
  const gained = battle.absorb - before;
  if (gained > 0) state._absorbFeedback = (state._absorbFeedback || 0) + gained;
  return gained;
}

function addHeal(state, amount) {
  if (!state || amount <= 0) return 0;
  const before = state.hp;
  state.hp = Math.min(state.maxHp, state.hp + Math.max(0, Math.round(amount)));
  const gained = state.hp - before;
  if (gained > 0) state._healingFeedback = (state._healingFeedback || 0) + gained;
  return gained;
}

function applyEnemyStatus(enemy, id, amount) {
  if (!enemy || enemy.hp <= 0 || amount <= 0) return 0;
  return S.applyStatus(enemy, id, amount);
}

function chooseHighestResonance(Core, state) {
  const alive = Core.livingEnemies(state.battle);
  if (!alive.length) return null;
  const max = Math.max(...alive.map((enemy) => S.stacks(enemy, "resonance")));
  const tied = alive.filter((enemy) => S.stacks(enemy, "resonance") === max);
  const selected = Core.selectedEnemy(state.battle);
  if (selected && tied.includes(selected)) return selected;
  return tied[Math.floor(Core.random(state) * tied.length)] || tied[0] || null;
}

function currentUpgradeValue(definition, card, key) {
  const values = definition?.upgrades?.[key];
  if (!Array.isArray(values)) return definition?.[key];
  const level = Math.max(0, Math.min(definition.maxUpgrade || values.length - 1, card?.level || 0));
  return values[level];
}

function installTemporaryCardValues(cards, card, overrides) {
  const definition = cards[card.id];
  if (!definition || !Object.keys(overrides).length) return () => {};
  const saved = [];
  const level = Math.max(0, Math.min(definition.maxUpgrade || 0, card.level || 0));
  for (const [key, value] of Object.entries(overrides)) {
    saved.push({ key, value: definition[key], had: Object.prototype.hasOwnProperty.call(definition, key) });
    definition[key] = value;
    if (Array.isArray(definition.upgrades?.[key])) {
      saved[saved.length - 1].upgrade = definition.upgrades[key][level];
      definition.upgrades[key][level] = value;
    }
  }
  return () => {
    for (const entry of saved) {
      if (entry.had) definition[entry.key] = entry.value;
      else delete definition[entry.key];
      if (Object.prototype.hasOwnProperty.call(entry, "upgrade"))
        definition.upgrades[entry.key][level] = entry.upgrade;
    }
  };
}

function uniqueHitTargetIndexes(state, pattern, start = 0) {
  const hits = (state?._enemyHitFeedback || []).slice(start);
  return [...new Set(hits
    .filter((hit) => hit.attackPattern === pattern && !hit.statusId && (hit.damage > 0 || hit.blocked > 0))
    .map((hit) => hit.targetIndex)
    .filter(Number.isInteger))];
}

function applyCaptureFlask(Core, state, beforeEnemies) {
  const amount = Core.power(state, "resonanceTransferOnKill");
  if (!amount || !state?.battle) return;
  const battle = state.battle;
  beforeEnemies.forEach((before, index) => {
    const enemy = battle.enemies[index];
    if (!enemy || before.hp <= 0 || enemy.hp > 0) return;
    const remaining = S.stacks(enemy, "resonance");
    if (remaining <= 0) return;
    const others = Core.livingEnemies(battle).filter((candidate) => candidate !== enemy);
    if (!others.length) return;
    const target = others[Math.floor(Core.random(state) * others.length)];
    applyEnemyStatus(target, "resonance", Math.min(remaining, amount));
  });
}

function applyPostNonContactResonance(Core, state, snapshot) {
  const battle = state?.battle;
  if (!battle || snapshot.pattern !== "nonContact" || !snapshot.attackCard) return;
  const targets = uniqueHitTargetIndexes(state, "nonContact", snapshot.hitFeedbackBefore)
    .map((index) => battle.enemies[index])
    .filter((enemy) => enemy?.hp > 0);
  if (!targets.length) return;

  const firstAdd = Core.power(state, "resonanceFirstNonContactAdd");
  if (firstAdd > 0 && snapshot.nonContactCardsBefore === 0 && !battle._stagedResonanceFirstNonContact) {
    for (const enemy of targets) applyEnemyStatus(enemy, "resonance", firstAdd);
    battle._stagedResonanceFirstNonContact = true;
  }

  const corePower = Core.power(state, "resonanceCoreNonContactAdd");
  if (corePower > 0) {
    for (const enemy of targets) {
      const beforeCore = S.stacks(enemy, "resonance");
      applyEnemyStatus(enemy, "resonance", beforeCore >= 5 ? 2 * corePower : corePower);
    }
  }
}

function applyResonanceBuffer(Core, state, snapshot) {
  const battle = state?.battle;
  const shield = Core.power(state, "resonanceFirstHitShield");
  if (!battle || !shield || battle._stagedResonanceFirstHitShield || !snapshot.attackCard) return;
  const hits = (state._enemyHitFeedback || []).slice(snapshot.hitFeedbackBefore).filter((hit) => !hit.statusId && (hit.damage > 0 || hit.blocked > 0));
  const qualifies = hits.some((hit) => (snapshot.enemyResonance[hit.targetIndex] || 0) >= 1);
  if (!qualifies) return;
  addShield(state, shield);
  battle._stagedResonanceFirstHitShield = true;
}

function prepareCard(Core, cards, state, card, definition, snapshot) {
  const battle = state.battle;
  const overrides = {};
  const target = snapshot.selectedEnemy;
  let consumedResonance = 0;
  let chainSplash = null;

  if (card.id === "guard_resonance_cover") {
    const hasResonantEnemy = Core.livingEnemies(battle).some((enemy) => S.stacks(enemy, "resonance") >= 3);
    if (hasResonantEnemy) {
      const base = currentUpgradeValue(definition, card, "shield") || 0;
      const bonus = currentUpgradeValue(definition, card, "resonanceCoverBonus") || definition.resonanceCoverBonus || 0;
      overrides.shield = base + bonus;
    }
  }

  if (card.id === "heal_resonance_suture") {
    const source = chooseHighestResonance(Core, state);
    if (source && S.stacks(source, "resonance") >= 2) {
      consumedResonance = consumeResonance(source, definition.resonanceSutureConsume || 2);
      const base = currentUpgradeValue(definition, card, "heal") || 0;
      const bonus = currentUpgradeValue(definition, card, "resonanceSutureBonus") || definition.resonanceSutureBonus || 0;
      overrides.heal = base + bonus;
    }
  }

  if (card.id === "absorb_resonance_condensation" && target) {
    consumedResonance = consumeResonance(target, definition.resonanceConsumeMax || 4);
    const base = currentUpgradeValue(definition, card, "absorb") || 0;
    const perStack = currentUpgradeValue(definition, card, "resonanceAbsorbPerStack") || definition.resonanceAbsorbPerStack || 0;
    overrides.absorb = base + consumedResonance * perStack;
  }

  if (card.id === "contact_resonance_piercing_needle" && target) {
    const stacks = S.stacks(target, "resonance");
    const cap = currentUpgradeValue(definition, card, "resonanceDamageCap") || definition.resonanceDamageCap || 0;
    const base = currentUpgradeValue(definition, card, "attack") || 0;
    overrides.attack = base + Math.min(stacks, cap) * (definition.resonanceDamagePerStack || 1);
  }

  if (definition.resonanceChainConsumeAll && target) {
    consumedResonance = consumeResonance(target, Infinity);
    const calcStacks = Math.min(consumedResonance, definition.resonanceChainCap || 10);
    const base = currentUpgradeValue(definition, card, "attack") || 0;
    const perStack = currentUpgradeValue(definition, card, "resonanceChainPerStack") || definition.resonanceChainPerStack || 0;
    const inverse = Math.min(consumedResonance, 5) * Core.power(state, "resonanceConsumeDamageBonus");
    overrides.attack = base + calcStacks * perStack + inverse;
    chainSplash = {
      mainTarget: target,
      amount: calcStacks * (definition.resonanceChainSplashPerStack || 0),
      resonanceAdd: definition.resonanceChainSplashAdd || 0,
    };
  } else if (definition.consumeResonance && target) {
    consumedResonance = S.stacks(target, "resonance");
    if (definition.attack && consumedResonance > 0) {
      const inverse = Math.min(consumedResonance, 5) * Core.power(state, "resonanceConsumeDamageBonus");
      if (inverse > 0) overrides.attack = (currentUpgradeValue(definition, card, "attack") || 0) + inverse;
    }
  }

  if (
    consumedResonance >= 6 &&
    !snapshot.interferenceTriggered &&
    Core.power(state, "resonanceConsumeRefundDraw") > 0 &&
    !battle._stagedCriticalDischarge
  ) {
    Core.gainCurrentAp(state, 1);
    Core.drawCards(state, 1);
    battle._stagedCriticalDischarge = true;
  }

  if (card.id === "absorb_supercritical_chain_catalyst" && snapshot.cardsPlayedBefore >= 4 && !battle._stagedFifthCardRefunded)
    overrides.draw = (overrides.draw ?? definition.draw ?? 0) + 1;

  const restore = installTemporaryCardValues(cards, card, overrides);
  return { overrides, consumedResonance, chainSplash, restore };
}

function applyChainSplashAfter(Core, state, prepared) {
  const splash = prepared?.chainSplash;
  if (!splash || !state?.battle) return;
  const battle = state.battle;
  if (splash.amount > 0) {
    for (const enemy of battle.enemies) {
      if (!enemy || enemy === splash.mainTarget || enemy.hp <= 0) continue;
      Core.dealEnemyDamage(state, enemy, splash.amount, {
        direct: false,
        bypassShield: true,
        statusId: "resonanceChainSplash",
        attackPattern: "nonContact",
      });
    }
  }
  if (splash.resonanceAdd > 0) {
    for (const enemy of battle.enemies) {
      if (enemy !== splash.mainTarget && enemy.hp > 0)
        applyEnemyStatus(enemy, "resonance", splash.resonanceAdd);
    }
  }
}

export function playWithStagedAugments(Core, cards, items, state, index, meta) {
  if (state?.phase !== "battle" || !state.battle) return Core.play(state, index, meta);
  ensureTurnState(state.battle);
  const battle = state.battle,
    card = battle.hand[index];
  if (!card || !cards[card.id]) return Core.play(state, index, meta);
  const definition = Core.cardDefinition(card),
    pattern = typeof Core.effectiveCardAttackPattern === "function"
      ? Core.effectiveCardAttackPattern(state, definition)
      : definition.attackPattern || (definition.attack || definition.burst || definition.weight ? "contact" : null),
    attackCard = Boolean(definition.attack || definition.burst || definition.weight),
    selected = Core.selectedEnemy(battle),
    paidCost = Core.cost(state, card),
    snapshot = {
      cardsPlayedBefore: battle.cardsPlayedThisTurn || 0,
      nonContactCardsBefore: battle.nonContactCardsPlayedThisTurn || 0,
      paidContactBefore: battle._stagedPaidContactCardsPlayed || 0,
      harmoniesBefore: battle.harmoniesThisTurn || 0,
      shieldBefore: battle.shield || 0,
      handBefore: battle.hand.length,
      playerRegenerationBefore: S.stacks(state, "regeneration"),
      selectedEnemy: selected,
      selectedBleedBefore: selected ? S.stacks(selected, "bleed") : 0,
      selectedAilmentTypesBefore: selected ? ailmentTypeCount(selected) : 0,
      enemyResonance: battle.enemies.map((enemy) => S.stacks(enemy, "resonance")),
      enemiesBefore: battle.enemies.map((enemy) => ({ hp: enemy.hp, resonance: S.stacks(enemy, "resonance") })),
      hitFeedbackBefore: (state._enemyHitFeedback || []).length,
      controlFeedbackBefore: state._controlFeedback,
      pendingDiscardBefore: battle.pendingDiscard || 0,
      pattern,
      attackCard,
      paidCost,
      interferenceTriggered: false,
    };
  let prepared = null;
  const result = Core.play(state, index, meta, {
    beforeEffect(context) {
      snapshot.interferenceTriggered = Boolean(context.interferenceTriggered);
      prepared = prepareCard(Core, cards, state, card, definition, snapshot);
      return prepared;
    },
    afterEffect() {
      applyChainSplashAfter(Core, state, prepared);
    },
    cleanupEffect() {
      prepared?.restore?.();
    },
  });
  if (!result) return result;
  const controlChanged = state._controlFeedback !== snapshot.controlFeedbackBefore,
    controlStatus = controlChanged ? state._controlFeedback?.statusId : null,
    confusionTriggered = controlStatus === "confusion",
    secondaryFailed = confusionTriggered || snapshot.interferenceTriggered,
    definitionAfter = cards[card.id];

  if (!secondaryFailed) {
    let refund = 0;
    switch (definitionAfter.stagedRefund) {
      case "paidContactBefore": refund = snapshot.paidContactBefore > 0 ? 1 : 0; break;
      case "ailmentTypes2": refund = snapshot.selectedAilmentTypesBefore >= 2 ? 1 : 0; break;
      case "shield12Before": refund = snapshot.shieldBefore >= 12 ? 1 : 0; break;
      case "regenerationBefore": refund = snapshot.playerRegenerationBefore >= 1 ? 1 : 0; break;
      case "harmonyCompletedByCard": refund = (battle.harmoniesThisTurn || 0) > snapshot.harmoniesBefore ? 1 : 0; break;
      case "hand6Before": refund = snapshot.handBefore >= 6 ? 1 : 0; break;
      case "targetBleed4Before": refund = snapshot.selectedBleedBefore >= 4 ? 1 : 0; break;
      case "ailmentTypes3": refund = snapshot.selectedAilmentTypesBefore >= 3 ? 2 : 0; break;
      case "fifthCardOnce":
        if (snapshot.cardsPlayedBefore >= 4 && !battle._stagedFifthCardRefunded) {
          refund = 2;
          battle._stagedFifthCardRefunded = true;
        }
        break;
      default: break;
    }
    if (refund > 0) Core.gainCurrentAp(state, refund);
  }

  if ((battle.pendingDiscard || 0) > snapshot.pendingDiscardBefore && definitionAfter.stagedDiscardRefundBaseCost)
    battle._stagedDiscardRefundQueue += (battle.pendingDiscard || 0) - snapshot.pendingDiscardBefore;

  if (attackCard && pattern === "contact" && paidCost > 0 && !confusionTriggered)
    battle._stagedPaidContactCardsPlayed += 1;

  applyResonanceBuffer(Core, state, snapshot);
  applyPostNonContactResonance(Core, state, snapshot);
  applyCaptureFlask(Core, state, snapshot.enemiesBefore);
  return result;
}

export function discardWithStagedAugments(Core, cards, state, index, meta) {
  const battle = state?.battle;
  if (!battle) return Core.discardFromHand(state, index, meta);
  ensureTurnState(battle);
  const discarded = battle.hand[index];
  const queued = battle._stagedDiscardRefundQueue || 0;
  const result = Core.discardFromHand(state, index, meta);
  if (!result || queued <= 0 || !discarded) return result;
  battle._stagedDiscardRefundQueue = Math.max(0, queued - 1);
  if ((cards[discarded.id]?.cost || 0) >= 2) Core.gainCurrentAp(state, 1);
  return result;
}
