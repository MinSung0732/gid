import { chromium } from "playwright";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const ORIGIN = "http://127.0.0.1:5173";
const GAME = `${ORIGIN}/games/harmony/?local=1`;
const BASELINE = "faf1c9eb5625cad2f2e05feb0ffb16e2d1a3ad10";
const DESKTOP_MODES = [
  { name: "1440x900-full", width: 1440, height: 900, motion: "full" },
  { name: "1440x900-reduced", width: 1440, height: 900, motion: "reduce" },
  { name: "1366x768-full", width: 1366, height: 768, motion: "full" },
  { name: "1366x768-reduced", width: 1366, height: 768, motion: "reduce" },
];
const MOBILE_MODES = [
  { name: "390x844-full", width: 390, height: 844, motion: "full" },
  { name: "844x390-full", width: 844, height: 390, motion: "full" },
  { name: "390x844-reduced", width: 390, height: 844, motion: "reduce" },
];
const ATTACKS = [
  { key: "weak", id: "contact_glass_dropper_strike", name: "유리 드로퍼 타격", expectedClass: "weak-contact-shake" },
  { key: "strong", id: "contact_terracotta_crush", name: "테라코타 발향석 대격돌", expectedClass: "strong-contact-shake" },
  { key: "super", id: "contact_crystal_guillotine", name: "크리스탈 시약병 단두대", expectedClass: "super-contact-shake" },
  { key: "status", id: "contact_blazing_wick_brand", name: "타오르는 목화 심지 낙인", expectedClass: "strong-contact-shake" },
];
const FIXED_SELECTORS = {
  battle: ".battle",
  battleTop: ".battle-top",
  battleArena: ".battle-arena",
  turnOrder: ".turn-order",
  combatStats: ".combat-stats",
  hand: ".battle > .hand",
  footer: ".turn-bar",
};

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function waitServer() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(ORIGIN)).ok) return; } catch {}
    await sleep(100);
  }
  throw new Error("server did not start");
}

async function installFixture(page, { seed, motion, cardId, enemies = 1, handCount = 4 }) {
  return page.evaluate(async ({ seed, motion, cardId, enemies, handCount }) => {
    const E = await import("/games/harmony/engine.js");
    const { CARDS } = await import("/games/harmony/data.js");
    const persistence = await import("/games/harmony/persistence.js");
    const { createScopedStorage, GUEST_SCOPE } = await import("/games/harmony/scoped-storage.js");
    const storage = createScopedStorage(window.localStorage, GUEST_SCOPE);
    storage.clear();
    for (const key of Object.values(persistence.SAVE_KEYS)) window.localStorage.removeItem(key);
    window.localStorage.removeItem("harmony_cached_user_id");
    window.localStorage.setItem("harmony_combat_fx", "on");
    window.localStorage.setItem("harmony_motion_mode", motion);

    const meta = E.freshMeta();
    const run = E.newRun(seed);
    run.route[0] = "battle";
    E.enter(run, meta);
    run.hp = run.maxHp;
    const b = run.battle;
    b.ap = 20;
    b.shield = 18;
    b.absorb = 50;
    b.pendingDiscard = 0;
    b.enemyPhase = false;
    b.completedEnemies = [];
    b.actingEnemy = null;
    b.discard = [];

    const template = structuredClone(b.enemies[0]);
    b.enemies = Array.from({ length: enemies }, (_, index) => ({
      ...structuredClone(template),
      name: `${template.name}${enemies > 1 ? ` ${index + 1}` : ""}`,
      hp: 999,
      maxHp: 999,
      shield: 0,
      statuses: {},
      intent: { type: "attack", value: 5 },
    }));
    b.selectedTarget = 0;

    const filler = Object.keys(CARDS).filter((id) => id !== "impurity" && id !== cardId);
    b.hand = [{ id: cardId, level: 0 }];
    while (b.hand.length < handCount) b.hand.push({ id: filler[(b.hand.length * 7) % filler.length], level: 0 });
    b.draw = Array.from({ length: 16 }, (_, i) => ({ id: filler[(i + 11) % filler.length], level: 0 }));
    E.attachEnemyAliases(b);
    persistence.saveGame(storage, { meta, run }, 900000 + seed);
    return { card: CARDS[cardId]?.name, enemies: b.enemies.length, hand: b.hand.length };
  }, { seed, motion, cardId, enemies, handCount });
}

