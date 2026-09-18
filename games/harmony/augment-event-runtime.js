// Shared event/runtime semantics for the 2026-09-18 official augment pack.
// This module deliberately knows nothing about DOM. Engine Core injects canonical
// combat operations so draw/discard/card-use classification stays centralized.

export function isPhysicalImpurity(card) {
  return card?.id === "impurity";
}

function owns(state, id) {
  return Array.isArray(state?.inventory) && state.inventory.includes(id);
}

function itemCopies(state, items, effect) {
  if (!Array.isArray(state?.inventory)) return 0;
  return state.inventory.reduce(
    (count, id) => count + (items[id]?.effect === effect ? 1 : 0),
    0,
  );
}

export function isEffectiveImpurity(state, card, cards = {}) {
  if (isPhysicalImpurity(card)) return true;
  if (!card?.id || !cards[card.id]) return false;
  return owns(state, "relic_contaminated_perfumery_essence");
}

export function effectiveAttackPattern(
  state,
  definition,
  sourceType = "cardDirectAttack",
) {
  const canonical = definition?.attackPattern ||
    (definition?.attack || definition?.burst || definition?.weight ? "contact" : null);
  if (
    sourceType !== "cardDirectAttack" ||
    !canonical ||
    !owns(state, "relic_phase_crossing_lens")
  )
    return canonical;
  return canonical === "contact"
    ? "nonContact"
    : canonical === "nonContact"
      ? "contact"
      : canonical;
}

export function cardBaseAp(cards, card) {
  return Math.max(0, Number(cards?.[card?.id]?.cost) || 0);
}

export function acquisitionAllows(item, { source = null, eventRoom = null, shop = false, state = null } = {}) {
  const rule = item?.acquisition;
  if (!rule) return true;
  if (rule.requiresItem && !state?.inventory?.includes(rule.requiresItem)) return false;
  if (shop) return rule.shop !== false;
  if (eventRoom) return Array.isArray(rule.eventRooms) && rule.eventRooms.includes(eventRoom);
  if (source)
    return !Array.isArray(rule.rewardSources) || rule.rewardSources.includes(source);
  return true;
}

function allBattleCards(battle) {
  if (!battle) return [];
  return [
    ...(battle.hand || []),
    ...(battle.draw || []),
    ...(battle.discard || []),
    ...(battle.exhaust || []),
  ];
}

export function resetAugmentTurnState(state) {
  const b = state?.battle;
  if (!b) return;
  for (const card of allBattleCards(b)) {
    delete card._augmentTempCostReduction;
    delete card._augmentTempCostTurn;
    if (card._augmentFreeTurn !== b.turn) delete card._augmentFreeTurn;
  }
  b._augmentExtraDrawCount = 0;
  b._augmentCardsUsedThisTurn = 0;
  b._augmentActualDiscardsThisTurn = 0;
  b._augmentResonanceDrawEvents = 0;
  b._augmentFractionalDiscounted = 0;
  b._augmentHighCostDiscardAbsorbGained = 0;
  b._augmentWasteReclaimerSuccesses = 0;
  b._augmentBackflowSuccesses = 0;
  b._augmentOverflowAbsorbGained = 0;
  b._augmentImpurityUsesThisTurn = 0;
  b._augmentSedimentBoostUses = 0;
  b._augmentNextCardDiscount = 0;
  b._augmentActualDiscardInstanceIds = [];
  b._augmentActualDiscardSequence = Math.max(0, Number(b._augmentActualDiscardSequence) || 0);
  b._augmentFirstExtraShieldTriggered = false;
  b._augmentThirdExtraAbsorbTriggered = false;
  b._augmentThirdExtraDiscountTriggered = false;
  b._augmentSixthCardTriggered = false;
  b._augmentEighthCardTriggered = false;
  b._augmentSecondDiscardTriggered = false;
  b._augmentThirdDiscardBurnTriggered = false;
  b._augmentFirstHighCostDiscardTriggered = false;
  b._augmentFirstImpurityUseTriggered = false;
  b._augmentThirdImpurityUseTriggered = false;
  b._augmentFifthImpurityUseTriggered = false;
  b._augmentFirstImpurityDrawTriggered = false;
  b._augmentLargeHandTriggered = false;
  b._augmentLosslessTriggered = false;
  b.pendingAugmentRecovery = null;
  delete b._augmentAllCardsFreeTurn;
}

