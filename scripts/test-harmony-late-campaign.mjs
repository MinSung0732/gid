import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACT7_ROUTES,
  CAMPAIGN_LOOPS,
  clearMilestone,
  consumeRequestedCampaignStart,
  emptyAct6RouteStats,
  markClearProgress,
  nextLoopTarget,
  progression,
  requestCampaignStart,
  resolveAct7Route,
  scoreAct6Card,
  startLoopUnlocked,
} from "../games/harmony/campaign-progression.js";
import {
  ABYSS_BOSSES,
  ABYSS_ELITES,
  ABYSS_NORMALS,
  LATE_GAME_ACTS,
  encounterValid,
} from "../games/harmony/late-game-content.js";
import {
  afterLateEnemyAction,
  afterLatePlayerCard,
  prepareLateEnemyAction,
  withLatePlayerCardDefenses,
} from "../games/harmony/late-game-runtime.js";
import {
  afterLateBossAction,
  prepareLateBossPattern,
} from "../games/harmony/late-game-boss-phase.js";
import { lateEnemyTelemetry } from "../games/harmony/late-game-ui.js";
import * as S from "../games/harmony/statuses.js";

const meta = (campaignClears = []) => ({
  highestLoop: 0,
  unlocked: [],
  campaignClears: [...campaignClears],
});

// Campaign unlocks are driven by explicit clear records, not by highestLoop.
assert.equal(progression(meta()).act4, false, "4막은 3막 최초 클리어 전 잠겨야 한다");
assert.equal(progression(meta(["act3"])).act4, true, "3막 클리어 후 4막이 해금되어야 한다");
assert.deepEqual(
  {
    act5: progression(meta(["act3", "act4"])).act5,
    act6: progression(meta(["act3", "act4"])).act6,
  },
  { act5: true, act6: true },
  "4막 클리어 후 5막과 6막이 함께 해금되어야 한다",
);
assert.equal(progression(meta(["act3", "act4"])).act7, false, "6막 클리어 전 7막은 잠겨야 한다");
assert.equal(progression(meta(["act3", "act4", "act6"])).act7, true, "6막 클리어 후 7막 분기가 해금되어야 한다");
assert.equal(progression(meta(["act3", "act4", "act6"])).abyss, false, "7막 클리어 전 심연은 잠겨야 한다");
assert.equal(
  progression(meta(["act3", "act4", "act6", "act7:7-1"])).abyss,
  true,
  "7막 루트 하나라도 최초 클리어하면 심연이 해금되어야 한다",
);

// Unlocks never change the start point of a new roguelike run.
assert.equal(startLoopUnlocked(CAMPAIGN_LOOPS.ACT1, meta(["act3", "act4", "act6", "act7:7-1"])), true);
for (const loop of [CAMPAIGN_LOOPS.ACT2, CAMPAIGN_LOOPS.ACT3, CAMPAIGN_LOOPS.ACT4, CAMPAIGN_LOOPS.ACT5, CAMPAIGN_LOOPS.ACT6, CAMPAIGN_LOOPS.ACT7])
  assert.equal(startLoopUnlocked(loop, meta(["act3", "act4", "act6", "act7:7-1"])), false, "새 런은 반드시 1막에서 시작해야 한다");
assert.equal(requestCampaignStart(CAMPAIGN_LOOPS.ACT7, ACT7_ROUTES.FLESH), false, "후반 막 직접 시작 요청은 비활성화되어야 한다");
assert.deepEqual(consumeRequestedCampaignStart(meta(["act3", "act4", "act6", "act7:7-1"])), { loop: CAMPAIGN_LOOPS.ACT1, route: null });

const campaignUiSource = readFileSync(new URL("../games/harmony/campaign-ui.js", import.meta.url), "utf8");
assert.equal(campaignUiSource.includes("campaign-stage-panel"), false, "로비에 후반 막 직접 시작 패널이 다시 생기면 안 된다");
assert.equal(campaignUiSource.includes("해금된 후반 막에서 시작"), false);
assert.ok(campaignUiSource.includes("처음 화면으로 가기"), "최초 해금 공유 화면에는 홈 버튼이 있어야 한다");

