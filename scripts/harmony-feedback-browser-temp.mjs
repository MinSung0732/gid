import { chromium } from "playwright";

const BASE = "http://127.0.0.1:5173/games/harmony/";
const assert = (value, message) => { if (!value) throw new Error(message); };
const results = {};

async function setup(context) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
  await page.goto(BASE, { waitUntil:"domcontentloaded", timeout:30000 });
  await page.locator("#app").waitFor({ state:"visible" });
  await page.locator('[data-action="new"]').click();
  await page.locator("#starting-deck-builder").waitFor({ state:"visible" });
  await page.locator('[data-builder-action="preset"]').click();
  await page.locator("#builder-start").click();
  await page.locator('.room [data-action="enter"]').waitFor({ state:"visible" });
  await page.locator('.room [data-action="enter"]').click();
  await page.locator(".battle").waitFor({ state:"visible" });
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    window.__hmyVfxLog = [];
    window.__hmyVfxSeen = new WeakSet();
    const selectors = [
      ".absorb-gain-pop",
      ".absorb-loss-pop",
      ".shield-gain-pop",
      ".shield-block-pop",
      ".healing-effect",
      ".health-damage-pop",
      ".damage-pop",
      ".enemy-action-popup",
    ];
    const record = (element, selector) => {
      if (window.__hmyVfxSeen.has(element)) return;
      window.__hmyVfxSeen.add(element);
      window.__hmyVfxLog.push({
        selector,
        text:(element.textContent || "").replace(/\s+/g," ").trim(),
        time:performance.now(),
      });
    };
    const capture = (node) => {
      if (!(node instanceof Element)) return;
      for (const selector of selectors) {
        if (node.matches(selector)) record(node, selector);
        for (const child of node.querySelectorAll(selector)) record(child, selector);
      }
    };
    window.__hmyVfxObserver = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) capture(node);
    });
    window.__hmyVfxObserver.observe(document.body, { childList:true, subtree:true });
  });
  return { page, errors };
}

async function mutate(page, fn, arg) {
  return page.evaluate(async ({ source, arg }) => {
    const E = await import("./engine.js?v=20260918-3");
    const { CARDS } = await import("./data.js?v=20260918-1");
    const run = window.HarmonyCurrentRenderRun;
    return Function("E","CARDS","run","arg",`return (${source})(E,CARDS,run,arg)`)(E,CARDS,run,arg);
  }, { source:fn.toString(), arg });
}

async function endTurn(page) {
  const before = await page.locator(".battle .eyebrow").textContent();
  const round = Number(before?.match(/ROUND\s+(\d+)/)?.[1] || 0);
  const button = page.locator('.battle [data-action="end"]');
  await button.waitFor({ state:"visible" });
  await button.click();
  try {
    await page.waitForFunction((round) => {
      const text = document.querySelector(".battle .eyebrow")?.textContent || "";
      const next = Number(text.match(/ROUND\s+(\d+)/)?.[1] || 0);
      return next > round && document.querySelector(".battle")?.classList.contains("player-phase");
    }, round, { timeout:15000 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      phase: window.HarmonyCurrentRenderRun?.phase,
      turn: window.HarmonyCurrentRenderRun?.battle?.turn,
      enemyPhase: window.HarmonyCurrentRenderRun?.battle?.enemyPhase,
      hp: window.HarmonyCurrentRenderRun?.hp,
      battleClass: document.querySelector(".battle")?.className || null,
      eyebrow: document.querySelector(".battle .eyebrow")?.textContent || null,
      endDisabled: document.querySelector('.battle [data-action="end"]')?.disabled ?? null,
      vfx: window.__hmyVfxLog || [],
    }));
    console.error("HARMONY_ENDTURN_DIAGNOSTIC=" + JSON.stringify(diagnostic));
    throw error;
  }
  await page.waitForTimeout(900);
  return round + 1;
}

async function logs(page) {
  return page.evaluate(() => [...(window.__hmyVfxLog || [])]);
}

function positions(items, selector) {
  return items.map((item, index) => item.selector === selector ? index : -1).filter((index) => index >= 0);
}

