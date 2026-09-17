from pathlib import Path
import re

core_path = Path("games/harmony/engine-core.js")
core = core_path.read_text()

old_sig = "export function play(s, index, meta) {"
assert core.count(old_sig) == 1, "engine-core play signature changed"
core = core.replace(old_sig, "export function play(s, index, meta, hooks = null) {", 1)

effect_pattern = re.compile(
    r"  const hpBeforeCard = s\.hp,\n"
    r"\s+shieldBeforeCard = b\.shield,\n"
    r"\s+absorbBeforeCard = b\.absorb,\n"
    r"\s+targets = effect\(s, card\);"
)
new_effect = """  const hpBeforeCard = s.hp,
    shieldBeforeCard = b.shield,
    absorbBeforeCard = b.absorb,
    effectHookContext = {
      state: s,
      battle: b,
      card,
      definition,
      paidCost,
      interferenceTriggered,
      meta,
    };
  let effectHookState = null,
    targets = [];
  try {
    effectHookState = hooks?.beforeEffect?.(effectHookContext) ?? null;
    targets = effect(s, card);
    hooks?.afterEffect?.({ ...effectHookContext, targets, hookState: effectHookState });
  } finally {
    hooks?.cleanupEffect?.({ ...effectHookContext, targets, hookState: effectHookState });
  }"""
core, count = effect_pattern.subn(new_effect, core, count=1)
assert count == 1, "engine-core effect block changed"

marker = "export function play(s, index, meta, hooks = null) {"
helpers = """export function dealEnemyDamage(s, enemy, amount, options = {}) {
  return damage(s, amount, { ...options, targetEnemy: enemy });
}
export function drawCards(s, amount, turnStart = false) {
  return draw(s, amount, turnStart);
}
"""
assert core.count(marker) == 1
core = core.replace(marker, helpers + marker, 1)
core_path.write_text(core)

runtime_path = Path("games/harmony/staged-augment-runtime.js")
runtime = runtime_path.read_text()

helper_pattern = re.compile(
    r"function withTemporaryCardValues\(cards, card, overrides, callback\) \{.*?\n\}\n\n"
    r"function uniqueHitTargetIndexes\(state, pattern\) \{.*?\n\}",
    re.S,
)
helper_replacement = """function installTemporaryCardValues(cards, card, overrides) {
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
}"""
runtime, count = helper_pattern.subn(helper_replacement, runtime, count=1)
assert count == 1, "temporary card helper block changed"

old_targets = 'const targets = uniqueHitTargetIndexes(state, "nonContact")'
assert old_targets in runtime
runtime = runtime.replace(
    old_targets,
    'const targets = uniqueHitTargetIndexes(state, "nonContact", snapshot.hitFeedbackBefore)',
    1,
)
old_hits = 'const hits = (state._enemyHitFeedback || []).filter((hit) => !hit.statusId && (hit.damage > 0 || hit.blocked > 0));'
assert old_hits in runtime
runtime = runtime.replace(
    old_hits,
    'const hits = (state._enemyHitFeedback || []).slice(snapshot.hitFeedbackBefore).filter((hit) => !hit.statusId && (hit.damage > 0 || hit.blocked > 0));',
    1,
)

old_locals = "  let consumedResonance = 0;\n  let chainSplash = null;\n  let criticalDischarge = false;\n"
assert old_locals in runtime
runtime = runtime.replace(old_locals, "  let consumedResonance = 0;\n  let chainSplash = null;\n", 1)

old_critical = """  if (consumedResonance >= 6 && Core.power(state, "resonanceConsumeRefundDraw") > 0 && !battle._stagedCriticalDischarge) {
    criticalDischarge = true;
    overrides.draw = (definition.draw || 0) + 1;
  }
"""
new_critical = """  if (
    consumedResonance >= 6 &&
    !snapshot.interferenceTriggered &&
    Core.power(state, "resonanceConsumeRefundDraw") > 0 &&
    !battle._stagedCriticalDischarge
  ) {
    Core.gainCurrentAp(state, 1);
    Core.drawCards(state, 1);
    battle._stagedCriticalDischarge = true;
  }
"""
assert old_critical in runtime, "critical discharge block changed"
runtime = runtime.replace(old_critical, new_critical, 1)
old_return = "  return { overrides, consumedResonance, chainSplash, criticalDischarge };"
assert old_return in runtime
runtime = runtime.replace(
    old_return,
    "  const restore = installTemporaryCardValues(cards, card, overrides);\n  return { overrides, consumedResonance, chainSplash, restore };",
    1,
)

splash_pattern = re.compile(
    r"function applyChainSplashPre\(Core, state, snapshot, prepared\) \{.*?\n\}\n\n"
    r"function finishChainSplash\(state, prepared\) \{.*?\n\}",
    re.S,
)
splash_replacement = """function applyChainSplashAfter(Core, state, prepared) {
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
}"""
runtime, count = splash_pattern.subn(splash_replacement, runtime, count=1)
assert count == 1, "chain splash block changed"

play_pattern = re.compile(
    r"export function playWithStagedAugments\(Core, cards, items, state, index, meta\) \{.*?\n\}\n\n"
    r"export function discardWithStagedAugments",
    re.S,
)
play_replacement = """export function playWithStagedAugments(Core, cards, items, state, index, meta) {
  if (state?.phase !== "battle" || !state.battle) return Core.play(state, index, meta);
  ensureTurnState(state.battle);
  const battle = state.battle,
    card = battle.hand[index];
  if (!card || !cards[card.id]) return Core.play(state, index, meta);
  const definition = Core.cardDefinition(card),
    pattern = definition.attackPattern || (definition.attack || definition.burst || definition.weight ? "contact" : null),
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

export function discardWithStagedAugments"""
runtime, count = play_pattern.subn(play_replacement, runtime, count=1)
assert count == 1, "playWithStagedAugments block changed"

runtime_path.write_text(runtime)