async function openBattle(context, options) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack || error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(`${ORIGIN}/`, { waitUntil: "domcontentloaded" });
  const fixture = await installFixture(page, options);
  await page.goto(GAME, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof document.querySelector("#tools-toggle")?.onclick === "function", null, { timeout: 15000 });
  const resume = page.locator('[data-action="resume"]');
  assert.equal(await resume.count(), 1, "saved battle resume missing");
  await resume.click();
  await page.waitForSelector(".battle > .hand", { timeout: 10000 });
  await page.waitForTimeout(120);
  return { page, fixture, errors };
}

async function startFrameProbe(page, maxFrames = 190) {
  await page.evaluate(({ fixedSelectors, maxFrames }) => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x: +r.x.toFixed(3), y: +r.y.toFixed(3), w: +r.width.toFixed(3), h: +r.height.toFixed(3) };
    };
    window.__shakeFixProbe = { frames: [], done: false, actionFrame: null };
    let i = 0;
    const tick = (ts) => {
      const battle = document.querySelector(".battle");
      const field = document.querySelector(".enemies-field");
      const enemy = document.querySelector(".enemies-field > .enemy");
      const fixed = {};
      for (const [key, selector] of Object.entries(fixedSelectors)) fixed[key] = rect(selector);
      const fr = field?.getBoundingClientRect();
      window.__shakeFixProbe.frames.push({
        i,
        ts: +ts.toFixed(2),
        fixed,
        enemiesField: fr ? { x:+fr.x.toFixed(3), y:+fr.y.toFixed(3), w:+fr.width.toFixed(3), h:+fr.height.toFixed(3) } : null,
        battleClass: battle?.className || "",
        battleTransform: battle ? getComputedStyle(battle).transform : "",
        fieldTransform: field ? getComputedStyle(field).transform : "",
        enemyHit: enemy ? [...enemy.classList].some((name) => name.startsWith("enemy-hit")) : false,
        vfxCount: document.querySelectorAll(".contact-impact-hold,.contact-impact-crack,.damage-pop,.strong-contact-impact,.combat-impact-ring,.shield-break-impact").length,
      });
      i++;
      if (i < maxFrames) requestAnimationFrame(tick);
      else window.__shakeFixProbe.done = true;
    };
    requestAnimationFrame(tick);
  }, { fixedSelectors: FIXED_SELECTORS, maxFrames });
  await page.waitForFunction(() => window.__shakeFixProbe?.frames?.length >= 6);
}

async function markAction(page) {
  await page.evaluate(() => { window.__shakeFixProbe.actionFrame = window.__shakeFixProbe.frames.length; });
}
async function collect(page) {
  await page.waitForFunction(() => window.__shakeFixProbe?.done, null, { timeout: 8000 });
  return page.evaluate(() => structuredClone(window.__shakeFixProbe));
}
function delta(a, b, key) { return Math.abs((a?.[key] ?? 0) - (b?.[key] ?? 0)); }
function rectStable(a, b, tolerance = 0.02) {
  return ["x","y","w","h"].every((key) => delta(a,b,key) <= tolerance);
}

function analyzeAttack(probe, expectedClass, motion) {
  const start = Math.max(0, (probe.actionFrame ?? 6) - 2);
  const base = probe.frames[start];
  const relevant = probe.frames.slice(start);
  const fixedFailures = [];
  for (const frame of relevant) {
    for (const key of Object.keys(FIXED_SELECTORS)) {
      if (!rectStable(base.fixed[key], frame.fixed[key])) fixedFailures.push({ frame: frame.i, key, base: base.fixed[key], value: frame.fixed[key] });
    }
  }
  const battleTransformFrames = relevant.filter((f) => f.battleTransform && f.battleTransform !== "none" && f.battleTransform !== "matrix(1, 0, 0, 1, 0, 0)");
  const classFrames = relevant.filter((f) => f.battleClass.split(/\s+/).includes(expectedClass));
  const enemyMotionFrames = relevant.filter((f) => f.fieldTransform && f.fieldTransform !== "none" && f.fieldTransform !== "matrix(1, 0, 0, 1, 0, 0)");
  const hitFrames = relevant.filter((f) => f.enemyHit || f.vfxCount > 0);
  if (motion === "full") {
    assert.ok(classFrames.length > 0, `${expectedClass}: production event hook did not fire`);
    assert.ok(enemyMotionFrames.length > 0, `${expectedClass}: enemies-field did not receive shake motion`);
    assert.ok(hitFrames.length > 0, `${expectedClass}: enemy/VFX hit feedback not observed`);
  } else {
    assert.equal(enemyMotionFrames.length, 0, `${expectedClass}: reduced motion still shakes enemies-field`);
  }
  assert.equal(battleTransformFrames.length, 0, `${expectedClass}: battle transform moved on ${battleTransformFrames[0]?.i}`);
  assert.deepEqual(fixedFailures, [], `${expectedClass}: fixed UI moved: ${JSON.stringify(fixedFailures.slice(0, 3))}`);
  return {
    classFrames: classFrames.length,
    enemyMotionFrames: enemyMotionFrames.length,
    hitFrames: hitFrames.length,
    firstMotion: enemyMotionFrames[0] ? {
      i: enemyMotionFrames[0].i,
      battle: enemyMotionFrames[0].fixed.battle,
      field: enemyMotionFrames[0].enemiesField,
      fieldTransform: enemyMotionFrames[0].fieldTransform,
    } : null,
  };
}

