import { chromium } from "playwright";

const BASE = "http://127.0.0.1:5173/games/harmony/";
const assert = (value, message) => { if (!value) throw new Error(message); };
const results = {};

async function startBattle(browser, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport || { width: 1440, height: 900 },
    reducedMotion: options.reducedMotion || "no-preference",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator("#app").waitFor({ state: "visible" });
  await page.locator('[data-action="new"]').click();
  await page.locator("#starting-deck-builder").waitFor({ state: "visible" });
  await page.locator('[data-builder-action="preset"]').click();
  const start = page.locator("#builder-start");
  await start.waitFor({ state: "visible" });
  assert(!(await start.isDisabled()), "builder start disabled");
  await start.click();
  await page.locator('.room [data-action="enter"]').waitFor({ state: "visible" });
  await page.locator('.room [data-action="enter"]').click();
  await page.locator(".battle").waitFor({ state: "visible" });
  await page.waitForTimeout(700);
  return { context, page, errors };
}

async function installObserver(page) {
  await page.evaluate(() => {
    window.__harmonyVfxObserver?.disconnect?.();
    window.__harmonyVfxLog = [];
    const interesting = [
      "absorb-vortex",
      "absorb-gain-pop",
      "absorb-loss-pop",
      "shield-gain-pop",
      "shield-block-pop",
      "healing-effect",
      "health-damage-pop",
      "damage-pop",
      "enemy-action-popup",
      "monster-death-burst",
      "status-damage-pop",
    ];
    const record = (node) => {
      if (!(node instanceof Element)) return;
      const candidates = [node, ...node.querySelectorAll?.("*") || []];
      for (const element of candidates) {
        const matched = interesting.filter((name) => element.classList?.contains(name));
        if (!matched.length) continue;
        window.__harmonyVfxLog.push({
          classes: matched,
          className: element.className,
          text: (element.textContent || "").replace(/\s+/g, " ").trim(),
          time: performance.now(),
        });
      }
    };
    window.__harmonyVfxObserver = new MutationObserver((records) => {
      for (const mutation of records)
        for (const node of mutation.addedNodes) record(node);
    });
    window.__harmonyVfxObserver.observe(document.body, { childList: true, subtree: true });
  });
}

async function resetLog(page) {
  await page.evaluate(() => { window.__harmonyVfxLog = []; });
}

async function log(page) {
  return await page.evaluate(() => [...(window.__harmonyVfxLog || [])]);
}

function hasClass(entries, className) {
  return entries.some((entry) => entry.classes.includes(className));
}
function countClass(entries, className) {
  return entries.filter((entry) => entry.classes.includes(className)).length;
}
function indexClass(entries, className) {
  return entries.findIndex((entry) => entry.classes.includes(className));
}

async function forceRender(page) {
  const enemy = page.locator('.enemy[data-action="target"]').first();
  if (await enemy.count()) {
    await enemy.click();
    await page.waitForTimeout(120);
  }
}

async function endTurnAndWait(page) {
  const before = await page.locator(".battle .eyebrow").textContent();
  const round = Number(before?.match(/ROUND\s+(\d+)/)?.[1] || 0);
  const end = page.locator('.battle [data-action="end"]:visible').last();
  await end.waitFor({ state: "visible" });
  assert(!(await end.isDisabled()), "end turn disabled");
  const buttonState = await end.evaluate((button) => ({
    text: button.textContent?.trim() || "",
    disabled: button.disabled,
    connected: button.isConnected,
    count: document.querySelectorAll('.battle [data-action="end"]').length,
  }));
  console.log("END_BUTTON_STATE=" + JSON.stringify(buttonState));
  await end.evaluate((button) => button.click());
  try {
    await page.waitForFunction((round) => {
      const battle = document.querySelector(".battle");
      if (!battle) return false;
      const text = battle.querySelector(".eyebrow")?.textContent || "";
      const next = Number(text.match(/ROUND\s+(\d+)/)?.[1] || 0);
      return battle.classList.contains("player-phase") && next > round;
    }, round, { timeout: 15000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      phase: window.HarmonyCurrentRenderRun?.phase,
      hp: window.HarmonyCurrentRenderRun?.hp,
      turn: window.HarmonyCurrentRenderRun?.battle?.turn,
      enemyPhase: window.HarmonyCurrentRenderRun?.battle?.enemyPhase,
      actingEnemy: window.HarmonyCurrentRenderRun?.battle?.actingEnemy,
      eyebrow: document.querySelector(".battle .eyebrow")?.textContent || "",
      battleClass: document.querySelector(".battle")?.className || "",
      feedback: {
        absorb: window.HarmonyCurrentRenderRun?._absorbFeedback,
        shield: window.HarmonyCurrentRenderRun?._shieldGainFeedback,
        healing: window.HarmonyCurrentRenderRun?._healingFeedback,
        playerDamage: window.HarmonyCurrentRenderRun?._playerDamageFeedback,
      },
      vfx: window.__harmonyVfxLog || [],
    }));
    console.log("TURN_TIMEOUT_STATE=" + JSON.stringify(state));
    throw error;
  }
  await page.waitForTimeout(650);
}