export function onAugmentTurnStart(state, items, api) {
  const b = state?.battle;
  if (!b) return;
  resetAugmentTurnState(state);
  if (
    owns(state, "relic_turn_zero_ap_chance") &&
    api.random(state) < 0.12
  ) {
    b._augmentAllCardsFreeTurn = b.turn;
    api.log?.(state, "불안정한 영구기관 발동 · 이번 턴 모든 액티브 카드 최종 AP 0");
    state._augmentTurnFeedback = {
      id: "relic_turn_zero_ap_chance",
      title: "불안정한 영구기관",
      detail: "이번 턴 모든 액티브 카드 AP 0",
    };
  }
}

export function augmentCardCost(state, card, currentCost = 0) {
  const b = state?.battle;
  if (!b || !card) return Math.max(0, currentCost);
  if (b._augmentAllCardsFreeTurn === b.turn || card._augmentFreeTurn === b.turn)
    return 0;
  const cardDiscount =
      card._augmentTempCostTurn === b.turn
        ? Math.max(0, Number(card._augmentTempCostReduction) || 0)
        : 0,
    nextDiscount = Math.max(0, Number(b._augmentNextCardDiscount) || 0);
  return Math.max(0, currentCost - cardDiscount - nextDiscount);
}

export function consumeAugmentCardCostState(state, card) {
  const b = state?.battle;
  if (!b || !card) return;
  b._augmentNextCardDiscount = 0;
  delete card._augmentTempCostReduction;
  delete card._augmentTempCostTurn;
  delete card._augmentFreeTurn;
}

function randomLivingEnemy(state, api) {
  const alive = api.livingEnemies(state.battle);
  return alive.length
    ? alive[Math.floor(api.random(state) * alive.length)]
    : null;
}

export function onAugmentDrawSuccess(state, card, drawKind, cards, items, api) {
  const b = state?.battle;
  if (!b || !card) return;
  const opening = drawKind === "opening",
    extra = drawKind === "extra",
    actualNonOpening = !opening;

  if (extra) {
    b._augmentExtraDrawCount = (b._augmentExtraDrawCount || 0) + 1;
    const extraCount = b._augmentExtraDrawCount,
      hygroscopic = itemCopies(state, items, "firstExtraDrawShield"),
      scentline = itemCopies(state, items, "thirdExtraDrawAbsorb"),
      resonance = itemCopies(state, items, "extraDrawRandomResonance"),
      chain = itemCopies(state, items, "thirdExtraDrawNextCardDiscount");

    if (extraCount === 1 && hygroscopic && !b._augmentFirstExtraShieldTriggered) {
      b._augmentFirstExtraShieldTriggered = true;
      api.gainShield(state, 4 * hygroscopic);
    }
    if (resonance && (b._augmentResonanceDrawEvents || 0) < 3) {
      const enemy = randomLivingEnemy(state, api);
      if (enemy) api.applyEnemyStatus(state, enemy, "resonance", resonance);
      b._augmentResonanceDrawEvents = (b._augmentResonanceDrawEvents || 0) + 1;
    }
    if (extraCount === 3 && scentline && !b._augmentThirdExtraAbsorbTriggered) {
      b._augmentThirdExtraAbsorbTriggered = true;
      api.gainAbsorb(state, 4 * scentline);
    }
    if (extraCount === 3 && chain && !b._augmentThirdExtraDiscountTriggered) {
      b._augmentThirdExtraDiscountTriggered = true;
      b._augmentNextCardDiscount = Math.max(
        b._augmentNextCardDiscount || 0,
        chain,
      );
    }
    if (
      owns(state, "relic_fractional_cost_reducer") &&
      (b._augmentFractionalDiscounted || 0) < 2
    ) {
      b._augmentFractionalDiscounted = (b._augmentFractionalDiscounted || 0) + 1;
      card._augmentTempCostReduction =
        Math.max(0, Number(card._augmentTempCostReduction) || 0) + 1;
      card._augmentTempCostTurn = b.turn;
    }
  }

  if (
    actualNonOpening &&
    owns(state, "relic_automatic_fragrance_sprayer")
  ) {
    const enemy = randomLivingEnemy(state, api);
    if (enemy) {
      const amount = 1 + Math.max(0, Number(api.attackPower(state)) || 0);
      api.dealEnemyDamage(state, enemy, amount, {
        direct: true,
        attackPattern: "nonContact",
        fx: {
          source: "relic",
          sourceId: "relic_automatic_fragrance_sprayer",
          hitCount: 1,
        },
      });
    }
  }

  if (actualNonOpening && isEffectiveImpurity(state, card, cards)) {
    if (
      owns(state, "relic_cloudy_filter_clip") &&
      !b._augmentFirstImpurityDrawTriggered
    ) {
      b._augmentFirstImpurityDrawTriggered = true;
      api.gainShield(state, 3);
    }
    if (
      owns(state, "relic_backflow_filter_distiller") &&
      (b._augmentBackflowSuccesses || 0) < 2 &&
      api.random(state) < 0.3
    ) {
      b._augmentBackflowSuccesses = (b._augmentBackflowSuccesses || 0) + 1;
      api.gainAp(state, 1);
    }
  }
}