async function clickCard(page, attack) {
  const card = page.locator('.battle > .hand > .card[data-action="play"]', { hasText: attack.name }).first();
  assert.equal(await card.count(), 1, `${attack.key}: ${attack.name} card missing`);
  assert.notEqual(await card.getAttribute("aria-disabled"), "true", `${attack.key}: card disabled`);
  await card.click();
}

async function desktopAttackMatrix(browser) {
  let seed = 12000;
  const rows = [];
  for (const mode of DESKTOP_MODES) {
    const context = await browser.newContext({
      viewport: { width: mode.width, height: mode.height },
      reducedMotion: mode.motion === "reduce" ? "reduce" : "no-preference",
    });
    for (const attack of ATTACKS) {
      for (let repeat = 1; repeat <= 2; repeat++) {
        const { page, fixture, errors } = await openBattle(context, { seed: seed++, motion: mode.motion, cardId: attack.id, enemies: 1, handCount: 4 });
        await startFrameProbe(page);
        await markAction(page);
        await clickCard(page, attack);
        const result = analyzeAttack(await collect(page), attack.expectedClass, mode.motion);
        assert.deepEqual(errors, [], `${mode.name}/${attack.key}: console errors ${errors.join("\n")}`);
        rows.push({ mode: mode.name, attack: attack.key, repeat, fixture, ...result });
        console.log(`PASS_ATTACK ${mode.name} ${attack.key} r${repeat} class=${result.classFrames} enemyMotion=${result.enemyMotionFrames} hit=${result.hitFrames}`);
        if (result.firstMotion) console.log(`FIRST_MOTION ${mode.name} ${attack.key} ${JSON.stringify(result.firstMotion)}`);
        await page.close();
      }
    }
    await context.close();
  }
  return rows;
}

async function regressionMatrix(browser) {
  let seed = 15000;
  for (const viewport of [{width:1440,height:900,name:"1440x900"},{width:1366,height:768,name:"1366x768"}]) {
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    for (const enemies of [1,2,3]) {
      const { page, errors } = await openBattle(context, { seed: seed++, motion: "full", cardId: ATTACKS[0].id, enemies, handCount: 7 });
      const before = await page.evaluate(() => ({
        battle: document.querySelector(".battle")?.getBoundingClientRect().toJSON(),
        turn: document.querySelector(".turn-order")?.getBoundingClientRect().toJSON(),
        handCount: document.querySelectorAll(".battle > .hand > .card").length,
      }));
      await clickCard(page, ATTACKS[0]);
      await page.waitForTimeout(450);
      const afterHit = await page.evaluate(() => ({
        battle: document.querySelector(".battle")?.getBoundingClientRect().toJSON(),
        turn: document.querySelector(".turn-order")?.getBoundingClientRect().toJSON(),
        enemyCount: document.querySelectorAll(".enemies-field > .enemy").length,
      }));
      assert.ok(rectStable(before.battle, afterHit.battle), `${viewport.name}/enemy${enemies}: battle moved after card`);
      assert.ok(rectStable(before.turn, afterHit.turn), `${viewport.name}/enemy${enemies}: turn order moved after card`);
      assert.equal(afterHit.enemyCount, enemies, `${viewport.name}: enemy count changed`);
      assert.equal(before.handCount, 7, `${viewport.name}: seven-card hand fixture missing`);

      const roundBefore = await page.locator(".battle-top .eyebrow").textContent();
      await page.locator('[data-action="end"]').click();
      await page.waitForFunction((text) => document.querySelector(".battle-top .eyebrow")?.textContent !== text, roundBefore, { timeout: 8000 });
      await page.waitForTimeout(100);
      const afterTurn = await page.evaluate(() => ({
        battle: document.querySelector(".battle")?.getBoundingClientRect().toJSON(),
        turn: document.querySelector(".turn-order")?.getBoundingClientRect().toJSON(),
        handCount: document.querySelectorAll(".battle > .hand > .card").length,
      }));
      assert.ok(rectStable(before.battle, afterTurn.battle), `${viewport.name}/enemy${enemies}: battle moved after enemy turn/draw`);
      assert.ok(rectStable(before.turn, afterTurn.turn), `${viewport.name}/enemy${enemies}: turn order moved after enemy turn/draw`);
      assert.ok(afterTurn.handCount > 0, `${viewport.name}/enemy${enemies}: hand lost after draw`);
      assert.deepEqual(errors, [], `${viewport.name}/enemy${enemies}: console errors ${errors.join("\n")}`);
      console.log(`PASS_REGRESSION ${viewport.name} enemies=${enemies} card-use enemy-turn hand turn-order`);
      await page.close();
    }
    await context.close();
  }
}