// Legacy saves may have deep old-Abyss highestLoop values, but only Act 4 is migrated open.
{
  const legacy = { highestLoop: 19, unlocked: [] };
  const unlocked = progression(legacy);
  assert.equal(unlocked.act4, true, "기존 3막 이상 클리어 저장은 4막을 열어야 한다");
  assert.equal(unlocked.act5, false, "과거 심연 기록으로 신규 5막을 자동 건너뛰면 안 된다");
  assert.equal(unlocked.act6, false);
  assert.equal(unlocked.act7, false);
  assert.equal(unlocked.abyss, false, "신규 7막 클리어 전에는 과거 심연 기록만으로 새 심연을 열지 않는다");
}

// Milestones are first-clear only, and every unlock first-clear ends the run.
assert.deepEqual(
  clearMilestone({ loop: CAMPAIGN_LOOPS.ACT3 }, meta()),
  { key: "act4", title: "4막 해금", detail: "변질된 조향실이 열렸습니다.", forceHome: true },
);
assert.equal(clearMilestone({ loop: CAMPAIGN_LOOPS.ACT3 }, meta(["act3"])), null);
assert.equal(clearMilestone({ loop: CAMPAIGN_LOOPS.ACT4 }, meta(["act3"]))?.forceHome, true);
assert.equal(clearMilestone({ loop: CAMPAIGN_LOOPS.ACT6 }, meta(["act3", "act4"]))?.forceHome, true);
assert.equal(
  clearMilestone(
    { loop: CAMPAIGN_LOOPS.ACT7, act7Route: ACT7_ROUTES.FLESH },
    meta(["act3", "act4", "act6"]),
  )?.forceHome,
  true,
  "7막 최초 클리어는 심연만 해금하고 처음 화면으로 돌아가야 한다",
);
assert.equal(
  clearMilestone(
    { loop: CAMPAIGN_LOOPS.ACT7, act7Route: ACT7_ROUTES.HEAT },
    meta(["act3", "act4", "act6", "act7:7-1"]),
  ),
  null,
  "심연이 이미 해금된 뒤 다른 7막 루트를 클리어하면 같은 해금 배너를 반복하지 않는다",
);

{
  const m = meta(["act3", "act4", "act6"]);
  const run = { loop: CAMPAIGN_LOOPS.ACT7, act7Route: ACT7_ROUTES.HEAT };
  const milestone = clearMilestone(run, m);
  markClearProgress(run, m, milestone);
  assert.ok(m.campaignClears.includes("act7:7-2"));
  assert.equal(progression(m).abyss, true);
  assert.equal(run._campaignFeedback.forceHome, true);
}

// 6막 card-use statistics choose the Act 7 branch.
const fleshStats = emptyAct6RouteStats();
scoreAct6Card(fleshStats, { attack: 10, attackPattern: "contact" });
scoreAct6Card(fleshStats, { attack: 8, attackPattern: "contact" });
scoreAct6Card(fleshStats, { attack: 6, attackPattern: "nonContact" });
assert.equal(resolveAct7Route(fleshStats), ACT7_ROUTES.FLESH);

const heatStats = emptyAct6RouteStats();
scoreAct6Card(heatStats, { attack: 8, attackPattern: "nonContact", applyEnemy: { burning: 2 } });
scoreAct6Card(heatStats, { attack: 8, attackPattern: "nonContact" });
assert.equal(resolveAct7Route(heatStats), ACT7_ROUTES.HEAT);

const resonanceStats = emptyAct6RouteStats();
scoreAct6Card(resonanceStats, { note: "top", shield: 8 }, 1);
scoreAct6Card(resonanceStats, { note: "middle", shield: 8 }, 1);
assert.equal(resolveAct7Route(resonanceStats), ACT7_ROUTES.RESONANCE);

