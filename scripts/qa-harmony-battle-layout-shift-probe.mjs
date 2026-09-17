import { chromium } from "playwright";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const ORIGIN = "http://127.0.0.1:5173";
const GAME = `${ORIGIN}/games/harmony/?local=1`;
const MODES = [
  { name: "1440x900-full", width: 1440, height: 900, motion: "full" },
  { name: "1440x900-reduced", width: 1440, height: 900, motion: "reduce" },
  { name: "1366x768-full", width: 1366, height: 768, motion: "full" },
  { name: "1366x768-reduced", width: 1366, height: 768, motion: "reduce" },
];
const ACTIONS = ["card-use", "strong", "super", "status-change", "end-turn"];
const REPEATS = 2;
const SELECTORS = {
  header: "body > header", main: "body > main", notice: "#notice", app: "#app",
  hud: ".hud", route: ".route", battle: ".battle", battleTop: ".battle-top",
  battleArena: ".battle-arena", turnOrder: ".turn-order", enemiesField: ".enemies-field",
  combatStats: ".combat-stats", hand: ".hand",
};

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitServer() {
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch(ORIGIN);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error("server did not start");
}

async function installFixture(page, seed, motion) {
  return page.evaluate(async ({ seed, motion }) => {
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
    const battle = run.battle;
    battle.ap = 20;
    battle.shield = 18;
    battle.absorb = 50;
    battle.pendingDiscard = 0;
    battle.enemyPhase = false;
    battle.completedEnemies = [];
    battle.actingEnemy = null;
    battle.discard = [];
    const enemy = structuredClone(battle.enemies[0]);
    enemy.hp = 999;
    enemy.maxHp = 999;
    enemy.shield = 0;
    enemy.statuses = { vulnerable: { stacks: 2, turns: 2 } };
    battle.enemies = [enemy];
    battle.selectedTarget = 0;
    battle.hand = [
      { id: "contact_glass_dropper_strike", level: 0 },
      { id: "contact_terracotta_crush", level: 0 },
      { id: "contact_crystal_guillotine", level: 0 },
      { id: "contact_blazing_wick_brand", level: 0 },
    ];
    const fallback = Object.keys(CARDS).filter((id) => id !== "impurity" && !battle.hand.some((c) => c.id === id));
    battle.draw = Array.from({ length: 12 }, (_, i) => ({ id: fallback[i % fallback.length], level: 0 }));
    E.attachEnemyAliases(battle);
    persistence.saveGame(storage, { meta, run }, 700000 + seed);
    return { hand: battle.hand.map((c) => c.id), enemyIntent: battle.enemies[0]?.intent };
  }, { seed, motion });
}