async function mobileSmoke(browser) {
  let seed = 18000;
  for (const mode of MOBILE_MODES) {
    const context = await browser.newContext({ viewport: { width: mode.width, height: mode.height }, reducedMotion: mode.motion === "reduce" ? "reduce" : "no-preference" });
    const { page, errors } = await openBattle(context, { seed: seed++, motion: mode.motion, cardId: ATTACKS[0].id, enemies: 3, handCount: 7 });
    const initial = await page.evaluate(() => ({
      bodyOverflow: getComputedStyle(document.body).overflow,
      scrollW: document.scrollingElement.scrollWidth,
      scrollH: document.scrollingElement.scrollHeight,
      battle: document.querySelector(".battle")?.getBoundingClientRect().toJSON(),
      hand: document.querySelector(".battle > .hand")?.getBoundingClientRect().toJSON(),
      turn: document.querySelector(".turn-order")?.getBoundingClientRect().toJSON(),
      footer: document.querySelector(".turn-bar")?.getBoundingClientRect().toJSON(),
    }));
    assert.equal(initial.bodyOverflow, "hidden", `${mode.name}: mobile freeze lost`);
    assert.ok(initial.scrollW <= mode.width + 1 && initial.scrollH <= mode.height + 1, `${mode.name}: page scroll regression`);
    await clickCard(page, ATTACKS[0]);
    await page.waitForTimeout(350);
    const post = await page.evaluate(() => ({
      battle: document.querySelector(".battle")?.getBoundingClientRect().toJSON(),
      turn: document.querySelector(".turn-order")?.getBoundingClientRect().toJSON(),
      hand: document.querySelector(".battle > .hand")?.getBoundingClientRect().toJSON(),
      footer: document.querySelector(".turn-bar")?.getBoundingClientRect().toJSON(),
    }));
    assert.ok(rectStable(initial.battle, post.battle), `${mode.name}: battle frame moved`);
    assert.ok(rectStable(initial.turn, post.turn), `${mode.name}: turn order moved`);
    assert.ok(rectStable(initial.footer, post.footer), `${mode.name}: footer moved`);
    assert.ok(post.hand && post.hand.w > 0 && post.hand.h > 0, `${mode.name}: hand missing`);
    assert.deepEqual(errors, [], `${mode.name}: console errors ${errors.join("\n")}`);
    console.log(`PASS_MOBILE ${mode.name} portrait/landscape freeze smoke`);
    await page.close();
    await context.close();
  }
}

const server = spawn(process.execPath, ["scripts/serve.cjs"], { stdio: ["ignore", "ignore", "inherit"] });
try {
  await waitServer();
  const browser = await chromium.launch({ headless: true });
  const attackRows = await desktopAttackMatrix(browser);
  await regressionMatrix(browser);
  await mobileSmoke(browser);
  await browser.close();
  console.log(`SUMMARY ${JSON.stringify({ baseline: BASELINE, attacks: attackRows.length, desktopModes: DESKTOP_MODES.length, mobileModes: MOBILE_MODES.length, result: "PASS" })}`);
} finally {
  server.kill("SIGTERM");
}
