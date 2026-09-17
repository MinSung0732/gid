import { chromium } from "playwright";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const ORIGIN = "http://127.0.0.1:5173";
const GAME = `${ORIGIN}/games/harmony/?local=1`;
const BASELINE = "faf1c9eb5625cad2f2e05feb0ffb16e2d1a3ad10";
const ATTACK = {
  id: "contact_glass_dropper_strike",
  name: "유리 드로퍼 타격",
  expectedClass: "weak-contact-shake",
};
const HAND_SELECTOR = ".battle .hand";
const CARD_SELECTOR = `${HAND_SELECTOR} > .card[data-action="play"]`;
const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844, orientation: "portrait" },
  { name: "430x932", width: 430, height: 932, orientation: "portrait" },
  { name: "844x390", width: 844, height: 390, orientation: "landscape" },
  { name: "932x430", width: 932, height: 430, orientation: "landscape" },
];
const MOTIONS = ["full", "reduce"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitServer() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(ORIGIN)).ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error("server did not start");
}

async function installFixture(page, { seed, motion, enemies }) {
  return page.evaluate(async ({ seed, motion, enemies, cardId }) => {
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
    const battle = run.battle;
    battle.ap = 20;
    battle.shield = 18;
    battle.absorb = 50;
    battle.pendingDiscard = 0;
    battle.enemyPhase = false;
    battle.completedEnemies = [];
    battle.actingEnemy = null;
    battle.discard = [];

    const template = structuredClone(battle.enemies[0]);
    battle.enemies = Array.from({ length: enemies }, (_, index) => ({
      ...structuredClone(template),
      name: `${template.name}${enemies > 1 ? ` ${index + 1}` : ""}`,
      hp: 999,
      maxHp: 999,
      shield: 0,
      statuses: {},
      intent: { type: "attack", value: 5 },
    }));
    battle.selectedTarget = 0;

    const filler = Object.keys(CARDS).filter((id) => id !== "impurity" && id !== cardId);
    battle.hand = [{ id: cardId, level: 0 }];
    while (battle.hand.length < 7) {
      battle.hand.push({ id: filler[(battle.hand.length * 7) % filler.length], level: 0 });
    }
    battle.draw = Array.from({ length: 16 }, (_, index) => ({
      id: filler[(index + 11) % filler.length],
      level: 0,
    }));
    E.attachEnemyAliases(battle);
    persistence.saveGame(storage, { meta, run }, 910000 + seed);
    return { enemies: battle.enemies.length, hand: battle.hand.length, card: CARDS[cardId]?.name };
  }, { seed, motion, enemies, cardId: ATTACK.id });
}

async function openBattle(context, options) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("Failed to load resource")) {
      errors.push(message.text());
    }
  });

  await page.goto(`${ORIGIN}/`, { waitUntil: "domcontentloaded" });
  const fixture = await installFixture(page, options);
  await page.goto(GAME, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => typeof document.querySelector("#tools-toggle")?.onclick === "function",
    null,
    { timeout: 15000 },
  );
  const resume = page.locator('[data-action="resume"]');
  assert.equal(await resume.count(), 1, "saved battle resume missing");
  await resume.click();
  await page.waitForSelector(HAND_SELECTOR, { state: "visible", timeout: 10000 });
  await page.waitForFunction(() => document.body.classList.contains("mobile-battle-active"), null, {
    timeout: 10000,
  });
  await page.waitForTimeout(160);
  return { page, fixture, errors };
}

function rectStable(a, b, tolerance = 0.02) {
  if (!a || !b) return false;
  return ["x", "y", "width", "height"].every(
    (key) => Math.abs(Number(a[key] || 0) - Number(b[key] || 0)) <= tolerance,
  );
}