async function openBattle(context, seed, motion) {
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/`, { waitUntil: "domcontentloaded" });
  const fixture = await installFixture(page, seed, motion);
  await page.goto(GAME, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof document.querySelector("#tools-toggle")?.onclick === "function", null, { timeout: 15000 });
  const resume = page.locator('[data-action="resume"]');
  if (await resume.count()) await resume.click();
  await page.waitForSelector(".battle .hand", { timeout: 10000 });
  await page.waitForTimeout(180);
  return { page, fixture };
}

async function startProbe(page, label, maxFrames = 150) {
  await page.evaluate(({ label, maxFrames, selectors }) => {
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(3), y: +r.y.toFixed(3), w: +r.width.toFixed(3), h: +r.height.toFixed(3) };
    };
    window.__layoutProbe = { label, frames: [], done: false, actionFrame: null };
    let i = 0;
    const tick = (ts) => {
      const battle = document.querySelector(".battle"), notice = document.querySelector("#notice");
      const boxes = {};
      for (const [key, selector] of Object.entries(selectors)) boxes[key] = rect(selector);
      window.__layoutProbe.frames.push({
        i, ts: +ts.toFixed(3), boxes,
        noticeText: notice?.textContent?.trim() || "",
        noticeHeight: boxes.notice?.h ?? 0,
        battleClass: battle?.className || "",
        battleTransform: battle ? getComputedStyle(battle).transform : "",
      });
      i += 1;
      if (i < maxFrames) requestAnimationFrame(tick);
      else window.__layoutProbe.done = true;
    };
    requestAnimationFrame(tick);
  }, { label, maxFrames, selectors: SELECTORS });
  await page.waitForFunction(() => window.__layoutProbe?.frames?.length >= 6);
}

async function markAction(page) {
  await page.evaluate(() => { window.__layoutProbe.actionFrame = window.__layoutProbe.frames.length; });
}

async function collectProbe(page) {
  await page.waitForFunction(() => window.__layoutProbe?.done === true, null, { timeout: 7000 });
  return page.evaluate(() => structuredClone(window.__layoutProbe));
}

function d(a, b, field) { return (b?.[field] ?? 0) - (a?.[field] ?? 0); }
function moved(a, b) { return a && b && (Math.abs(d(a,b,"x")) > .45 || Math.abs(d(a,b,"y")) > .45 || Math.abs(d(a,b,"w")) > .45 || Math.abs(d(a,b,"h")) > .45); }

function classify(probe) {
  const frames = probe.frames;
  const base = frames[Math.max(0, (probe.actionFrame ?? 6) - 2)] || frames[0];
  let first = null;
  for (let i = Math.max(1, (probe.actionFrame ?? 6) - 1); i < frames.length; i++) {
    const f = frames[i], prev = frames[i - 1];
    const battleChanged = moved(base.boxes.battle, f.boxes.battle);
    const enemiesChanged = moved(base.boxes.enemiesField, f.boxes.enemiesField);
    const noticeChanged = Math.abs((f.noticeHeight ?? 0) - (base.noticeHeight ?? 0)) > .45;
    if (!(battleChanged || enemiesChanged || noticeChanged)) continue;
    const battleHeightSame = Math.abs(d(base.boxes.battle, f.boxes.battle, "h")) <= .45;
    const enemyHeightDown = d(base.boxes.enemiesField, f.boxes.enemiesField, "h") < -.45;
    const appHeightDown = d(base.boxes.app, f.boxes.app, "h") < -.45;
    const battleHeightDown = d(base.boxes.battle, f.boxes.battle, "h") < -.45;
    const transformActive = f.battleTransform && f.battleTransform !== "none";
    let verdict = "other";
    if (battleHeightSame && transformActive) verdict = "screen-shake";
    else if ((f.noticeHeight ?? 0) > (base.noticeHeight ?? 0) + .45 && (appHeightDown || battleHeightDown || enemyHeightDown)) verdict = "notice-layout-shift";
    else if (battleHeightSame && enemyHeightDown) verdict = "battle-internal-reflow";
    first = { i, verdict, baseIndex: base.i, battleHeightSame, transformActive };
    break;
  }
  if (!first) return { verdict: "stable", first: null, window: [] };
  const from = Math.max(0, first.i - 5), to = Math.min(frames.length, first.i + 6);
  return { verdict: first.verdict, first, window: frames.slice(from, to) };
}

async function performAction(page, action) {
  if (action === "end-turn") {
    await page.locator('[data-action="end"]').click();
    return;
  }
  const index = action === "card-use" ? 0 : action === "strong" ? 1 : action === "super" ? 2 : 3;
  const card = page.locator('.hand > .card[data-action="play"]').nth(index);
  assert.equal(await card.count(), 1, `${action}: card ${index} missing`);
  assert.equal(await card.getAttribute("aria-disabled"), null, `${action}: card disabled`);
  await card.click();
}

const server = spawn(process.execPath, ["scripts/serve.cjs"], { stdio: ["ignore", "ignore", "inherit"] });
try {
  await waitServer();
  const browser = await chromium.launch({ headless: true });
  const results = [];
  let seed = 9100;
  for (const mode of MODES) {
    const context = await browser.newContext({ viewport: { width: mode.width, height: mode.height }, reducedMotion: mode.motion === "reduce" ? "reduce" : "no-preference" });
    for (const action of ACTIONS) {
      for (let repeat = 1; repeat <= REPEATS; repeat++) {
        const { page, fixture } = await openBattle(context, seed++, mode.motion);
        const label = `${mode.name}/${action}/r${repeat}`;
        await startProbe(page, label);
        await markAction(page);
        await performAction(page, action);
        const probe = await collectProbe(page);
        const analysis = classify(probe);
        const row = { label, actionFrame: probe.actionFrame, fixture, verdict: analysis.verdict, first: analysis.first, window: analysis.window };
        results.push(row);
        console.log(`RESULT ${label} ${analysis.verdict} first=${analysis.first?.i ?? "none"}`);
        if (analysis.first) console.log(`FRAME_WINDOW ${label} ${JSON.stringify(analysis.window)}`);
        await page.close();
      }
    }
    await context.close();
  }
  await browser.close();
  const shifted = results.filter((r) => r.verdict !== "stable");
  console.log(`SUMMARY ${JSON.stringify({ total: results.length, shifted: shifted.length, byVerdict: Object.groupBy ? Object.fromEntries(Object.entries(Object.groupBy(results, r => r.verdict)).map(([k,v]) => [k,v.length])) : {}, firstShift: shifted[0]?.label || null })}`);
} finally {
  server.kill("SIGTERM");
}