export function onAugmentFailedDraw(state, reason, items, api) {
  const b = state?.battle;
  if (!b || reason !== "handLimit") return;
  if (!owns(state, "relic_overflow_fragrance_recovery_tube")) return;
  const gained = Math.max(0, Number(b._augmentOverflowAbsorbGained) || 0);
  if (gained >= 9) return;
  const amount = Math.min(3, 9 - gained);
  b._augmentOverflowAbsorbGained = gained + api.gainAbsorb(state, amount);
}

export function onAugmentReshuffle(state, items, api) {
  const b = state?.battle;
  if (!b) return;
  b._augmentReshufflesThisCombat =
    Math.max(0, Number(b._augmentReshufflesThisCombat) || 0) + 1;
  const eventIndex = b._augmentReshufflesThisCombat;
  if (eventIndex > 2) return;

  if (owns(state, "trait_recirculation_distillation_plate")) {
    api.gainAp(state, 1);
    api.gainShield(state, 6);
  }
  if (owns(state, "relic_waste_fragrance_separation_funnel")) {
    api.gainShield(state, 8);
    api.drawCards(state, 1, false);
  }
}

function ensureDiscardInstance(battle, card) {
  if (!card._augmentInstanceId) {
    battle._augmentActualDiscardSequence =
      Math.max(0, Number(battle._augmentActualDiscardSequence) || 0) + 1;
    card._augmentInstanceId = battle._augmentActualDiscardSequence;
  }
  return card._augmentInstanceId;
}

function applyDiscardCardEffect(state, card, definition, api) {
  if (definition?.discardedGainShield)
    api.gainShield(state, definition.discardedGainShield);

  if (definition?.discardedDrawOne) {
    api.drawCards(state, definition.discardedDrawOne, false);
    const chance = Math.max(0, Number(definition.discardedExtraDrawChance) || 0);
    if (chance > 0 && api.random(state) < chance)
      api.drawCards(state, 1, false);
  }

  if (definition?.discardedRandomBurn) {
    const enemy = randomLivingEnemy(state, api);
    if (enemy)
      api.applyEnemyStatus(
        state,
        enemy,
        "burning",
        definition.discardedRandomBurn,
      );
  }
}

