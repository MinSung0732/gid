import { chromium } from "playwright";

const BASE = "http://127.0.0.1:5173/games/harmony/";
const assert = (value, message) => { if (!value) throw new Error(message); };
const results = {};

async function startBattle(context) {
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
  await page.locator(".play-layout").waitFor({ state: "visible" });
  const enter = page.locator('.room [data-action="enter"]');
  await enter.waitFor({ state: "visible" });
  await enter.click();
  await page.locator(".battle").waitFor({ state: "visible" });
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    window.__feedbackFxEvents = [];
    const selectors = [
      [".absorb-gain-pop", "absorb-gain"],
      [".absorb-loss-pop", "absorb-loss"],
      [".shield-gain-pop", "shield-gain"],
      [".shield-block-pop", "shield-block"],
      [".health-damage-pop", "player-damage"],
      [".damage-pop", "enemy-damage"],
      [".healing-effect", "healing"],
      [".enemy-action-popup", "enemy-action"],
    ];
    const selectorList = selectors.map(([selector]) => selector).join(",");
    const record = (root) => {
      if (!(root instanceof Element)) return;
      const candidates = [root, ...root.querySelectorAll(selectorList)];
      for (const element of candidates) {
        for (const [selector, type] of selectors) {
          if (!element.matches(selector)) continue;
          window.__feedbackFxEvents.push({
            type,
            text: (element.textContent || "").replace(/\s+/g, " ").trim(),
            at: performance.now(),
          });
          break;
        }
      }
    };
    window.__feedbackFxObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations)
        for (const node of mutation.addedNodes) record(node);
    });
    window.__feedbackFxObserver.observe(document.body, { childList: true, subtree: true });
  });
  return { page, errors };
}

async function prepare(page, config = {}) {
  const defaults = {
    inventory: [],
    shield: 0,
    absorb: 0,
    hpMissing: 0,
    enemyIntent: { type: "guard", value: 0 },
    enemyHp: 200,
    cardsPlayedDefinitions: [],
    poison: 0,
  };
  await page.evaluate(async (config) => {
    const E = await import("./engine.js");
    const run = window.HarmonyCurrentRenderRun;
    run.inventory = [...config.inventory];
    run.hp = Math.max(1, run.maxHp - config.hpMissing);
    const battle = run.battle;
    battle.enemies = [battle.enemies[0]];
    battle.selectedTarget = 0;
    battle.enemyPhase = false;
    battle.pendingDiscard = 0;
    battle.actingEnemy = null;
    battle.completedEnemies = [];
    battle.shield = config.shield;
    battle.absorb = config.absorb;
    battle.cardsPlayedDefinitions = [...config.cardsPlayedDefinitions];
    const enemy = battle.enemies[0];
    enemy.hp = config.enemyHp;
    enemy.maxHp = Math.max(config.enemyHp, enemy.maxHp || 0);
    enemy.shield = 0;
    enemy.statuses = {};
    enemy.intent = { ...config.enemyIntent };
    E.attachEnemyAliases(battle);
    if (config.poison > 0) E.addStatus(run, "enemy", "poison", config.poison);
    for (const key of [
      "_healingFeedback",
      "_playerDamageFeedback",
      "_shieldGainFeedback",
      "_absorbFeedback",
      "_absorbLossFeedback",
      "_damageFeedback",
      "_statusProcFeedback",
      "_enemyHitFeedback",
      "_drawFeedback",
      "_shuffleFeedback",
      "_enrageFeedback",
    ]) delete run[key];
    window.__feedbackFxEvents.length = 0;
  }, { ...defaults, ...config });
}

async function endTurn(page, expectedTurn = 2) {
  const button = page.locator('.battle [data-action="end"]');
  await button.waitFor({ state: "visible" });
  assert(!(await button.isDisabled()), "end-turn button disabled");
  await button.click();
  await page.waitForFunction((turn) => {
    const run = window.HarmonyCurrentRenderRun;
    return (
      run?.phase === "battle" &&
      run.battle?.turn >= turn &&
      !run.battle?.enemyPhase &&
      document.querySelector(".battle")?.classList.contains("player-phase")
    );
  }, expectedTurn, { timeout: 45000 });
  await page.waitForTimeout(250);
}