assert.deepEqual(
  nextLoopTarget({ loop: CAMPAIGN_LOOPS.ACT6, act6RouteStats: fleshStats }),
  { loop: CAMPAIGN_LOOPS.ACT7, route: ACT7_ROUTES.FLESH },
);
assert.deepEqual(
  nextLoopTarget({ loop: CAMPAIGN_LOOPS.ACT7, act7Route: ACT7_ROUTES.FLESH }),
  { loop: CAMPAIGN_LOOPS.ABYSS_START, route: null },
);

// Every late Act contributes normals/elites/bosses to the Abyss pool.
for (const key of ["act4", "act5", "act6", "act7-1", "act7-2", "act7-3"]) {
  const act = LATE_GAME_ACTS[key];
  assert.ok(act, `${key} 데이터가 있어야 한다`);
  assert.ok(Object.keys(act.normals).length, `${key} 일반 몬스터 풀이 비어 있으면 안 된다`);
  assert.ok(Object.keys(act.elites).length, `${key} 엘리트 풀이 비어 있으면 안 된다`);
  assert.ok(Object.keys(act.bosses).length, `${key} 보스 풀이 비어 있으면 안 된다`);
  for (const id of Object.keys(act.normals)) assert.ok(ABYSS_NORMALS[id]);
  for (const id of Object.keys(act.elites)) assert.ok(ABYSS_ELITES[id]);
  for (const id of Object.keys(act.bosses)) assert.ok(ABYSS_BOSSES[id]);
}

// Cross-Act Abyss encounters still obey safety budgets.
assert.equal(
  encounterValid([
    LATE_GAME_ACTS.act6.normals.resonance_blocking_coil,
    LATE_GAME_ACTS["act7-3"].normals.silent_conductor,
  ]),
  false,
);
assert.equal(
  encounterValid([
    LATE_GAME_ACTS["act7-2"].normals.aerosol_igniter,
    LATE_GAME_ACTS["act7-2"].normals.steam_cluster_bug,
    LATE_GAME_ACTS["act7-2"].normals.thermal_flow_amplifier,
  ]),
  false,
);
assert.equal(
  encounterValid([
    LATE_GAME_ACTS.act4.normals.corrosive_coolant,
    LATE_GAME_ACTS.act5.normals.poison_scent_stalker,
  ]),
  true,
);

const stubCore = {
  random: () => 0,
  attachEnemyAliases: () => {},
};

function battleEnemy(template, customState = {}) {
  const enemy = structuredClone(template);
  enemy.hp = enemy.maxHp = enemy.baseHp;
  enemy.shield = 0;
  enemy.statuses = S.createStatuses();
  enemy.customState = structuredClone(customState);
  return enemy;
}

// Reverse cooling tower: 40+ shield gained last turn caps at +40% damage.
{
  const enemy = battleEnemy(LATE_GAME_ACTS.act4.elites.reverse_cooling_tower);
  enemy.intent = structuredClone(enemy.pattern[2]);
  const run = {
    battle: {
      enemies: [enemy],
      shield: 0,
      lateLastTurnProfile: {
        shieldGained: 40,
        cards: 1,
        attacks: 0,
        contact: 0,
        nonContact: 0,
        harmonies: 0,
        notes: {},
      },
    },
  };
  prepareLateEnemyAction(run, enemy);
  assert.equal(enemy.intent.value, 25);
}

// Fracture explosion really becomes an attack and resets the counter.
{
  const enemy = battleEnemy(LATE_GAME_ACTS.act4.elites.fractured_pressure_golem, { fracture: 3 });
  enemy.intent = structuredClone(enemy.pattern[2]);
  const run = { battle: { enemies: [enemy], shield: 0, lateLastTurnProfile: { shieldGained: 0, cards: 0, attacks: 0, contact: 0, nonContact: 0, harmonies: 0, notes: {} } } };
  prepareLateEnemyAction(run, enemy);
  assert.equal(enemy.intent.type, "attack");
  assert.equal(enemy.intent.value, 25);
  afterLateEnemyAction(stubCore, S, run, enemy, enemy.intent, {});
  assert.equal(enemy.customState.fracture, 0);
}