export function onAugmentActualDiscard(
  state,
  card,
  definition,
  sourceEffect,
  cards,
  items,
  api,
) {
  const b = state?.battle;
  if (!b || !card) return;
  delete card._augmentTempCostReduction;
  delete card._augmentTempCostTurn;
  delete card._augmentFreeTurn;

  b._augmentActualDiscardsThisTurn =
    (b._augmentActualDiscardsThisTurn || 0) + 1;
  const discardCount = b._augmentActualDiscardsThisTurn,
    instanceId = ensureDiscardInstance(b, card);
  b._augmentActualDiscardInstanceIds ??= [];
  b._augmentActualDiscardInstanceIds.push(instanceId);

  applyDiscardCardEffect(state, card, definition, api);

  const baseAp = cardBaseAp(cards, card),
    selective = itemCopies(state, items, "secondDiscardNextCardDiscount"),
    sorter = itemCopies(state, items, "highCostDiscardAbsorb"),
    wasteChain = itemCopies(state, items, "thirdDiscardBurnAll"),
    highPressure = itemCopies(state, items, "firstHighCostDiscardDrawTwo"),
    altered = itemCopies(state, items, "discardImpurityShield"),
    turbid = itemCopies(state, items, "discardImpurityDrawChance");

  if (discardCount === 2 && selective && !b._augmentSecondDiscardTriggered) {
    b._augmentSecondDiscardTriggered = true;
    b._augmentNextCardDiscount = Math.max(
      b._augmentNextCardDiscount || 0,
      selective,
    );
  }

  if (baseAp >= 2 && sorter) {
    const cap = 6 * sorter,
      gained = Math.max(0, Number(b._augmentHighCostDiscardAbsorbGained) || 0),
      amount = Math.min(3 * sorter, Math.max(0, cap - gained));
    if (amount > 0)
      b._augmentHighCostDiscardAbsorbGained =
        gained + api.gainAbsorb(state, amount);
  }

  if (discardCount === 3 && wasteChain && !b._augmentThirdDiscardBurnTriggered) {
    b._augmentThirdDiscardBurnTriggered = true;
    for (const enemy of api.livingEnemies(b))
      api.applyEnemyStatus(state, enemy, "burning", 3);
  }

  if (baseAp >= 2 && highPressure && !b._augmentFirstHighCostDiscardTriggered) {
    b._augmentFirstHighCostDiscardTriggered = true;
    api.drawCards(state, 2, false);
  }

  const effectiveImpurity = isEffectiveImpurity(state, card, cards);
  if (effectiveImpurity && altered)
    api.gainShield(state, 2 * altered);

  if (
    effectiveImpurity &&
    turbid &&
    (b._augmentWasteReclaimerSuccesses || 0) < 2 &&
    api.random(state) < Math.min(0.6, 0.3 * turbid)
  ) {
    b._augmentWasteReclaimerSuccesses =
      (b._augmentWasteReclaimerSuccesses || 0) + 1;
    api.drawCards(state, 1, false);
  }

  if (
    sourceEffect?.augmentSourceCardId ===
      "cycle_redistillation_recovery_fluid" &&
    !sourceEffect?.suppressAugmentSecondary &&
    baseAp >= Math.max(0, Number(sourceEffect.augmentDiscardMinBaseAp) || 0)
  ) {
    if (sourceEffect.augmentDiscardShield)
      api.gainShield(state, sourceEffect.augmentDiscardShield);
    if (sourceEffect.augmentDiscardAbsorb)
      api.gainAbsorb(state, sourceEffect.augmentDiscardAbsorb);
  }

  if (
    discardCount === 3 &&
    owns(state, "relic_lossless_redistiller") &&
    !b._augmentLosslessTriggered
  ) {
    const available = new Set(
      b.discard
        .filter((candidate) =>
          b._augmentActualDiscardInstanceIds.includes(candidate._augmentInstanceId),
        )
        .map((candidate) => candidate._augmentInstanceId),
    );
    if (available.size) {
      b._augmentLosslessTriggered = true;
      b.pendingAugmentRecovery = {
        turn: b.turn,
        instanceIds: [...available],
      };
    }
  }
}

export function recoverAugmentDiscard(state, instanceId) {
  const b = state?.battle,
    pending = b?.pendingAugmentRecovery;
  if (!b || !pending || pending.turn !== b.turn) return null;
  const numericId = Number(instanceId),
    allowed = pending.instanceIds.includes(numericId),
    index = b.discard.findIndex(
      (card) => card._augmentInstanceId === numericId,
    );
  if (!allowed || index < 0) return null;
  const [card] = b.discard.splice(index, 1);
  card._augmentFreeTurn = b.turn;
  delete card._augmentTempCostReduction;
  delete card._augmentTempCostTurn;
  b.hand.push(card);
  b.pendingAugmentRecovery = null;
  return card;
}

export function onAugmentCardUseStart(
  state,
  card,
  cards,
  items,
  api,
  { handCountBefore = null } = {},
) {
  const b = state?.battle;
  if (!b || !card) return { resourceMultiplier: 1 };
  const handCount = Number.isFinite(handCountBefore)
    ? handCountBefore
    : b.hand.length;

  if (
    owns(state, "relic_saturated_scent_clip") &&
    !b._augmentLargeHandTriggered &&
    handCount >= 6
  ) {
    b._augmentLargeHandTriggered = true;
    api.gainShield(state, 3);
  }

  let resourceMultiplier = 1;
  if (
    owns(state, "relic_sediment_concentrator") &&
    (b._augmentSedimentBoostUses || 0) < 2
  ) {
    const remainingImpurities = b.hand.reduce(
        (count, held) =>
          count + (isEffectiveImpurity(state, held, cards) ? 1 : 0),
        0,
      ),
      impurityCount =
        remainingImpurities + (isEffectiveImpurity(state, card, cards) ? 1 : 0);
    if (impurityCount >= 3) {
      b._augmentSedimentBoostUses = (b._augmentSedimentBoostUses || 0) + 1;
      resourceMultiplier = 1.25;
    }
  }
  return { resourceMultiplier };
}