const fx = (events, type, text = null) =>
  events.filter((event) => event.type === type && (text === null || event.text.includes(text)));

const browser = await chromium.launch({ headless: true });
try {
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, errors } = await startBattle(context);
    await prepare(page, {
      inventory: ["trait_aegis_kinetic_absorption"],
      shield: 20,
      absorb: 0,
      enemyIntent: { type: "attack", value: 10, hits: 1, attackPattern: "nonContact" },
    });
    await endTurn(page, 2);
    const events = await page.evaluate(() => window.__feedbackFxEvents);
    assert(fx(events, "shield-block").length >= 1, "kinetic absorb: Shield Block VFX missing");
    assert(fx(events, "absorb-gain", "+2").length === 1, "kinetic absorb: +2 Absorb VFX must play once");
    assert(
      events.findIndex((e) => e.type === "absorb-gain") > events.findIndex((e) => e.type === "shield-block"),
      "kinetic absorb: Absorb Gain must follow Shield Block",
    );
    assert((await page.evaluate(() => window.HarmonyCurrentRenderRun._absorbFeedback)) === undefined,
      "kinetic absorb: stale feedback remained");
    assert(errors.length === 0, "kinetic absorb page errors: " + errors.join(" | "));
    results.kineticAbsorb = events;
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const { page, errors } = await startBattle(context);
    await prepare(page, {
      inventory: ["relic_supercritical_storage_ampoule"],
      enemyIntent: { type: "guard", value: 0 },
    });
    await endTurn(page, 2);
    await page.evaluate(() => {
      window.HarmonyCurrentRenderRun.battle.enemies[0].intent = { type: "guard", value: 0 };
    });
    await endTurn(page, 3);
    const events = await page.evaluate(() => window.__feedbackFxEvents);
    assert(fx(events, "absorb-gain", "+8").length === 2, "ampoule: turn 2/3 should each show +8");
    assert(errors.length === 0, "ampoule page errors: " + errors.join(" | "));
    results.turnStartAbsorb = events;
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, errors } = await startBattle(context);
    await prepare(page, {
      inventory: ["trait_scent_memory_echo", "curse_trait_unstable_solvent"],
      hpMissing: 10,
    });
    await page.evaluate(() => {
      const run = window.HarmonyCurrentRenderRun;
      run.battle.pendingDiscard = 1;
      run.battle.hand = [{ id: "strike", level: 0 }];
      const button = document.createElement("button");
      button.id = "feedback-discard-trigger";
      button.dataset.action = "discard-choice";
      button.dataset.index = "0";
      button.className = "card";
      button.textContent = "discard";
      document.querySelector("#app").append(button);
    });
    await page.locator("#feedback-discard-trigger").click();
    await page.waitForFunction(() => window.HarmonyCurrentRenderRun.battle.pendingDiscard === 0, null, { timeout: 10000 });
    await page.waitForTimeout(250);
    const events = await page.evaluate(() => window.__feedbackFxEvents);
    assert(fx(events, "player-damage", "-1").length === 1, "discard self-damage VFX missing/duplicate");
    assert(fx(events, "absorb-gain", "+1").length === 1, "discard Absorb VFX missing/duplicate");
    assert(events.findIndex((e) => e.type === "absorb-gain") > events.findIndex((e) => e.type === "player-damage"),
      "discard: damage should present before Absorb Gain");
    const stale = await page.evaluate(() => ({
      damage: window.HarmonyCurrentRenderRun._playerDamageFeedback,
      absorb: window.HarmonyCurrentRenderRun._absorbFeedback,
    }));
    assert(stale.damage === undefined && stale.absorb === undefined, "discard stale feedback remained");
    assert(errors.length === 0, "discard page errors: " + errors.join(" | "));
    results.discard = events;
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, errors } = await startBattle(context);
    await prepare(page, {
      inventory: ["trait_saturated_spillover", "trait_shield_to_blade_transmute"],
      shield: 20,
      absorb: 25,
      enemyIntent: { type: "guard", value: 0 },
    });
    await endTurn(page, 2);
    const events = await page.evaluate(() => window.__feedbackFxEvents);
    const hitIndex = events.findIndex((e) => e.type === "enemy-damage" && e.text.includes("-4")),
      shieldIndex = events.findIndex((e) => e.type === "shield-gain" && e.text.includes("+3")),
      actionIndex = events.findIndex((e) => e.type === "enemy-action");
    assert(hitIndex >= 0, "shield-to-blade enemy Hit VFX missing");
    assert(shieldIndex >= 0, "saturated spillover Shield Gain VFX missing");
    assert(actionIndex < 0 || hitIndex < actionIndex, "end-turn hit VFX slipped behind Enemy Action");
    assert(actionIndex < 0 || shieldIndex < actionIndex, "end-turn shield VFX slipped behind Enemy Action");
    assert(errors.length === 0, "end-turn effects page errors: " + errors.join(" | "));
    results.endTurn = events;
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const { page, errors } = await startBattle(context);
    await prepare(page, {
      inventory: ["relic_dewdrop_collector_funnel", "trait_steady_metabolism"],
      hpMissing: 10,
      enemyIntent: { type: "guard", value: 0 },
    });
    await endTurn(page, 2);
    const events = await page.evaluate(() => window.__feedbackFxEvents);
    const healIndex = events.findIndex((e) => e.type === "healing" && e.text.includes("+2")),
      shieldIndex = events.findIndex((e) => e.type === "shield-gain" && e.text.includes("+2"));
    assert(healIndex >= 0 && shieldIndex > healIndex, "regen: Healing -> Shield Gain ordering broken");
    assert(errors.length === 0, "regen page errors: " + errors.join(" | "));
    results.regen = events;
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, errors } = await startBattle(context);
    await prepare(page, {
      inventory: ["curse_trait_abyssal_mirror_puppet", "relic_dewdrop_collector_funnel"],
      hpMissing: 20,
      cardsPlayedDefinitions: [{ attack: 10, bypassShield: true }],
      enemyIntent: { type: "guard", value: 0 },
    });
    await endTurn(page, 2);
    const events = await page.evaluate(() => window.__feedbackFxEvents);
    assert(fx(events, "player-damage", "-10").length === 1, "mirror: exact -10 Player Damage VFX missing/duplicate");
    assert(fx(events, "healing", "+2").length === 1, "mirror+regen: +2 Healing VFX missing/duplicate");
    assert(events.findIndex((e) => e.type === "healing") > events.findIndex((e) => e.type === "player-damage"),
      "mirror+regen: healing should not collapse into net HP delta");
    assert(errors.length === 0, "mirror page errors: " + errors.join(" | "));
    results.mirror = events;
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, errors } = await startBattle(context);
    await prepare(page, {
      inventory: ["relic_dried_chamomile_flower"],
      hpMissing: 10,
      enemyHp: 1,
      enemyIntent: { type: "guard", value: 0 },
      poison: 1,
    });
    await page.locator('.battle [data-action="end"]').click();
    await page.waitForFunction(() => window.HarmonyCurrentRenderRun?.phase === "reward", null, { timeout: 45000 });
    await page.waitForTimeout(250);
    const events = await page.evaluate(() => window.__feedbackFxEvents);
    assert(fx(events, "healing", "+2").length === 1, "battleEndHeal VFX missing/duplicate");
    assert(errors.length === 0, "battleEndHeal page errors: " + errors.join(" | "));
    results.battleEndHeal = events;
    await context.close();
  }

  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const { page, errors } = await startBattle(context);
    await prepare(page, {
      inventory: ["relic_supercritical_storage_ampoule"],
      enemyIntent: { type: "guard", value: 0 },
    });
    await endTurn(page, 2);
    const events = await page.evaluate(() => window.__feedbackFxEvents);
    assert(fx(events, "absorb-gain", "+8").length === 1, "reduced motion lost Absorb feedback information");
    assert(errors.length === 0, "reduced motion page errors: " + errors.join(" | "));
    results.reducedMotion = events;
    await context.close();
  }

  console.log("HARMONY_FEEDBACK_VFX_BROWSER=" + JSON.stringify(results));
} finally {
  await browser.close();
}