// Multi-hit cards increment attacked counters once per card, not once per hit.
{
  const enemy = battleEnemy(LATE_GAME_ACTS.act4.normals.fractured_perfume_swarm, { instability: 0 });
  const run = {
    loop: 3,
    battle: {
      enemies: [enemy],
      shield: 0,
      notes: [],
      cardsPlayedThisTurn: 1,
      contactCardsPlayedThisTurn: 1,
      nonContactCardsPlayedThisTurn: 0,
    },
  };
  afterLatePlayerCard(stubCore, S, run, { attack: 5, hits: 5, attackPattern: "contact" }, 0, {
    hits: Array.from({ length: 5 }, () => ({ targetIndex: 0, damage: 5, blocked: 0 })),
    shieldGained: 0,
  });
  assert.equal(enemy.customState.instability, 1);
}

// Charge break reduces only one charge for a qualifying card.
{
  const enemy = battleEnemy(LATE_GAME_ACTS.act6.normals.forbidden_distillate, { charge: 2 });
  const run = {
    loop: 5,
    battle: {
      enemies: [enemy],
      shield: 0,
      notes: [],
      cardsPlayedThisTurn: 1,
      contactCardsPlayedThisTurn: 1,
      nonContactCardsPlayedThisTurn: 0,
    },
  };
  afterLatePlayerCard(stubCore, S, run, { attack: 20, attackPattern: "contact" }, 0, {
    hits: [{ targetIndex: 0, damage: 20, blocked: 0 }],
    shieldGained: 0,
  });
  assert.equal(enemy.customState.charge, 1);
}

// Attack-type analysis grants only temporary resistance and restores existing protection.
{
  const enemy = battleEnemy(LATE_GAME_ACTS.act6.elites.forbidden_reaction_observer, {
    resistPattern: "contact",
    patternResistanceActive: true,
  });
  const run = { battle: { enemies: [enemy] } };
  S.applyStatus(enemy, "protection", { stacks: 1, turns: 2 });
  const before = structuredClone(enemy.statuses.protection);
  let temporaryStacks = 0;
  withLatePlayerCardDefenses(S, run, { attack: 10, attackPattern: "contact" }, () => {
    temporaryStacks = S.stacks(enemy, "protection");
  });
  assert.equal(temporaryStacks, 4);
  assert.deepEqual(enemy.statuses.protection, before);
}

// 7-3 seal watcher rotates note targets instead of permanently hard-countering one note.
{
  const enemy = battleEnemy(LATE_GAME_ACTS["act7-3"].normals.tuning_watcher, { sealIndex: 1 });
  enemy.intent = structuredClone(enemy.pattern[1]);
  const run = { battle: { enemies: [enemy], shield: 0, lateLastTurnProfile: { shieldGained: 0, cards: 0, attacks: 0, contact: 0, nonContact: 0, harmonies: 0, notes: {} } } };
  prepareLateEnemyAction(run, enemy);
  assert.deepEqual(enemy.intent.applyPlayer.seal.notes, ["middle"]);
  afterLateEnemyAction(stubCore, S, run, enemy, enemy.intent, {});
  assert.equal(enemy.customState.sealIndex, 2);
}

// Authored HP phases are attached only to bosses that need them.
{
  const mother = battleEnemy(LATE_GAME_ACTS.act5.bosses.symbiosis_mother);
  prepareLateBossPattern(mother);
  assert.equal(mother.phases.length, 2);
  assert.equal(mother.phases[0].hpAbove, 0.5);
  assert.equal(mother.phases[1].label, "강화 공생기");

  const core = battleEnemy(LATE_GAME_ACTS.act6.bosses.grand_alchemy_perfume_core);
  prepareLateBossPattern(core);
  assert.deepEqual(core.phases.map((phase) => phase.hpAbove), [0.66, 0.33, 0]);
  assert.deepEqual(core.phases.map((phase) => phase.label), ["압축", "제어", "붕괴"]);

  const computation = battleEnemy(LATE_GAME_ACTS.act6.bosses.forbidden_perfume_computation);
  prepareLateBossPattern(computation);
  assert.equal(computation.phases.length, 2);
  assert.equal(computation.phases[0].hpAbove, 0.5);
  assert.equal(computation.phases[1].label, "최근 2턴 분석");
}