function resolveRoulette(state, items, api, parentSource = null) {
  const roll = Math.floor(api.random(state) * 5);
  if (roll === 0) {
    const enemy = randomLivingEnemy(state, api);
    if (enemy)
      api.dealEnemyDamage(state, enemy, 4, {
        direct: true,
        fx: {
          source: "relic",
          sourceId: "relic_impurity_reaction_roulette",
          impurityRandomEffect: true,
          parentSource,
        },
      });
  } else if (roll === 1) {
    api.gainShield(state, 3);
  } else if (roll === 2) {
    api.gainAbsorb(state, 2);
  } else if (roll === 3) {
    const enemy = randomLivingEnemy(state, api);
    if (enemy) api.applyEnemyStatus(state, enemy, "burning", 1);
  } else {
    const enemy = randomLivingEnemy(state, api);
    if (enemy) api.applyEnemyStatus(state, enemy, "poison", 1);
  }
  return roll;
}

export function onAugmentCardUsed(state, card, cards, items, api) {
  const b = state?.battle;
  if (!b || !card) return;
  b._augmentCardsUsedThisTurn = (b._augmentCardsUsedThisTurn || 0) + 1;
  const usedCount = b._augmentCardsUsedThisTurn;

  if (
    usedCount === 6 &&
    owns(state, "trait_high_speed_perfumery_loop") &&
    !b._augmentSixthCardTriggered
  ) {
    b._augmentSixthCardTriggered = true;
    api.drawCards(state, 2, false);
  }
  if (
    usedCount === 8 &&
    owns(state, "trait_hypercycle_fragrance_engine") &&
    !b._augmentEighthCardTriggered
  ) {
    b._augmentEighthCardTriggered = true;
    api.gainAp(state, 2);
    api.drawCards(state, 2, false);
  }

  if (!isEffectiveImpurity(state, card, cards)) return;
  b._augmentImpurityUsesThisTurn = (b._augmentImpurityUsesThisTurn || 0) + 1;
  const impurityUses = b._augmentImpurityUsesThisTurn,
    membrane = itemCopies(state, items, "firstImpurityUseAbsorb"),
    catalyst = itemCopies(state, items, "firstImpurityUseCorrosion");

  if (impurityUses === 1 && !b._augmentFirstImpurityUseTriggered) {
    b._augmentFirstImpurityUseTriggered = true;
    if (membrane) api.gainAbsorb(state, 2 * membrane);
    if (catalyst) {
      const enemy = randomLivingEnemy(state, api);
      if (enemy) api.applyEnemyStatus(state, enemy, "corrosion", catalyst);
    }
  }

  if (
    impurityUses === 3 &&
    owns(state, "trait_contamination_critical_reaction") &&
    !b._augmentThirdImpurityUseTriggered
  ) {
    b._augmentThirdImpurityUseTriggered = true;
    for (const enemy of api.livingEnemies(b))
      api.applyEnemyStatus(state, enemy, "poison", 2);
  }

  if (
    impurityUses === 5 &&
    owns(state, "trait_complete_contamination_adaptation") &&
    !b._augmentFifthImpurityUseTriggered
  ) {
    b._augmentFifthImpurityUseTriggered = true;
    api.gainAp(state, 2);
    api.drawCards(state, 2, false);
  }

  if (owns(state, "relic_impurity_reaction_roulette")) {
    resolveRoulette(state, items, api, null);
    if (owns(state, "relic_turbid_distillation_core"))
      resolveRoulette(
        state,
        items,
        api,
        "relic_turbid_distillation_core",
      );
  }
}

export function pendingAugmentRecoveryCards(state) {
  const b = state?.battle,
    pending = b?.pendingAugmentRecovery;
  if (!b || !pending || pending.turn !== b.turn) return [];
  const allowed = new Set(pending.instanceIds || []);
  return b.discard.filter((card) => allowed.has(card._augmentInstanceId));
}