async function setGuardEnemy(page) {
  await page.evaluate(() => {
    const run = window.HarmonyCurrentRenderRun;
    run.maxHp = Math.max(run.maxHp || 0, 200);
    run.hp = Math.min(run.maxHp, Math.max(run.hp || 0, 150));
    const enemy = run.battle.enemies.find((value) => value.hp > 0);
    if (enemy) {
      enemy.maxHp = Math.max(enemy.maxHp || 0, 999);
      enemy.hp = Math.max(enemy.hp || 0, 500);
      enemy.intent = {
        type: "guard",
        value: 0,
        name: "검증 대기",
        applyPlayer: {},
        applySelf: {},
        applyAllies: {},
      };
    }
  });
}

const browser = await chromium.launch({ headless: true });
try {
  // 1) blockedDamageToAbsorb: shield block -> absorb gain, no stale replay.
  {
    const { context, page, errors } = await startBattle(browser);
    await installObserver(page);
    await page.evaluate(() => {
      const run = window.HarmonyCurrentRenderRun;
      run.inventory.push("trait_aegis_kinetic_absorption");
      run.maxHp = 200;
      run.hp = 180;
      run.battle.shield = 50;
      const enemy = run.battle.enemies[0];
      enemy.maxHp = 500;
      enemy.hp = 500;
      enemy.intent = {
        type: "attack",
        value: 10,
        hits: 1,
        attackPattern: "contact",
        name: "검증 타격",
        applyPlayer: {},
        applySelf: {},
        applyAllies: {},
      };
    });
    await resetLog(page);
    await endTurnAndWait(page);
    const first = await log(page);
    assert(hasClass(first, "shield-block-pop"), "blocked attack did not show existing shield block VFX");
    assert(hasClass(first, "absorb-gain-pop"), "blockedDamageToAbsorb did not show absorb gain VFX");
    assert(indexClass(first, "absorb-gain-pop") > indexClass(first, "shield-block-pop"), "absorb gain should follow shield block");
    await resetLog(page);
    await forceRender(page);
    await page.waitForTimeout(500);
    const stale = await log(page);
    assert(!hasClass(stale, "absorb-gain-pop"), "stale blocked-damage absorb replayed on later action");
    assert(errors.length === 0, "blocked absorb page errors: " + errors.join(" | "));
    results.blockedAbsorb = { first, stale };
    await context.close();
  }

  // 2) Turn Start: absorb + healing + next-turn/regen shield for three transitions.
  {
    const { context, page, errors } = await startBattle(browser);
    await installObserver(page);
    await page.evaluate(() => {
      const run = window.HarmonyCurrentRenderRun;
      run.inventory.push(
        "relic_supercritical_storage_ampoule",
        "relic_dewdrop_collector_funnel",
        "trait_steady_metabolism",
        "trait_cell_regeneration_boost",
      );
      run.maxHp = 200;
      run.hp = 150;
      run.battle.nextTurnShield = 5;
    });
    const turns = [];
    for (let turn = 0; turn < 3; turn += 1) {
      await setGuardEnemy(page);
      await page.evaluate(() => {
        const run = window.HarmonyCurrentRenderRun;
        run.hp = Math.min(run.hp, run.maxHp - 10);
      });
      await resetLog(page);
      await endTurnAndWait(page);
      const entries = await log(page);
      assert(countClass(entries, "absorb-gain-pop") === 1, "turn-start absorb should present exactly once per turn");
      assert(countClass(entries, "healing-effect") === 1, "turn-start healing should present exactly once per turn");
      assert(countClass(entries, "shield-gain-pop") === 1, "turn-start shield gains should aggregate to one existing shield VFX");
      assert(indexClass(entries, "healing-effect") < indexClass(entries, "shield-gain-pop"), "healing should present before shield gain");
      assert(indexClass(entries, "shield-gain-pop") < indexClass(entries, "absorb-gain-pop"), "shield gain should present before absorb gain");
      turns.push(entries);
    }
    assert(errors.length === 0, "turn-start resource page errors: " + errors.join(" | "));
    results.turnStartResources = turns;
    await context.close();
  }

  // 3) Player Turn End absorb spill shield.
  {
    const { context, page, errors } = await startBattle(browser);
    await installObserver(page);
    await setGuardEnemy(page);
    await page.evaluate(() => {
      const run = window.HarmonyCurrentRenderRun;
      run.inventory.push("trait_saturated_spillover");
      run.battle.absorb = 30;
      run.battle.shield = 0;
    });
    await resetLog(page);
    await endTurnAndWait(page);
    const entries = await log(page);
    assert(hasClass(entries, "shield-gain-pop"), "absorbSpillShield did not show shield gain VFX");
    assert(errors.length === 0, "turn-end shield page errors: " + errors.join(" | "));
    results.turnEndShield = entries;
    await context.close();
  }

  // 4) Discard Choice: self damage then absorb gain.
  {
    const { context, page, errors } = await startBattle(browser);
    await installObserver(page);
    await page.evaluate(() => {
      const run = window.HarmonyCurrentRenderRun;
      run.inventory.push("trait_scent_memory_echo", "curse_trait_unstable_solvent");
      run.maxHp = 100;
      run.hp = 80;
      run.battle.pendingDiscard = 1;
      run.battle.discardEffects = [];
    });
    await forceRender(page);
    const discard = page.locator('.hand [data-action="discard-choice"]').first();
    await discard.waitFor({ state: "visible" });
    await resetLog(page);
    await discard.click();
    await page.waitForFunction(() => window.HarmonyCurrentRenderRun?.battle?.pendingDiscard === 0);
    await page.waitForTimeout(900);
    const entries = await log(page);
    assert(hasClass(entries, "health-damage-pop"), "discardSelfDamage did not show player damage VFX");
    assert(hasClass(entries, "absorb-gain-pop"), "discardAbsorb did not show absorb gain VFX");
    assert(indexClass(entries, "health-damage-pop") < indexClass(entries, "absorb-gain-pop"), "discard damage should present before absorb gain");
    assert(errors.length === 0, "discard page errors: " + errors.join(" | "));
    results.discard = entries;
    await context.close();
  }

  // 5) Round End direct mirror damage is distinct from healing.
  {
    const { context, page, errors } = await startBattle(browser);
    await installObserver(page);
    await setGuardEnemy(page);
    await page.evaluate(() => {
      const run = window.HarmonyCurrentRenderRun;
      run.inventory.push("curse_trait_abyssal_mirror_puppet", "relic_dewdrop_collector_funnel");
      run.maxHp = 200;
      run.hp = 150;
      run.battle.cardsPlayedDefinitions = [{ attack: 12, attackPattern: "contact" }];
    });
    await resetLog(page);
    await endTurnAndWait(page);
    const entries = await log(page);
    const damage = entries.find((entry) => entry.classes.includes("health-damage-pop"));
    const heal = entries.find((entry) => entry.classes.includes("healing-effect"));
    assert(damage, "enemyCardMirror did not show player damage VFX");
    assert(/12/.test(damage.text), "mirror damage popup does not match actual 12 damage: " + damage.text);
    assert(heal, "same round turn-start healing did not show healing VFX");
    assert(indexClass(entries, "health-damage-pop") < indexClass(entries, "healing-effect"), "direct damage should not be collapsed into net HP delta");
    assert(errors.length === 0, "mirror page errors: " + errors.join(" | "));
    results.mirrorDamage = entries;
    await context.close();
  }

  // 6) Player Turn End auto attack must hit before first enemy action.
  {
    const { context, page, errors } = await startBattle(browser);
    await installObserver(page);
    await setGuardEnemy(page);
    await page.evaluate(() => {
      const run = window.HarmonyCurrentRenderRun;
      run.inventory.push("trait_shield_to_blade_transmute");
      run.battle.shield = 30;
    });
    const beforeHp = await page.evaluate(() => window.HarmonyCurrentRenderRun.battle.enemies[0].hp);
    await resetLog(page);
    await endTurnAndWait(page);
    const afterHp = await page.evaluate(() => window.HarmonyCurrentRenderRun.battle.enemies[0].hp);
    const entries = await log(page);
    assert(afterHp < beforeHp, "endTurnShieldAttack did not damage enemy");
    assert(hasClass(entries, "damage-pop"), "endTurnShieldAttack did not show enemy hit VFX");
    assert(hasClass(entries, "enemy-action-popup"), "enemy action popup missing from timing check");
    assert(indexClass(entries, "damage-pop") < indexClass(entries, "enemy-action-popup"), "end-turn enemy hit VFX was delayed until after enemy action");
    assert(errors.length === 0, "end-turn attack page errors: " + errors.join(" | "));
    results.endTurnAttack = entries;
    await context.close();
  }

  // 7) Round-end victory battleEndHeal should show the existing healing VFX.
  {
    const { context, page, errors } = await startBattle(browser);
    await installObserver(page);
    await page.evaluate(() => {
      const run = window.HarmonyCurrentRenderRun;
      run.inventory.push("relic_dried_chamomile_flower");
      run.maxHp = 100;
      run.hp = 70;
      const enemy = run.battle.enemies[0];
      enemy.hp = 1;
      enemy.statuses ||= {};
      enemy.statuses.poison = { stacks: 1 };
      enemy.intent = {
        type: "guard",
        value: 0,
        name: "검증 대기",
        applyPlayer: {},
        applySelf: {},
        applyAllies: {},
      };
    });
    await resetLog(page);
    const end = page.locator('.battle [data-action="end"]');
    await end.click();
    await page.waitForFunction(() => window.HarmonyCurrentRenderRun?.phase === "reward", null, { timeout: 45000 });
    await page.waitForTimeout(900);
    const entries = await log(page);
    assert(hasClass(entries, "monster-death-burst"), "round-end poison kill did not show monster death feedback");
    assert(hasClass(entries, "healing-effect"), "battleEndHeal did not show existing healing VFX");
    assert(indexClass(entries, "healing-effect") > indexClass(entries, "monster-death-burst"), "battle-end healing should follow lethal feedback");
    assert(errors.length === 0, "battle-end heal page errors: " + errors.join(" | "));
    results.battleEndHeal = entries;
    await context.close();
  }

  // 8) Normal card VFX remain exactly once: absorb / defense / heal.
  for (const scenario of [
    { name: "normalAbsorb", card: "absorb_precision_pipette", expect: "absorb-gain-pop", hp: null },
    { name: "normalDefense", card: "guard_paraffin_seal", expect: "shield-gain-pop", hp: null },
    { name: "normalHeal", card: "heal_aloe_salve", expect: "healing-effect", hp: 50 },
  ]) {
    const { context, page, errors } = await startBattle(browser);
    await installObserver(page);
    await page.evaluate(({ card, hp }) => {
      const run = window.HarmonyCurrentRenderRun;
      run.battle.hand = [{ id: card, level: 0 }];
      run.battle.ap = 10;
      if (hp !== null) {
        run.maxHp = 100;
        run.hp = hp;
      }
    }, scenario);
    await forceRender(page);
    const play = page.locator('.hand [data-action="play"]').first();
    await play.waitFor({ state: "visible" });
    await resetLog(page);
    await play.click();
    await page.waitForTimeout(1300);
    const entries = await log(page);
    assert(countClass(entries, scenario.expect) === 1, scenario.name + " VFX should play exactly once");
    assert(errors.length === 0, scenario.name + " page errors: " + errors.join(" | "));
    results[scenario.name] = entries;
    await context.close();
  }

  // 9) Reduced Motion still communicates turn-start resource gains.
  {
    const { context, page, errors } = await startBattle(browser, { reducedMotion: "reduce" });
    await installObserver(page);
    await setGuardEnemy(page);
    await page.evaluate(() => {
      const run = window.HarmonyCurrentRenderRun;
      run.inventory.push("relic_supercritical_storage_ampoule", "relic_dewdrop_collector_funnel");
      run.maxHp = 100;
      run.hp = 80;
    });
    await resetLog(page);
    await endTurnAndWait(page);
    const entries = await log(page);
    assert(hasClass(entries, "absorb-gain-pop"), "reduced motion lost absorb information");
    assert(hasClass(entries, "healing-effect"), "reduced motion lost healing information");
    assert(errors.length === 0, "reduced-motion page errors: " + errors.join(" | "));
    results.reducedMotion = entries;
    await context.close();
  }

  console.log("HARMONY_FEEDBACK_BOUNDARY_BROWSER=" + JSON.stringify(results));
} finally {
  await browser.close();
}