// Symbiosis Mother phase 2 strengthens exactly one living organ at a time.
{
  const mother = battleEnemy(LATE_GAME_ACTS.act5.bosses.symbiosis_mother);
  mother.hp = Math.floor(mother.maxHp * 0.45);
  const organ = {
    id: "spore_organ",
    name: "포자 기관",
    summoned: true,
    hp: 30,
    maxHp: 30,
    shield: 0,
    statuses: S.createStatuses(),
    customState: {},
    pattern: [],
  };
  const run = { battle: { enemies: [mother, organ] } };
  afterLateBossAction(run, mother, { lateHook: "summonSporeOrgan" });
  assert.equal(organ.customState.empowered, true);
  assert.equal(organ.name, "강화 포자 기관");
  assert.equal(mother.customState.empoweredOrganChosen, true);
}

// Required telegraph information is exposed as pure UI data.
{
  const enemy = battleEnemy(LATE_GAME_ACTS.act4.normals.overpressure_valve, { pressure: 1 });
  enemy.intent = structuredClone(enemy.pattern[1]);
  const run = { battle: { enemies: [enemy], cardsPlayedThisTurn: 0 } };
  const rows = lateEnemyTelemetry(run, enemy).map((row) => row.text);
  assert.ok(rows.some((text) => text.includes("압력 1 / 2")));
  assert.ok(rows.some((text) => text.includes("압력 축적 II")));
}

{
  const boss = battleEnemy(LATE_GAME_ACTS.act6.bosses.grand_alchemy_perfume_core);
  prepareLateBossPattern(boss);
  boss.patternV2State = { phaseIndex: 0, phaseId: "alchemy-compression" };
  boss.intent = structuredClone(boss.phases[0].opening[0]);
  const run = { battle: { enemies: [boss], cardsPlayedThisTurn: 0 } };
  const rows = lateEnemyTelemetry(run, boss).map((row) => row.text);
  assert.ok(rows.some((text) => text.includes("PHASE 1 · 압축")));
  assert.ok(rows.some((text) => text.includes("66% 이하")));
}

{
  const boss = battleEnemy(LATE_GAME_ACTS.act4.bosses.incomplete_refinement_supervisor, {
    inspection: "attack3",
  });
  const run = {
    battle: {
      enemies: [boss],
      cardsPlayedThisTurn: 2,
      contactCardsPlayedThisTurn: 1,
      nonContactCardsPlayedThisTurn: 1,
      lateShieldGainedThisTurn: 0,
    },
  };
  const rows = lateEnemyTelemetry(run, boss).map((row) => row.text);
  assert.ok(rows.some((text) => text.includes("공격 카드 2 / 3")));
}

console.log("Harmony late campaign tests passed");
const lateUiFix = await readFile(new URL("../games/harmony/late-game-ui-fix.css", import.meta.url), "utf8");
assert.match(lateUiFix, /height:\s*72px\s*!important/, "late enemy ART stage should have a fixed height");
assert.match(lateUiFix, /width:\s*56px\s*!important[\s\S]*?font-size:\s*48px\s*!important/, "fallback monster symbol should use a fixed box and font size");
assert.match(lateUiFix, /width:\s*64px\s*!important[\s\S]*?object-fit:\s*contain\s*!important/, "future monster artwork should fit the stable ART stage");
assert.doesNotMatch(lateUiFix, /enemies-field\.enemies-[123][\s\S]{0,180}?enemy-symbol/, "enemy count must not resize the monster subject");
console.log("PASS Harmony late-game UI keeps one stable monster art stage.");