const browser = await chromium.launch({ headless:true });
try {
  // 1) blocked attack -> Shield Block -> Absorb Gain
  {
    const context = await browser.newContext({ viewport:{width:1440,height:900} });
    const { page, errors } = await setup(context);
    await mutate(page, (E,_CARDS,run) => {
      E.addInventoryItem(run,"trait_aegis_kinetic_absorption");
      run.maxHp = 999; run.hp = 999;
      run.battle.shield = 100;
      run.battle.ap = 0;
      run.battle.enemies.slice(1).forEach((enemy) => enemy.hp = 0);
      const enemy = run.battle.enemies[0];
      enemy.hp = 500; enemy.maxHp = 500; enemy.shield = 0;
      enemy.intent = { type:"attack", value:20, hits:1, attackPattern:"contact", name:"검증 타격" };
    });
    await endTurn(page);
    const vfx = await logs(page);
    const block = positions(vfx,".shield-block-pop")[0];
    const absorb = positions(vfx,".absorb-gain-pop")[0];
    assert(block >= 0 && absorb > block, "blocked attack did not present Shield Block -> Absorb Gain");
    assert(vfx.filter((x) => x.selector === ".absorb-gain-pop").length === 1, "blocked absorb gain duplicated");
    assert(errors.length === 0, "blocked absorb browser errors: " + errors.join(" | "));
    results.blockedAbsorb = vfx;
    await context.close();
  }

  // 2/4/6/8) turn-start healing -> shield -> absorb, including turns 2/3/4
  {
    const context = await browser.newContext({ viewport:{width:1440,height:900} });
    const { page, errors } = await setup(context);
    await mutate(page, (E,_CARDS,run) => {
      E.addInventoryItem(run,"relic_supercritical_storage_ampoule");
      E.addInventoryItem(run,"relic_dewdrop_collector_funnel");
      E.addInventoryItem(run,"trait_steady_metabolism");
      run.maxHp = 999; run.hp = 980;
      run.battle.ap = 0;
      run.battle.shield = 100;
      run.battle.enemies.slice(1).forEach((enemy) => enemy.hp = 0);
      const enemy = run.battle.enemies[0];
      enemy.hp = 500; enemy.maxHp = 500;
      E.addStatus(run,"enemy","stun",1);
    });
    const absorbCounts = [];
    for (let turn = 2; turn <= 4; turn++) {
      if (turn > 2)
        await mutate(page, (E,_CARDS,run) => {
          run.hp = Math.min(run.maxHp - 10, run.hp);
          run.battle.shield = 100;
          run.battle.ap = 0;
          E.addStatus(run,"enemy","stun",1);
        });
      await endTurn(page);
      const vfx = await logs(page);
      absorbCounts.push(vfx.filter((x) => x.selector === ".absorb-gain-pop").length);
    }
    const vfx = await logs(page);
    const heal = positions(vfx,".healing-effect")[0],
      shield = positions(vfx,".shield-gain-pop")[0],
      absorb = positions(vfx,".absorb-gain-pop")[0];
    assert(heal >= 0 && shield > heal && absorb > shield, "turn-start order is not Healing -> Shield -> Absorb");
    assert(absorbCounts[0] >= 1 && absorbCounts[1] > absorbCounts[0] && absorbCounts[2] > absorbCounts[1], "turnStartAbsorb did not present on turns 2/3/4");
    assert(errors.length === 0, "turn-start browser errors: " + errors.join(" | "));
    results.turnStart = { absorbCounts, vfx };
    await context.close();
  }

  // 3/12) discard-choice -> player damage -> absorb
  {
    const context = await browser.newContext({ viewport:{width:1440,height:900} });
    const { page, errors } = await setup(context);
    await mutate(page, (E,_CARDS,run) => {
      E.addInventoryItem(run,"trait_scent_memory_echo");
      E.addInventoryItem(run,"curse_trait_unstable_solvent");
      run.maxHp = 999; run.hp = 999;
      run.battle.pendingDiscard = 1;
    });
    const card = page.locator(".hand > .card").first();
    await card.evaluate((node) => {
      node.dataset.action = "discard-choice";
      node.dataset.index = "0";
      node.removeAttribute("aria-disabled");
    });
    await card.click();
    await page.waitForTimeout(900);
    const vfx = await logs(page);
    console.log("HARMONY_DISCARD_VFX=" + JSON.stringify(vfx));
    const damage = positions(vfx,".health-damage-pop")[0],
      absorb = positions(vfx,".absorb-gain-pop")[0];
    assert(damage >= 0 && absorb > damage, "discard did not present Damage -> Absorb after discard animation");
    assert(vfx.filter((x) => x.selector === ".health-damage-pop").length === 1, "discard damage duplicated");
    assert(vfx.filter((x) => x.selector === ".absorb-gain-pop").length === 1, "discard absorb duplicated");
    assert(errors.length === 0, "discard browser errors: " + errors.join(" | "));
    results.discard = vfx;
    await context.close();
  }

  // 14) end-turn shield attack must hit before first enemy action popup.
  {
    const context = await browser.newContext({ viewport:{width:1440,height:900} });
    const { page, errors } = await setup(context);
    await mutate(page, (E,_CARDS,run) => {
      E.addInventoryItem(run,"trait_shield_to_blade_transmute");
      run.maxHp = 999; run.hp = 999;
      run.battle.shield = 20;
      run.battle.ap = 0;
      run.battle.enemies.slice(1).forEach((enemy) => enemy.hp = 0);
      const enemy = run.battle.enemies[0];
      enemy.hp = 500; enemy.maxHp = 500; enemy.shield = 0;
      E.addStatus(run,"enemy","stun",1);
    });
    await endTurn(page);
    const vfx = await logs(page);
    const hit = positions(vfx,".damage-pop")[0],
      enemyAction = positions(vfx,".enemy-action-popup")[0];
    assert(hit >= 0 && enemyAction > hit, "end-turn shield attack VFX was delayed behind enemy action");
    assert(errors.length === 0, "end-turn attack browser errors: " + errors.join(" | "));
    results.endTurnAttack = vfx;
    await context.close();
  }

  // 13) round-end mirror direct damage uses ordinary player damage feedback.
  {
    const context = await browser.newContext({ viewport:{width:1440,height:900} });
    const { page, errors } = await setup(context);
    await mutate(page, (E,CARDS,run) => {
      E.addInventoryItem(run,"curse_trait_abyssal_mirror_puppet");
      run.maxHp = 999; run.hp = 999;
      run.battle.shield = 0;
      run.battle.ap = 0;
      run.battle.cardsPlayedDefinitions = [{ ...CARDS.strike, id:"strike" }];
      run.battle.enemies.slice(1).forEach((enemy) => enemy.hp = 0);
      E.addStatus(run,"enemy","stun",1);
    });
    await endTurn(page);
    const vfx = await logs(page);
    const damage = vfx.filter((x) => x.selector === ".health-damage-pop");
    assert(damage.some((x) => /-7/.test(x.text)), "mirror damage popup did not show actual -7 damage");
    assert(errors.length === 0, "mirror browser errors: " + errors.join(" | "));
    results.mirror = vfx;
    await context.close();
  }

  // 11) round-end victory battleEndHeal shows healing before battle DOM is replaced.
  {
    const context = await browser.newContext({ viewport:{width:1440,height:900} });
    const { page, errors } = await setup(context);
    await mutate(page, (E,_CARDS,run) => {
      E.addInventoryItem(run,"relic_dried_chamomile_flower");
      run.maxHp = 999; run.hp = 900;
      run.battle.ap = 0;
      run.battle.enemies.slice(1).forEach((enemy) => enemy.hp = 0);
      const enemy = run.battle.enemies[0];
      enemy.hp = 1; enemy.maxHp = 500;
      E.addStatus(run,"enemy","stun",1);
      E.addStatus(run,"enemy","poison",1);
    });
    await page.locator('.battle [data-action="end"]').click();
    await page.waitForFunction(() => window.HarmonyCurrentRenderRun?.phase === "reward", null, { timeout:45000 });
    await page.waitForTimeout(900);
    const vfx = await logs(page);
    assert(vfx.some((x) => x.selector === ".healing-effect" && /\+2/.test(x.text)), "battleEndHeal did not present +2 healing VFX");
    assert(errors.length === 0, "battleEndHeal browser errors: " + errors.join(" | "));
    results.battleEndHeal = vfx;
    await context.close();
  }

  // 20) Reduced Motion still surfaces the numeric feedback.
  {
    const context = await browser.newContext({ viewport:{width:1440,height:900}, reducedMotion:"reduce" });
    const { page, errors } = await setup(context);
    await mutate(page, (E,_CARDS,run) => {
      E.addInventoryItem(run,"relic_supercritical_storage_ampoule");
      run.maxHp = 999; run.hp = 999;
      run.battle.ap = 0;
      run.battle.shield = 100;
      run.battle.enemies.slice(1).forEach((enemy) => enemy.hp = 0);
      E.addStatus(run,"enemy","stun",1);
    });
    await endTurn(page);
    const vfx = await logs(page);
    assert(vfx.some((x) => x.selector === ".absorb-gain-pop" && /\+8/.test(x.text)), "reduced motion lost absorb +8 information");
    assert(errors.length === 0, "reduced motion browser errors: " + errors.join(" | "));
    results.reducedMotion = vfx;
    await context.close();
  }

  console.log("HARMONY_FEEDBACK_BROWSER=" + JSON.stringify(results));
} finally {
  await browser.close();
}
