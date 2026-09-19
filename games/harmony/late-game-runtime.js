import { CARDS } from "./data.js";
import {
  ACT7_ROUTES,
  abyssDepth,
  act7RouteFor,
  campaignActInfo,
  emptyAct6RouteStats,
  isAbyssRun,
  scoreAct6Card,
} from "./campaign-progression.js";
import {
  ABYSS_BOSSES,
  ABYSS_ELITES,
  ABYSS_NORMALS,
  LATE_GAME_ACTS,
  encounterValid,
} from "./late-game-content.js";

const NOTE_ORDER = ["top", "middle", "base"];

function actKeyForRun(run) {
  const loop = Math.max(0, Math.floor(Number(run?.loop) || 0));
  if (loop === 3) return "act4";
  if (loop === 4) return "act5";
  if (loop === 5) return "act6";
  if (loop === 6) return `act${act7RouteFor(run)}`;
  return loop >= 7 ? "abyss" : null;
}

export function lateGameActInfo(run) {
  return campaignActInfo(run?.loop, run);
}

function pick(Core, run, values) {
  if (!values.length) return null;
  return values[Math.floor(Core.random(run) * values.length)];
}

function shuffle(Core, run, values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(Core.random(run) * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function abyssMultipliers(run) {
  const depth = abyssDepth(run);
  return {
    hp: depth ? 1 + Math.min(3, (depth - 1) * 0.18) : 1,
    attack: depth ? 1 + Math.min(2, (depth - 1) * 0.08) : 1,
  };
}

function scaleAction(action, multiplier) {
  const next = structuredClone(action);
  for (const key of ["value", "guard", "allyGuard"])
    if (Number.isFinite(next?.[key])) next[key] = Math.max(0, Math.round(next[key] * multiplier));
  return next;
}

function scaledTemplate(run, template) {
  if (!isAbyssRun(run)) return structuredClone(template);
  const { hp, attack } = abyssMultipliers(run),
    clone = structuredClone(template);
  clone.baseHp = Math.max(1, Math.round(clone.baseHp * hp));
  if (Array.isArray(clone.pattern)) clone.pattern = clone.pattern.map((action) => scaleAction(action, attack));
  return clone;
}

function createEnemy(Core, S, run, template, hpRatio = 1) {
  const source = scaledTemplate(run, template),
    hp = Math.max(1, Math.round(source.baseHp * hpRatio)),
    enemy = {
      id: source.id,
      name: source.name,
      material: source.material || "spirit",
      hp,
      maxHp: hp,
      shield: 0,
      intent: null,
      pattern: Array.isArray(source.pattern) ? structuredClone(source.pattern) : null,
      patternFixedTurns: Number.isInteger(source.patternFixedTurns) ? source.patternFixedTurns : null,
      patternRepeatDecay: source.patternRepeatDecay,
      phases: Array.isArray(source.phases) ? structuredClone(source.phases) : null,
      conditionalActions: Array.isArray(source.conditionalActions) ? structuredClone(source.conditionalActions) : null,
      intentVisibility: source.intentVisibility || null,
      statuses: S.createStatuses(),
      isElite: Boolean(source.isElite),
      isBoss: Boolean(source.isBoss),
      stunResistance: 0,
      lastAction: null,
      unlockId: source.unlockId || null,
      signatureReward: source.signatureReward || null,
      scaleWithAct: false,
      scaleAttackWithAct: false,
      loopPattern: source.loopPattern !== false,
      encounterTags: [...(source.encounterTags || [])],
      mechanic: source.mechanic || null,
      customState: structuredClone(source.customState || {}),
    };
  for (const [statusId, amount] of Object.entries(source.initialStatuses || {}))
    S.applyStatus(enemy, statusId, structuredClone(amount));
  const turn = Math.max(1, Math.floor(Number(run?.battle?.turn) || 1));
  if (enemy.pattern?.length)
    enemy.intent = structuredClone(enemy.pattern[(turn - 1) % enemy.pattern.length]);
  return enemy;
}

function actPools(run) {
  const key = actKeyForRun(run);
  if (key === "abyss") return { normals: ABYSS_NORMALS, elites: ABYSS_ELITES, bosses: ABYSS_BOSSES };
  return LATE_GAME_ACTS[key] || null;
}

function chooseNormalTemplates(Core, run, pool, count) {
  const values = Object.values(pool);
  if (!values.length) return [];
  for (let attempt = 0; attempt < 80; attempt++) {
    const chosen = shuffle(Core, run, values).slice(0, Math.min(count, values.length));
    if (encounterValid(chosen)) return chosen;
  }
  const safe = [];
  for (const candidate of shuffle(Core, run, values)) {
    if (encounterValid([...safe, candidate])) safe.push(candidate);
    if (safe.length >= count) break;
  }
  return safe.length ? safe : [pick(Core, run, values)];
}

function initializeEncounterState(Core, run) {
  const enemies = run?.battle?.enemies || [];
  for (const enemy of enemies) {
    enemy.customState ??= {};
    const state = enemy.customState;
    if (enemy.mechanic === "transferBurnOnDeath") {
      const targets = enemies.filter((other) => other !== enemy && other.hp > 0);
      const target = pick(Core, run, targets);
      state.targetId = target?.id || null;
      state.burnTransferred = false;
    }
    if (enemy.mechanic === "discordAndHarmony") {
      state.discordNote ??= NOTE_ORDER[0];
      state.discord ??= 0;
      state.harmonyCounter ??= 0;
    }
    if (enemy.mechanic === "rotatingNoteSeal") state.sealIndex ??= 0;
    if (enemy.mechanic === "recentThreeTurnMemory") state.recentTurns ??= [];
  }
}

export function replaceLateGameEncounter(Core, S, run, meta, defeatedBefore = null) {
  const pools = actPools(run),
    room = Core.roomAt(run);
  if (!pools || !run?.battle || !["battle", "elite", "boss"].includes(room)) return false;

  let enemies = [];
  if (room === "battle") {
    const roll = Core.random(run),
      count = roll < 0.5 ? 1 : roll < 0.85 ? 2 : 3,
      hpRatio = count === 1 ? 1 : count === 2 ? 0.65 : 0.5,
      templates = chooseNormalTemplates(Core, run, pools.normals, count);
    enemies = templates.map((template) => createEnemy(Core, S, run, template, hpRatio));
  } else if (room === "elite") {
    const template = pick(Core, run, Object.values(pools.elites));
    if (template) enemies = [createEnemy(Core, S, run, template)];
  } else {
    const template = pick(Core, run, Object.values(pools.bosses));
    if (template) enemies = [createEnemy(Core, S, run, template)];
  }
  if (!enemies.length) return false;

  run.battle.enemies = enemies;
  run.battle.selectedTarget = 0;
  run.battle.boss = room === "boss";
  run.battle.elite = room === "elite";
  Core.attachEnemyAliases(run.battle);
  initializeEncounterState(Core, run);

  if (meta) {
    meta.defeatedMonsters ??= [];
    if (Array.isArray(defeatedBefore)) meta.defeatedMonsters = [...defeatedBefore];
    for (const enemy of enemies)
      if (!meta.defeatedMonsters.includes(enemy.id)) meta.defeatedMonsters.push(enemy.id);
  }
  return true;
}

function statusStacks(entity, id) {
  const value = entity?.statuses?.[id];
  return typeof value === "number" ? value : Math.max(0, Number(value?.stacks) || 0);
}

function cardIsAttack(card) {
  return Boolean(card?.attack || card?.burst || card?.weight || card?.attackPattern);
}

function cardPattern(card) {
  return card?.attackPattern || (cardIsAttack(card) ? "contact" : null);
}

function currentPlayerTurnProfile(run) {
  const battle = run?.battle;
  if (!battle)
    return {
      cards: 0,
      attacks: 0,
      contact: 0,
      nonContact: 0,
      shieldGained: 0,
      harmonies: 0,
      notes: { top: 0, middle: 0, base: 0 },
    };
  const notes = { top: 0, middle: 0, base: 0 };
  for (const definition of battle.cardsPlayedDefinitions || []) {
    if (definition?.note && definition.note in notes) notes[definition.note]++;
  }
  const contact = Math.max(0, Number(battle.contactCardsPlayedThisTurn) || 0),
    nonContact = Math.max(0, Number(battle.nonContactCardsPlayedThisTurn) || 0);
  return {
    cards: Math.max(0, Number(battle.cardsPlayedThisTurn) || 0),
    attacks: contact + nonContact,
    contact,
    nonContact,
    shieldGained: Math.max(0, Number(battle.lateShieldGainedThisTurn) || 0),
    harmonies: Math.max(0, Number(battle.harmoniesThisTurn) || 0),
    notes,
  };
}

function lastPlayerTurnProfile(run) {
  return run?.battle?.lateLastTurnProfile || currentPlayerTurnProfile(run);
}

function aggregateProfiles(profiles = []) {
  const result = {
    cards: 0,
    attacks: 0,
    contact: 0,
    nonContact: 0,
    shieldGained: 0,
    harmonies: 0,
    notes: { top: 0, middle: 0, base: 0 },
  };
  for (const profile of profiles) {
    for (const key of ["cards", "attacks", "contact", "nonContact", "shieldGained", "harmonies"])
      result[key] += Math.max(0, Number(profile?.[key]) || 0);
    for (const note of NOTE_ORDER) result.notes[note] += Math.max(0, Number(profile?.notes?.[note]) || 0);
  }
  return result;
}

function inspectionProgress(profile, inspection) {
  if (inspection === "attack3") return { current: profile.attacks, target: 3 };
  if (inspection === "nonContact2") return { current: profile.nonContact, target: 2 };
  return { current: profile.shieldGained, target: 20 };
}

function prepareArchivistReplay(enemy, action) {
  const state = enemy.customState || (enemy.customState = {}),
    held = state.storedCard,
    card = held?.id ? CARDS[held.id] : null;
  if (!card) {
    action.type = "attack";
    action.value = 10;
    action.hits = 1;
    action.attackPattern = "nonContact";
    action.name = "빈 페이지";
    action._lateReplayReturn = false;
    return;
  }

  const attackValue = [card.attack, card.burst, card.weight]
    .map((value) => Number(value))
    .find((value) => Number.isFinite(value) && value > 0);
  if (Number.isFinite(attackValue)) {
    action.type = "attack";
    action.value = Math.max(6, Math.round(attackValue * 0.7));
    action.hits = Math.max(1, Math.min(3, Math.floor(Number(card.hits) || 1)));
    action.attackPattern = card.attackPattern || "contact";
  } else if (Number.isFinite(card.shield) && card.shield > 0) {
    action.type = "guard";
    action.value = Math.min(28, Math.max(6, Math.round(card.shield * 0.8)));
    delete action.hits;
  } else if (Number.isFinite(card.heal) && card.heal > 0) {
    action.type = "guard";
    action.value = 0;
    action._lateReplayHeal = Math.min(24, Math.max(4, Math.round(card.heal * 0.6)));
    delete action.hits;
  } else {
    const statusId = Object.keys(card.applyEnemy || {}).find((id) =>
      ["weak", "vulnerable", "corrosion", "burning", "poison", "bleed"].includes(id),
    );
    if (statusId) {
      action.type = "debuff";
      action.value = 0;
      action.applyPlayer = { [statusId]: 1 };
      delete action.hits;
    } else {
      action.type = "guard";
      action.value = 14;
      delete action.hits;
    }
  }
  action.name = `기록 재현 · ${card.name || held.id}`;
  action._lateReplayReturn = true;
}

function dominantAnalysis(profile) {
  if ((profile?.harmonies || 0) > 0) return "harmony";
  if ((profile?.contact || 0) >= 2 && profile.contact > (profile.nonContact || 0)) return "contact";
  if ((profile?.nonContact || 0) >= 2 && profile.nonContact > (profile.contact || 0)) return "nonContact";
  if ((profile?.cards || 0) >= 4) return "cards";
  return "mixed";
}

function memoryAnalysis(profiles = []) {
  const aggregate = aggregateProfiles(profiles.slice(-3)),
    total = NOTE_ORDER.reduce((sum, note) => sum + aggregate.notes[note], 0);
  if (!total) return { note: null, confidence: 0 };
  const note = [...NOTE_ORDER].sort((a, b) => aggregate.notes[b] - aggregate.notes[a])[0],
    confidence = aggregate.notes[note] / total;
  return { note: confidence >= 0.5 ? note : null, confidence };
}

function snapshotStatus(entity, id) {
  return entity?.statuses?.[id] ? structuredClone(entity.statuses[id]) : null;
}

function restoreStatus(entity, id, snapshot) {
  entity.statuses ??= {};
  if (snapshot) entity.statuses[id] = snapshot;
  else delete entity.statuses[id];
}

export function withLatePlayerCardDefenses(S, run, card, action) {
  if (!run?.battle || !card || typeof action !== "function") return action();
  const pattern = cardPattern(card),
    note = card.note || null,
    snapshots = [];

  for (const enemy of run.battle.enemies || []) {
    if (!enemy || enemy.hp <= 0) continue;
    const state = enemy.customState || (enemy.customState = {});
    let protection = 0,
      vulnerable = 0;

    if (state.patternResistanceActive && state.resistPattern === pattern) protection = Math.max(protection, 3);
    if (state.adaptiveActive && state.analysis === pattern) protection = Math.max(protection, 3);
    if (state.memoryAnalysisActive && state.analyzedNote && state.analyzedNote === note)
      protection = Math.max(protection, 2);
    if (state.linkedProtectorId) protection = Math.max(protection, 3);
    if (enemy.mechanic === "woundRiskReward")
      vulnerable = Math.min(3, Math.floor((Number(state.wound) || 0) / 3));

    if (!protection && !vulnerable) continue;
    snapshots.push({
      enemy,
      protection: snapshotStatus(enemy, "protection"),
      vulnerable: snapshotStatus(enemy, "vulnerable"),
    });
    if (protection) S.applyStatus(enemy, "protection", { stacks: protection, turns: 1 });
    if (vulnerable) S.applyStatus(enemy, "vulnerable", vulnerable);
  }

  try {
    return action();
  } finally {
    for (const snapshot of snapshots) {
      restoreStatus(snapshot.enemy, "protection", snapshot.protection);
      restoreStatus(snapshot.enemy, "vulnerable", snapshot.vulnerable);
    }
  }
}

export function prepareLateEnemyAction(run, enemy) {
  const action = enemy?.intent;
  if (!run?.battle || !enemy || !action || action._latePrepared) return action;
  action._latePrepared = true;
  const state = enemy.customState || (enemy.customState = {}),
    late = action.lateState || {},
    profile = lastPlayerTurnProfile(run);

  if (late.scaleByCounter && Array.isArray(late.values)) {
    const count = Math.max(0, Math.min(late.values.length - 1, Math.floor(Number(state[late.scaleByCounter]) || 0)));
    action.value = late.values[count];
  }
  if (late.bonusIf && state[late.bonusIf] && Number.isFinite(late.bonusValue))
    action.value = Math.max(0, (Number(action.value) || 0) + late.bonusValue);
  if (Array.isArray(late.bonusIfPlayerStatus)) {
    const [statusId, bonus] = late.bonusIfPlayerStatus;
    if (statusStacks(run, statusId) > 0) action.value = Math.max(0, (Number(action.value) || 0) + Number(bonus || 0));
  }
  if (Array.isArray(late.bonusIfPlayerShield)) {
    const [threshold, bonus] = late.bonusIfPlayerShield;
    if ((run.battle.shield || 0) >= Number(threshold || 0))
      action.value = Math.max(0, (Number(action.value) || 0) + Number(bonus || 0));
  }
  if (Array.isArray(late.playerShieldScaling)) {
    const [low, lowBonus, high, highBonus] = late.playerShieldScaling,
      gained = Math.max(0, Number(profile.shieldGained) || 0),
      bonus = gained >= Number(high || Infinity)
        ? Number(highBonus || 0)
        : gained >= Number(low || Infinity)
          ? Number(lowBonus || 0)
          : 0;
    if (bonus > 0 && Number.isFinite(action.value)) action.value = Math.round(action.value * (1 + bonus));
  }
  if (Array.isArray(late.explodeAtCounter)) {
    const [key, threshold, value] = late.explodeAtCounter;
    if ((Number(state[key]) || 0) >= Number(threshold || 0)) {
      action.type = "attack";
      action.value = Number(value) || action.value || 0;
      action.attackPattern = "nonContact";
      action.name = "균열 폭발";
      action._lateResetCounterKey = key;
    }
  }

  if (action.lateHook === "cards4Attack" && profile.cards >= 4)
    action.value = Math.round((Number(action.value) || 0) * 1.28);
  if (action.lateHook === "fieldBurnAttack") {
    const total = (run.battle.enemies || []).reduce((sum, target) => sum + statusStacks(target, "burning"), 0);
    if (total >= 12) action.value = Math.round((Number(action.value) || 0) * 1.3);
  }
  if (action.lateHook === "scaleFromOwnBurn") {
    const burning = statusStacks(enemy, "burning"),
      multiplier = 1 + Math.min(0.4, burning * 0.04);
    action.value = Math.round((Number(action.value) || 0) * multiplier);
  }
  if (action.lateHook === "replayStoredCard") prepareArchivistReplay(enemy, action);
  if (action.lateHook === "inspectionAttack") {
    const progress = inspectionProgress(profile, state.inspection),
      passed = progress.current >= progress.target;
    state.inspectionProgress = progress;
    state.inspectionPassed = passed;
    if (passed && Number.isFinite(action.value)) action.value = Math.round(action.value * 1.28);
  }
  if (action.lateHook === "ruptureFollowup") {
    const shield = Math.max(0, Number(run.battle.shield) || 0),
      value = Math.max(0, Number(action.value) || 0);
    if (shield > 0 && value >= shield) {
      action.value = Math.max(1, Math.round(value * 0.6));
      action.hits = 2;
      action.name = "파열 연속타";
    }
  }

  if (enemy.mechanic === "regenUnlessBleeding" && statusStacks(enemy, "bleed") > 0 && action.applySelf?.regeneration) {
    action.applySelf = { ...action.applySelf };
    delete action.applySelf.regeneration;
  }
  if (enemy.mechanic === "rotatingNoteSeal" && action.applyPlayer?.seal) {
    const note = NOTE_ORDER[(Number(state.sealIndex) || 0) % NOTE_ORDER.length];
    action.applyPlayer = {
      ...action.applyPlayer,
      seal: { ...action.applyPlayer.seal, notes: [note] },
    };
    action.name = `${note.toUpperCase()} 봉인`;
  }
  if (enemy.mechanic === "resonanceThreshold" && action.type === "attack" && statusStacks(enemy, "resonance") >= 4)
    action.value = Math.round((Number(action.value) || 0) * 1.25);
  if (enemy.mechanic === "harmonyPrediction" && action.applyPlayer?.interference && !state.harmonyPredicted) {
    action.type = "guard";
    action.value = 10;
    delete action.applyPlayer;
    action.name = "예측 실패 · 재조율";
  }
  if (enemy.mechanic === "woundRiskReward" && action.type === "attack") {
    const wound = Math.max(0, Number(state.wound) || 0);
    action.value = Math.round((Number(action.value) || 0) * (1 + Math.min(0.45, wound * 0.05)));
  }
  if (enemy.mechanic === "mutualBurnRisk" && action.type === "attack") {
    const burning = statusStacks(enemy, "burning");
    action.value = Math.round((Number(action.value) || 0) * (1 + Math.min(0.3, burning * 0.03)));
  }
  if (enemy.mechanic === "adaptiveComputation" && state.adaptiveActive) {
    if (state.analysis === "cards") {
      action.applyPlayer = { ...(action.applyPlayer || {}), overload: 1 };
    } else if (state.analysis === "harmony") {
      action.guard = Math.max(0, Number(action.guard) || 0) + 10;
    }
  }
  if (enemy.mechanic === "discordAndHarmony" && action.type === "attack") {
    if ((Number(state.discord) || 0) >= 3) {
      action.value = Math.round((Number(action.value) || 0) * 1.25);
      action._lateConsumeDiscord = true;
    }
    if ((Number(state.harmonyCounter) || 0) > 0) {
      action.value = Math.round((Number(action.value) || 0) * 1.1);
      action._lateConsumeHarmonyCounter = true;
    }
  }
  if (Number(state.nextAttackBonus) > 0 && action.type === "attack") {
    action.value = Math.max(0, (Number(action.value) || 0) + Number(state.nextAttackBonus));
    action._lateConsumeNextAttackBonus = true;
  }
  return action;
}

function addSummon(Core, S, run, enemy, id, name, hp) {
  if (!run?.battle || Core.livingEnemies(run.battle).length >= Core.MAX_ENEMY_COUNT) return false;
  const summon = {
    id,
    name,
    material: "spirit",
    hp,
    maxHp: hp,
    shield: 0,
    intent: { type: "attack", value: 8, attackPattern: "contact" },
    pattern: [
      { type: "attack", value: 8, attackPattern: "contact" },
      { type: "guard", value: 8 },
      { type: "attack", value: 10, attackPattern: "nonContact" },
    ],
    statuses: S.createStatuses(),
    isElite: false,
    isBoss: false,
    summoned: true,
    stunResistance: 0,
    scaleWithAct: false,
    scaleAttackWithAct: false,
    loopPattern: true,
    customState: {},
  };
  run.battle.enemies.push(summon);
  Core.attachEnemyAliases(run.battle);
  return true;
}

function chooseInspection(Core, run) {
  return pick(Core, run, ["attack3", "nonContact2", "shield20"]) || "attack3";
}

function bindSymbioticTarget(Core, run, enemy) {
  const state = enemy.customState || (enemy.customState = {}),
    candidates = (run.battle?.enemies || []).filter((target) => target !== enemy && target.hp > 0 && !target.summoned),
    target = pick(Core, run, candidates);
  if (!target) {
    state.targetId = null;
    return;
  }
  target.customState ??= {};
  if (state.targetId) {
    const previous = run.battle.enemies.find((candidate) => candidate.id === state.targetId);
    if (previous?.customState?.linkedProtectorId === enemy.id) {
      delete previous.customState.linkedProtectorId;
      delete previous.customState.linkRatio;
    }
  }
  state.targetId = target.id;
  state.transferredDamage = 0;
  target.customState.linkedProtectorId = enemy.id;
  target.customState.linkRatio = 0.3;
}

function adaptiveProfile(run, turns = 1) {
  const profiles = run?.battle?.lateRecentProfiles || [];
  if (turns <= 1) return profiles.at(-1) || lastPlayerTurnProfile(run);
  return aggregateProfiles(profiles.slice(-turns));
}

export function afterLateEnemyAction(Core, S, run, enemy, intent, outcome = null) {
  if (!enemy || !intent) return;
  const state = enemy.customState || (enemy.customState = {}),
    late = intent.lateState || {};

  // Statuses granted by a late-game enemy during its own action must survive
  // the same round's turn-end cleanup. Without this defer, e.g. Blood-scent
  // Carapace gains Thorns 2 and immediately decays to Thorns 1 before the
  // player can respond.
  for (const id of Object.keys(intent.applySelf || {}))
    if (statusStacks(enemy, id) > 0) S.deferTurnEnd(enemy, id);
  for (const id of Object.keys(intent.applyAllies || {}))
    for (const ally of run?.battle?.enemies || [])
      if (ally?.hp > 0 && statusStacks(ally, id) > 0) S.deferTurnEnd(ally, id);
  if (Number.isFinite(late.pressureDelta)) state.pressure = Math.min(3, (Number(state.pressure) || 0) + late.pressureDelta);
  if (late.pressureReset) state.pressure = 0;
  if (Number.isFinite(late.chargeDelta)) state.charge = Math.min(2, (Number(state.charge) || 0) + late.chargeDelta);
  if (late.chargeReset) state.charge = 0;
  if (late.clearFlag) state[late.clearFlag] = false;
  if (late.resetCounter && late.scaleByCounter) state[late.scaleByCounter] = 0;
  if (intent._lateResetCounterKey) state[intent._lateResetCounterKey] = 0;

  if (intent.lateHook === "summonSapling")
    addSummon(Core, S, run, enemy, "sapling_summon", "증식 묘목", Math.max(18, Math.round(enemy.maxHp * 0.22)));
  if (intent.lateHook === "summonLarva")
    addSummon(Core, S, run, enemy, "spore_larva", "포자 유충", Math.max(16, Math.round(enemy.maxHp * 0.18)));
  if (intent.lateHook === "summonSporeOrgan")
    addSummon(Core, S, run, enemy, "spore_organ", "포자 기관", Math.max(24, Math.round(enemy.maxHp * 0.16)));
  if (intent.lateHook === "summonMyceliumOrgan")
    addSummon(Core, S, run, enemy, "mycelium_organ", "균사 기관", Math.max(24, Math.round(enemy.maxHp * 0.16)));

  if (intent.lateHook === "setInspection") {
    state.inspection = chooseInspection(Core, run);
    state.inspectionProgress = inspectionProgress(lastPlayerTurnProfile(run), state.inspection);
  }
  if (intent.lateHook === "linkAlly") bindSymbioticTarget(Core, run, enemy);
  if (intent.lateHook === "analyzeAttackType") {
    const profile = lastPlayerTurnProfile(run);
    state.resistPattern = profile.contact === profile.nonContact
      ? null
      : profile.contact > profile.nonContact
        ? "contact"
        : "nonContact";
    state.patternResistanceActive = Boolean(state.resistPattern);
  }
  if (intent.lateHook === "analyzePreviousTurn" || intent.lateHook === "analyzePreviousTurns") {
    const profile = adaptiveProfile(run, intent.lateHook === "analyzePreviousTurns" ? 2 : 1);
    state.analysis = dominantAnalysis(profile);
    state.adaptiveActive = state.analysis !== "mixed";
  }

  if (intent.lateHook === "consumePlayerBleed") {
    const stacks = statusStacks(run, "bleed");
    if (stacks > 0) S.removeStatus(run, "bleed", Math.min(2, stacks));
  }
  if (intent.lateHook === "reduceWound") state.wound = Math.max(0, (Number(state.wound) || 0) - 2);
  if (intent.lateHook === "replayStoredCard") {
    if (Number(intent._lateReplayHeal) > 0)
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + Number(intent._lateReplayHeal));
    if (intent._lateReplayReturn && state.storedCard) {
      run.battle.discard.push(structuredClone(state.storedCard));
      state.storedCard = null;
    }
  }

  if (enemy.mechanic === "rotatingNoteSeal" && intent.applyPlayer?.seal)
    state.sealIndex = ((Number(state.sealIndex) || 0) + 1) % NOTE_ORDER.length;
  if (enemy.mechanic === "harmonyPrediction" && intent.applyPlayer?.interference)
    state.harmonyPredicted = false;
  if (enemy.mechanic === "recentThreeTurnMemory" && ["최근 3턴 기록", "노트 분석", "기억 갱신"].includes(intent.name)) {
    const analysis = memoryAnalysis(run.battle?.lateRecentProfiles || []);
    state.analyzedNote = analysis.note;
    state.analysisConfidence = analysis.confidence;
    state.memoryAnalysisActive = Boolean(analysis.note);
  }
  if (intent._lateConsumeDiscord) state.discord = 0;
  if (intent._lateConsumeHarmonyCounter) state.harmonyCounter = 0;
  if (intent._lateConsumeNextAttackBonus) state.nextAttackBonus = 0;
  if (outcome?.playerDied) state.lastOutcome = "playerDied";
}

export function afterLatePlayerTurnEnd(Core, S, run) {
  if (!run?.battle) return;
  const battle = run.battle,
    profile = currentPlayerTurnProfile(run);
  battle.lateLastTurnProfile = structuredClone(profile);
  battle.lateRecentProfiles = [...(battle.lateRecentProfiles || []), structuredClone(profile)].slice(-3);
  battle.lateShieldGainedThisTurn = 0;

  for (const enemy of battle.enemies || []) {
    if (!enemy) continue;
    enemy.customState ??= {};
    const state = enemy.customState;
    if (enemy.hp > 0 && enemy.mechanic === "archivist" && battle.lateHandAbsorbPending) {
      const candidates = battle.hand || [];
      if (candidates.length) {
        const index = Math.floor(Core.random(run) * candidates.length);
        state.storedCard = candidates.splice(index, 1)[0];
      }
      battle.lateHandAbsorbPending = false;
    }
    if (state.patternResistanceActive) state.patternResistanceActive = false;
    if (state.adaptiveActive) state.adaptiveActive = false;
    if (state.memoryAnalysisActive) state.memoryAnalysisActive = false;
    if (enemy.mechanic === "regenUnlessBleeding" && statusStacks(enemy, "bleed") > 0)
      S.removeStatus(enemy, "regeneration");
  }
}

function cappedStatus(S, enemy, id, amount, cap) {
  const current = statusStacks(enemy, id),
    add = Math.max(0, Math.min(amount, cap - current));
  if (add > 0) S.applyStatus(enemy, id, add);
}

function impactForTarget(hits, targetIndex) {
  return hits
    .filter((hit) => hit?.targetIndex === targetIndex)
    .reduce((sum, hit) => sum + Math.max(0, Number(hit.damage) || 0) + Math.max(0, Number(hit.blocked) || 0), 0);
}

function applySymbioticTransfer(run, hits) {
  const enemies = run?.battle?.enemies || [];
  for (const target of enemies) {
    const protectorId = target?.customState?.linkedProtectorId;
    if (!protectorId) continue;
    const protector = enemies.find((enemy) => enemy.id === protectorId && enemy.hp > 0),
      targetIndex = enemies.indexOf(target),
      impact = impactForTarget(hits, targetIndex);
    if (!protector || impact <= 0) continue;
    const ratio = Math.max(0, Math.min(0.8, Number(target.customState.linkRatio) || 0.3)),
      transferred = Math.max(1, Math.round(impact * ratio / Math.max(0.1, 1 - ratio))),
      blocked = Math.min(protector.shield, transferred),
      hpDamage = Math.max(0, transferred - blocked);
    protector.shield -= blocked;
    protector.hp = Math.max(0, protector.hp - hpDamage);
    protector.customState ??= {};
    protector.customState.transferredDamage = (Number(protector.customState.transferredDamage) || 0) + transferred;
    if (protector.customState.transferredDamage >= 30 || protector.hp <= 0) {
      delete target.customState.linkedProtectorId;
      delete target.customState.linkRatio;
      protector.customState.targetId = null;
    }
  }
}

function transferBurnOnDeath(Core, S, run, enemy) {
  if (enemy?.mechanic !== "transferBurnOnDeath" || enemy.customState?.burnTransferred || enemy.hp > 0) return;
  const burning = statusStacks(enemy, "burning");
  enemy.customState ??= {};
  enemy.customState.burnTransferred = true;
  if (burning <= 0) return;
  const enemies = run.battle?.enemies || [],
    preferred = enemies.find((candidate) => candidate.id === enemy.customState.targetId && candidate.hp > 0),
    fallback = enemies.filter((candidate) => candidate !== enemy && candidate.hp > 0),
    target = preferred || pick(Core, run, fallback);
  if (!target) return;
  S.applyStatus(target, "burning", Math.max(1, Math.ceil(burning / 2)));
}

export function afterLatePlayerCard(Core, S, run, card, harmonyDelta = 0, context = {}) {
  if (!run?.battle || !card) return;
  if (run.loop === 5) {
    run.act6RouteStats ??= emptyAct6RouteStats();
    scoreAct6Card(run.act6RouteStats, card, harmonyDelta);
  }

  const battle = run.battle,
    hits = Array.isArray(context.hits) ? context.hits : [],
    shieldGained = Math.max(0, Number(context.shieldGained) || 0),
    pattern = cardPattern(card),
    targetIndexes = [...new Set(hits.map((hit) => hit.targetIndex).filter(Number.isInteger))];
  battle.lateShieldGainedThisTurn = (Number(battle.lateShieldGainedThisTurn) || 0) + shieldGained;

  for (const index of targetIndexes) {
    const enemy = battle.enemies[index];
    if (!enemy) continue;
    enemy.customState ??= {};
    const state = enemy.customState,
      impact = impactForTarget(hits, index);
    if (enemy.hp > 0 && enemy.mechanic === "attackedCounter") {
      const key = "instability" in state ? "instability" : "fracture";
      state[key] = Math.min(3, (Number(state[key]) || 0) + 1);
    }
    if (enemy.hp > 0 && enemy.mechanic === "attackedThorns") cappedStatus(S, enemy, "thorns", 1, 6);
    if (enemy.hp > 0 && enemy.mechanic === "shieldBreakRage" && hits.some((hit) => hit.targetIndex === index && hit.blocked > 0) && enemy.shield <= 0)
      state.rageReady = true;
    if (enemy.hp > 0 && enemy.mechanic === "contactCardThorns" && pattern === "contact") cappedStatus(S, enemy, "thorns", 1, 6);
    if (enemy.hp > 0 && enemy.mechanic === "woundRiskReward" && pattern === "contact")
      state.wound = Math.min(9, (Number(state.wound) || 0) + 1);
    if (enemy.hp > 0 && enemy.mechanic === "damageBreakCharge" && impact >= 20 && (Number(state.charge) || 0) > 0)
      state.charge = Math.max(0, Number(state.charge) - 1);
    if (enemy.hp > 0 && enemy.mechanic === "pressure3" && impact >= 20 && (Number(state.pressure) || 0) > 0)
      state.pressure = Math.max(0, Number(state.pressure) - 1);
    if (enemy.hp > 0 && enemy.mechanic === "shieldBreakPressure" && hits.some((hit) => hit.targetIndex === index && hit.blocked > 0) && enemy.shield <= 0)
      state.pressure = Math.max(0, (Number(state.pressure) || 0) - 1);
    transferBurnOnDeath(Core, S, run, enemy);
  }

  applySymbioticTransfer(run, hits);

  for (const enemy of battle.enemies || []) {
    if (!enemy || enemy.hp <= 0) continue;
    enemy.customState ??= {};
    const state = enemy.customState,
      note = card.note || null;
    if (enemy.mechanic === "repeatNoteShield" && note) {
      if (state.lastNote === note) {
        state.repeatNoteCount = (Number(state.repeatNoteCount) || 1) + 1;
        enemy.shield += 6;
      } else {
        state.lastNote = note;
        state.repeatNoteCount = 1;
      }
    }
    if (enemy.mechanic === "repeatedNoteCounter" && note) {
      if (state.lastNote === note) state.repeatNoteCount = (Number(state.repeatNoteCount) || 1) + 1;
      else {
        state.lastNote = note;
        state.repeatNoteCount = 1;
      }
      if (state.repeatNoteCount === 2) enemy.shield += 8;
      if (state.repeatNoteCount >= 3) state.nextAttackBonus = Math.max(Number(state.nextAttackBonus) || 0, 6);
    }
    if (enemy.mechanic === "harmonyPrediction")
      state.harmonyPredicted = Boolean(harmonyDelta > 0 || (battle.notes || []).length >= 2);
    if (enemy.mechanic === "discordAndHarmony" && note && note === state.discordNote)
      state.discord = Math.min(3, (Number(state.discord) || 0) + 1);
    if (enemy.mechanic === "adaptiveComputation" && state.adaptiveActive) {
      if (state.analysis === "cards" && battle.cardsPlayedThisTurn === 4) S.applyStatus(run, "overload", 1);
      if (state.analysis === "harmony" && harmonyDelta > 0) enemy.shield += 10;
    }
    if (enemy.mechanic === "regenUnlessBleeding" && statusStacks(enemy, "bleed") > 0)
      S.removeStatus(enemy, "regeneration");
  }

  if (harmonyDelta > 0) {
    for (const enemy of battle.enemies || []) {
      if (enemy.hp <= 0) continue;
      if (enemy.mechanic === "harmonyDefense") enemy.shield += 8 * harmonyDelta;
      if (enemy.mechanic === "discordAndHarmony") {
        enemy.shield = 0;
        enemy.customState ??= {};
        enemy.customState.harmonyCounter = Math.min(1, (Number(enemy.customState.harmonyCounter) || 0) + harmonyDelta);
        enemy.customState.discord = Math.max(0, (Number(enemy.customState.discord) || 0) - harmonyDelta);
      }
    }
  }
}

export function markArchivistReservation(run, enemy, intent) {
  if (enemy?.mechanic === "archivist" && intent?.lateHook === "reserveHandAbsorb")
    run.battle.lateHandAbsorbPending = true;
}

export function routeLabel(route) {
  if (route === ACT7_ROUTES.FLESH) return "7-1 · 육체화된 향";
  if (route === ACT7_ROUTES.HEAT) return "7-2 · 초고온 향류";
  return "7-3 · 공명 의식";
}