async function readMobileStructure(page) {
  return page.evaluate(({ handSelector }) => {
    const visible = (node) => {
      if (!node) return false;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const rect = (node) => node?.getBoundingClientRect().toJSON() || null;
    const hand = document.querySelector(handSelector);
    const battle = document.querySelector(".battle");
    const field = document.querySelector(".enemies-field");
    const turn = document.querySelector(".turn-order");
    const harmony = document.querySelector(".mobile-harmony-core");
    const resources = document.querySelector(".combat-stats");
    const endTurn = document.querySelector('[data-action="end"]');
    const footer = document.querySelector(".turn-bar");
    const scrolling = document.scrollingElement;
    return {
      mobileActive: document.body.classList.contains("mobile-battle-active"),
      bodyOverflow: getComputedStyle(document.body).overflow,
      scrollW: scrolling?.scrollWidth || 0,
      scrollH: scrolling?.scrollHeight || 0,
      innerWidth: innerWidth,
      innerHeight: innerHeight,
      orientation: matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape",
      battle: rect(battle),
      battleVisible: visible(battle),
      field: rect(field),
      enemyCount: document.querySelectorAll(".enemies-field > .enemy").length,
      hand: rect(hand),
      handVisible: visible(hand),
      handCards: hand?.querySelectorAll(":scope > .card").length || 0,
      handOverflowX: hand ? getComputedStyle(hand).overflowX : "",
      handScrollWidth: hand?.scrollWidth || 0,
      handClientWidth: hand?.clientWidth || 0,
      turn: rect(turn),
      turnVisible: visible(turn),
      harmonyVisible: visible(harmony),
      resourcesVisible: visible(resources),
      footer: rect(footer),
      endTurnVisible: visible(endTurn),
      endTurnDisabled: Boolean(endTurn?.disabled),
    };
  }, { handSelector: HAND_SELECTOR });
}

async function startShakeProbe(page, maxFrames = 90) {
  await page.evaluate((maxFrames) => {
    const rect = (node) => node?.getBoundingClientRect().toJSON() || null;
    window.__mobileShakeProbe = { frames: [], done: false, actionFrame: null };
    let index = 0;
    const tick = () => {
      const battle = document.querySelector(".battle");
      const field = document.querySelector(".enemies-field");
      window.__mobileShakeProbe.frames.push({
        index,
        battle: rect(battle),
        field: rect(field),
        battleClass: battle?.className || "",
        battleTransform: battle ? getComputedStyle(battle).transform : "",
        fieldTransform: field ? getComputedStyle(field).transform : "",
      });
      index += 1;
      if (index < maxFrames) requestAnimationFrame(tick);
      else window.__mobileShakeProbe.done = true;
    };
    requestAnimationFrame(tick);
  }, maxFrames);
  await page.waitForFunction(() => window.__mobileShakeProbe?.frames?.length >= 5);
}

async function markAction(page) {
  await page.evaluate(() => {
    window.__mobileShakeProbe.actionFrame = window.__mobileShakeProbe.frames.length;
  });
}

async function collectShakeProbe(page) {
  await page.waitForFunction(() => window.__mobileShakeProbe?.done, null, { timeout: 10000 });
  return page.evaluate(() => structuredClone(window.__mobileShakeProbe));
}

function analyzeShake(probe, motion, label) {
  const start = Math.max(0, (probe.actionFrame ?? 5) - 1);
  const frames = probe.frames.slice(start);
  const base = frames[0];
  assert.ok(base?.battle, `${label}: battle probe missing`);

  for (const frame of frames) {
    assert.ok(rectStable(base.battle, frame.battle), `${label}: battle frame moved at frame ${frame.index}`);
    assert.ok(
      !frame.battleTransform || frame.battleTransform === "none" || frame.battleTransform === "matrix(1, 0, 0, 1, 0, 0)",
      `${label}: battle transform observed at frame ${frame.index}: ${frame.battleTransform}`,
    );
  }

  const classFrames = frames.filter((frame) => frame.battleClass.split(/\s+/).includes(ATTACK.expectedClass));
  const fieldMotionFrames = frames.filter(
    (frame) => frame.fieldTransform && frame.fieldTransform !== "none" && frame.fieldTransform !== "matrix(1, 0, 0, 1, 0, 0)",
  );
  assert.ok(classFrames.length > 0, `${label}: shake event hook did not fire`);
  if (motion === "full") {
    assert.ok(fieldMotionFrames.length > 0, `${label}: enemies-field shake motion missing`);
  } else {
    assert.equal(fieldMotionFrames.length, 0, `${label}: reduced motion still shakes enemies-field`);
  }
  return { classFrames: classFrames.length, fieldMotionFrames: fieldMotionFrames.length };
}

async function clickAttack(page, label) {
  const card = page.locator(CARD_SELECTOR, { hasText: ATTACK.name }).first();
  assert.equal(await card.count(), 1, `${label}: attack card missing`);
  assert.notEqual(await card.getAttribute("aria-disabled"), "true", `${label}: attack card disabled`);
  await card.click();
}

async function mobileSmoke(browser) {
  let seed = 18000;
  let cases = 0;
  for (const viewport of VIEWPORTS) {
    for (const motion of MOTIONS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: motion === "reduce" ? "reduce" : "no-preference",
      });
      for (const enemies of [1, 2, 3]) {
        const label = `${viewport.name}-${motion}-enemy${enemies}`;
        const { page, fixture, errors } = await openBattle(context, {
          seed: seed++,
          motion,
          enemies,
        });
        const initial = await readMobileStructure(page);
        assert.equal(fixture.enemies, enemies, `${label}: fixture enemy count mismatch`);
        assert.equal(fixture.hand, 7, `${label}: fixture hand mismatch`);
        assert.equal(initial.mobileActive, true, `${label}: Step 9 mobile mode inactive`);
        assert.equal(initial.orientation, viewport.orientation, `${label}: orientation mismatch`);
        assert.equal(initial.bodyOverflow, "hidden", `${label}: mobile body freeze lost`);
        assert.ok(initial.scrollW <= viewport.width + 1, `${label}: page horizontal scroll regression`);
        assert.ok(initial.scrollH <= viewport.height + 1, `${label}: page vertical scroll regression`);
        assert.equal(initial.battleVisible, true, `${label}: battle not visible`);
        assert.equal(initial.enemyCount, enemies, `${label}: rendered enemy count mismatch`);
        assert.equal(initial.handVisible, true, `${label}: hand not visible`);
        assert.equal(initial.handCards, 7, `${label}: seven-card hand missing`);
        assert.ok(["auto", "scroll"].includes(initial.handOverflowX), `${label}: hand overflow-x is ${initial.handOverflowX}`);
        assert.ok(initial.handScrollWidth > initial.handClientWidth, `${label}: hand has no horizontal overflow`);
        assert.equal(initial.turnVisible, true, `${label}: turn order not visible`);
        assert.equal(initial.harmonyVisible, true, `${label}: Harmony not visible`);
        assert.equal(initial.resourcesVisible, true, `${label}: combat resources not visible`);
        assert.equal(initial.endTurnVisible, true, `${label}: End Turn not visible`);
        assert.equal(initial.endTurnDisabled, false, `${label}: End Turn unexpectedly disabled`);

        await startShakeProbe(page);
        await markAction(page);
        await clickAttack(page, label);
        const shake = analyzeShake(await collectShakeProbe(page), motion, label);
        const post = await readMobileStructure(page);
        assert.ok(rectStable(initial.battle, post.battle), `${label}: battle frame changed after card use`);
        assert.equal(post.enemyCount, enemies, `${label}: enemy count changed after card use`);
        assert.equal(post.handVisible, true, `${label}: hand disappeared after card use`);
        assert.equal(post.turnVisible, true, `${label}: turn order disappeared after card use`);
        assert.equal(post.harmonyVisible, true, `${label}: Harmony disappeared after card use`);
        assert.equal(post.resourcesVisible, true, `${label}: resources disappeared after card use`);
        assert.equal(post.endTurnVisible, true, `${label}: End Turn disappeared after card use`);
        assert.deepEqual(errors, [], `${label}: console errors ${errors.join("\n")}`);
        console.log(
          `PASS_MOBILE ${label} orientation=${post.orientation} enemyMotion=${shake.fieldMotionFrames} class=${shake.classFrames} handOverflow=${post.handScrollWidth}/${post.handClientWidth}`,
        );
        cases += 1;
        await page.close();
      }
      await context.close();
    }
  }
  return cases;
}

const server = spawn(process.execPath, ["scripts/serve.cjs"], {
  stdio: ["ignore", "ignore", "inherit"],
});
try {
  await waitServer();
  const browser = await chromium.launch({ headless: true });
  const cases = await mobileSmoke(browser);
  await browser.close();
  console.log(`SUMMARY ${JSON.stringify({ baseline: BASELINE, mobileCases: cases, result: "PASS" })}`);
} finally {
  server.kill("SIGTERM");
}
