import { chromium } from "playwright";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const baseUrl = "http://127.0.0.1:5173/games/harmony/?local=1";
const mobileModes = [
  { name: "390x844", viewport: { width: 390, height: 844 } },
  { name: "430x932", viewport: { width: 430, height: 932 }, reducedMotion: "reduce" },
  { name: "844x390", viewport: { width: 844, height: 390 } },
  { name: "932x430", viewport: { width: 932, height: 430 } },
];
const pcModes = [
  { name: "1440x900", viewport: { width: 1440, height: 900 } },
  { name: "1366x768", viewport: { width: 1366, height: 768 } },
];
const fixtureCases = [
  { enemies: 1, hand: 1 },
  { enemies: 2, hand: 4, interactions: true },
  { enemies: 3, hand: 7, overflow: true },
];

async function waitForAppReady(page) {
  await page.waitForFunction(() => typeof document.querySelector("#tools-toggle")?.onclick === "function", null, { timeout: 15000 });
}

async function installBattle(page, { enemies, hand }, seed) {
  return page.evaluate(async ({ enemies, hand, seed }) => {
    const E = await import("/games/harmony/engine.js");
    const { CARDS, ITEMS } = await import("/games/harmony/data.js");
    const persistence = await import("/games/harmony/persistence.js");
    const runtime = (await import("/games/harmony/browser-runtime.js")).createBrowserRuntime().getHarmonyRuntime();
    const storage = runtime.storage;
    const meta = E.freshMeta();
    const run = E.newRun(seed);
    run.route[0] = "battle";
    E.enter(run, meta);
    run.hp = Math.max(1, Math.min(run.maxHp, 67));
    run.gold = 123;
    run.potions = 2;
    run.statuses = { resonance: { stacks: 2 } };

    const b = run.battle,
      template = structuredClone(b.enemies[0]),
      cardIds = Object.keys(CARDS).filter((id) => id !== "impurity"),
      firstCardId = CARDS.strike ? "strike" : cardIds[0],
      itemIds = Object.values(ITEMS)
        .filter((item) => ["trait", "relic"].includes(item.kind) && !item.signatureOnly)
        .slice(0, 2)
        .map((item) => item.id);

    run.inventory = [...run.inventory, ...itemIds];
    b.enemies = Array.from({ length: enemies }, (_, index) => {
      const enemy = structuredClone(template);
      enemy.name = `${template.name}${enemies > 1 ? ` ${index + 1}` : ""}`;
      enemy.hp = 999;
      enemy.maxHp = 999;
      enemy.shield = index === 1 ? 3 : 0;
      enemy.intent = { type: "guard", value: 0 };
      enemy.statuses = index === 0 ? { vulnerable: { stacks: 2 } } : {};
      return enemy;
    });
    b.selectedTarget = 0;
    b.ap = 10;
    b.shield = 12;
    b.absorb = 34;
    b.notes = [{ note: "top" }, { note: "middle" }];
    b.pendingDiscard = 0;
    b.enemyPhase = false;
    b.completedEnemies = [];
    b.actingEnemy = null;
    b.discard = [];
    b.hand = Array.from({ length: hand }, (_, index) => ({
      id: index === 0 ? firstCardId : cardIds[index % cardIds.length],
      level: 0,
    }));
    b.draw = Array.from({ length: 8 }, (_, index) => ({ id: cardIds[(index + hand + 3) % cardIds.length], level: 0 }));
    E.attachEnemyAliases(b);

    storage.clear();
    for (const key of Object.values(persistence.SAVE_KEYS)) window.localStorage.removeItem(key);
    window.localStorage.setItem("harmony_combat_fx", "off");
    persistence.saveGame(storage, { meta, run }, 200000 + seed);
    const loaded = persistence.loadGame(storage);
    return {
      hand: loaded.run?.battle?.hand?.length,
      enemies: loaded.run?.battle?.enemies?.length,
      phase: loaded.run?.phase,
    };
  }, { enemies, hand, seed });
}

async function openInstalledBattle(context, fixture, seed) {
  const installer = await context.newPage();
  await installer.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await waitForAppReady(installer);
  const installed = await installBattle(installer, fixture, seed);
  await installer.close();

  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(`console: ${message.text()}`);
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await waitForAppReady(page);
  const resume = page.locator('[data-action="resume"]');
  assert.equal(await resume.count(), 1, `resume missing for fixture ${JSON.stringify(installed)}`);
  await resume.click();
  await page.waitForSelector(".battle .hand", { timeout: 10000 });
  await page.waitForTimeout(80);
  return { page, installed, pageErrors };
}

function inside(box, viewport, label) {
  assert.ok(box, `${label}: missing bounds`);
  assert.ok(box.x >= -1, `${label}: left clipped ${box.x}`);
  assert.ok(box.y >= -1, `${label}: top clipped ${box.y}`);
  assert.ok(box.x + box.width <= viewport.width + 1, `${label}: right clipped ${box.x + box.width}/${viewport.width}`);
  assert.ok(box.y + box.height <= viewport.height + 1, `${label}: bottom clipped ${box.y + box.height}/${viewport.height}`);
}

async function mobileGeometry(page, mode, fixture) {
  const state = await page.evaluate(() => {
    const box = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const cards = [...document.querySelectorAll(".battle > .hand > .card")].map((node) => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    });
    const enemies = [...document.querySelectorAll(".enemies-field > .enemy")].map((node) => {
      const r = node.getBoundingClientRect(), intent = node.querySelector(".intent")?.getBoundingClientRect(), hp = node.querySelector(".enemy-hp")?.getBoundingClientRect();
      return {
        box: { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom },
        intent: intent ? { x: intent.x, y: intent.y, width: intent.width, height: intent.height, right: intent.right, bottom: intent.bottom } : null,
        hp: hp ? { x: hp.x, y: hp.y, width: hp.width, height: hp.height, right: hp.right, bottom: hp.bottom } : null,
      };
    });
    const scroller = document.scrollingElement;
    return {
      inner: { width: innerWidth, height: innerHeight },
      htmlActive: document.documentElement.classList.contains("mobile-battle-active"),
      bodyActive: document.body.classList.contains("mobile-battle-active"),
      bodyOverflow: getComputedStyle(document.body).overflow,
      pageScroll: { width: scroller.scrollWidth, height: scroller.scrollHeight },
      hud: box(".mobile-battle-hud"),
      route: box(".mobile-battle-route"),
      top: box(".battle-top"),
      turn: box(".turn-order"),
      field: box(".enemies-field"),
      harmony: box(".mobile-harmony-core"),
      ap: box(".combat-stats > .combat-term:not(.mobile-harmony-core):nth-child(1)"),
      stats: box(".combat-stats"),
      hand: box(".battle > .hand"),
      handScrollWidth: document.querySelector(".battle > .hand")?.scrollWidth || 0,
      handClientWidth: document.querySelector(".battle > .hand")?.clientWidth || 0,
      footer: box(".turn-bar"),
      draw: box(".draw-pile-chip"),
      discard: box(".discard-pile-trigger"),
      end: box('[data-action="end"]'),
      cards,
      enemies,
      enemyRails: document.querySelectorAll(".enemy-status-rail,.enemy-defense-rail").length,
      playerStatsCount: document.querySelectorAll(".player-stats").length,
      acquiredCount: document.querySelectorAll(".acquired-panel").length,
      panelsInDrawer: Boolean(document.querySelector("#mobile-info-drawer .player-stats") && document.querySelector("#mobile-info-drawer .acquired-panel")),
      harmonyText: document.querySelector(".mobile-harmony-core")?.textContent || "",
      routeNodes: document.querySelectorAll(".mobile-battle-route > span").length,
      visibleStatus: document.querySelectorAll(".enemy .status-chip, .player-effects-battle .status-chip").length,
    };
  });

  const viewport = state.inner;
  assert.equal(state.htmlActive, true, `${mode} mobile html class`);
  assert.equal(state.bodyActive, true, `${mode} mobile body class`);
  assert.equal(state.bodyOverflow, "hidden", `${mode} body scroll locked`);
  assert.ok(state.pageScroll.height <= viewport.height + 1, `${mode} document height ${state.pageScroll.height}/${viewport.height}`);
  assert.ok(state.pageScroll.width <= viewport.width + 1, `${mode} document width ${state.pageScroll.width}/${viewport.width}`);
  assert.equal(state.routeNodes, 12, `${mode} compact route has 12 nodes`);
  assert.equal(state.enemyRails, 0, `${mode} enemy keeps original mobile DOM structure`);
  assert.equal(state.playerStatsCount, 1, `${mode} exactly one Player Stats DOM`);
  assert.equal(state.acquiredCount, 1, `${mode} exactly one Build DOM`);
  assert.equal(state.panelsInDrawer, true, `${mode} existing side panels are moved into drawer`);
  assert.ok(state.harmonyText.includes("HARMONY") && state.harmonyText.includes("BASE"), `${mode} Harmony is visible and reflects NEXT BASE`);
  assert.ok(state.visibleStatus >= 1, `${mode} status UI remains present`);

  for (const [name, box] of Object.entries({ hud: state.hud, route: state.route, battleHead: state.top, turnOrder: state.turn, enemyField: state.field, harmony: state.harmony, resources: state.stats, hand: state.hand, footer: state.footer, draw: state.draw, discard: state.discard, endTurn: state.end }))
    inside(box, viewport, `${mode} ${name}`);

  assert.equal(state.cards.length, fixture.hand, `${mode} hand count ${fixture.hand}`);
  assert.equal(state.enemies.length, fixture.enemies, `${mode} enemy count ${fixture.enemies}`);
  state.enemies.forEach((enemy, index) => {
    inside(enemy.box, viewport, `${mode} enemy ${index + 1}`);
    inside(enemy.intent, viewport, `${mode} enemy ${index + 1} intent`);
    inside(enemy.hp, viewport, `${mode} enemy ${index + 1} hp`);
  });
  state.cards.forEach((card, index) => {
    assert.ok(card.y >= state.hand.y - 1 && card.bottom <= state.hand.bottom + 1, `${mode} hand card ${index + 1} vertically clipped`);
    const minWidth = viewport.width > viewport.height ? 130 : 145;
    assert.ok(card.width >= minWidth, `${mode} card ${index + 1} over-shrunk: ${card.width}`);
  });
  if (fixture.overflow) assert.ok(state.handScrollWidth > state.handClientWidth + 20, `${mode} 7-card hand must horizontally overflow`);
  assert.ok(state.end.height >= 38, `${mode} End Turn touch height`);
  assert.ok(state.discard.height >= 38, `${mode} Discard touch height`);

  return state;
}

async function testDrawerAndOverlays(page, mode) {
  await page.locator("[data-mobile-menu]").click();
  const drawer = page.locator("#mobile-info-drawer");
  assert.equal(await drawer.isVisible(), true, `${mode} info drawer opens`);
  assert.equal(await page.locator("#mobile-info-drawer .player-stats").count(), 1, `${mode} drawer reuses Player Stats`);
  assert.equal(await page.locator("#mobile-info-drawer .acquired-panel").count(), 1, `${mode} drawer reuses Build panel`);

  await page.locator('[data-mobile-drawer-tab="stats"]').click();
  assert.equal(await page.locator('[data-mobile-drawer-pane="stats"]').isVisible(), true, `${mode} stats pane visible`);
  await page.locator('[data-mobile-drawer-tab="build"]').click();
  assert.equal(await page.locator(".mobile-build-summary").isVisible(), true, `${mode} Build Core summary visible`);
  await page.locator('[data-mobile-drawer-tab="menu"]').click();

  const openAndClose = async (action, dialogSelector, closeSelector) => {
    await page.locator(`[data-mobile-open="${action}"]`).click();
    const dialog = page.locator(dialogSelector);
    await dialog.waitFor({ state: "visible", timeout: 5000 });
    assert.equal(await drawer.isVisible(), false, `${mode} drawer closes before ${action} overlay`);
    await page.locator(closeSelector).click();
    await dialog.waitFor({ state: "hidden", timeout: 5000 });
    await page.locator("[data-mobile-menu]").click();
    await page.locator('[data-mobile-drawer-tab="menu"]').click();
  };

  await openAndClose("deck", "#run-summary", "#run-summary-close");
  await openAndClose("log", "#battle-log", "#battle-log-close");
  await openAndClose("codex", "#tools", "#tools-close");
  await openAndClose("settings", "#settings", "#settings-close");
  await page.locator("[data-mobile-drawer-close]").last().click();
  assert.equal(await drawer.isVisible(), false, `${mode} info drawer closes`);
}

async function testTouchDetails(page, mode) {
  const term = page.locator(".combat-stats > .combat-term:not(.mobile-harmony-core)").first();
  await term.click();
  assert.equal(await term.getAttribute("aria-expanded"), "true", `${mode} resource detail opens on tap`);
  await term.click();

  const status = page.locator(".enemy .status-chip").first();
  if (await status.count()) {
    await status.click();
    assert.equal(await status.getAttribute("aria-expanded"), "true", `${mode} status detail opens on tap`);
    await status.click();
  }

  const cardWithDetail = page.locator(".hand .card:has(.card-effect-tooltip)").first();
  if (await cardWithDetail.count()) {
    await cardWithDetail.focus();
    await page.waitForTimeout(30);
    assert.equal(await page.locator(".battle-card-effect-tooltip-portal").count(), 1, `${mode} card detail portal opens on focus`);
    await page.locator('[data-action="end"]').focus();
    await page.waitForTimeout(30);
    assert.equal(await page.locator(".battle-card-effect-tooltip-portal").count(), 0, `${mode} card detail portal cleans up on focus leave`);
  }
}

async function testInteractions(page, mode, expectedHand) {
  if (await page.locator('.enemy[data-target="1"]').count()) {
    await page.locator('.enemy[data-target="1"]').click();
    await page.waitForFunction(() => document.querySelector('.enemy[data-target="1"]')?.classList.contains("selected"), null, { timeout: 5000 });
  }

  const before = await page.locator(".hand .card").count(),
    playable = page.locator('.hand .card[data-action="play"]:not([aria-disabled="true"])').first();
  assert.ok(before === expectedHand && await playable.count(), `${mode} playable card fixture`);
  await playable.click();
  await page.waitForFunction((count) => document.querySelectorAll(".hand .card").length < count, before, { timeout: 8000 });
  const afterPlay = await page.locator(".hand .card").count();
  assert.ok(afterPlay < before, `${mode} card use consumes a hand card`);
  assert.ok(Number(await page.locator(".discard-pile-trigger b").textContent()) >= 1, `${mode} discard pile updates after card use`);

  const end = page.locator('[data-action="end"]');
  assert.equal(await end.isEnabled(), true, `${mode} End Turn remains accessible`);
  const roundBefore = await page.locator(".battle-top .eyebrow").textContent();
  await end.click();
  await page.waitForFunction((previous) => {
    const battle = document.querySelector(".battle"), text = document.querySelector(".battle-top .eyebrow")?.textContent || "";
    return battle?.classList.contains("player-phase") && text !== previous;
  }, roundBefore, { timeout: 12000 });
  assert.match(await page.locator(".battle-top .eyebrow").textContent(), /ROUND\s+2/, `${mode} End Turn advances round`);
  inside(await page.locator(".draw-pile-chip").boundingBox(), page.viewportSize(), `${mode} draw after End Turn`);
  inside(await page.locator(".discard-pile-trigger").boundingBox(), page.viewportSize(), `${mode} discard after End Turn`);
}

async function testOrientation(page, mode) {
  if (mode !== "390x844") return;
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(100);
  const landscape = await page.evaluate(() => ({
    active: document.body.classList.contains("mobile-battle-active"),
    columns: getComputedStyle(document.querySelector(".battle")).gridTemplateColumns,
    scrollHeight: document.scrollingElement.scrollHeight,
    innerHeight,
  }));
  assert.equal(landscape.active, true, "orientation: mobile battle stays active in landscape");
  assert.ok(landscape.columns.split(" ").length >= 2, `orientation: landscape has side-by-side composition (${landscape.columns})`);
  assert.ok(landscape.scrollHeight <= landscape.innerHeight + 1, "orientation: landscape document stays locked");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  const portraitColumns = await page.locator(".battle").evaluate((node) => getComputedStyle(node).gridTemplateColumns);
  assert.ok(portraitColumns.split(" ").length <= 1, `orientation: portrait returns to single-column battle (${portraitColumns})`);
}

async function testMobile(browser) {
  let seed = 9300;
  for (const mode of mobileModes) {
    for (const fixture of fixtureCases) {
      const context = await browser.newContext({ viewport: mode.viewport, reducedMotion: mode.reducedMotion || "no-preference" });
      try {
        const { page, pageErrors } = await openInstalledBattle(context, fixture, seed++);
        await mobileGeometry(page, mode.name, fixture);
        if (fixture.enemies === 1) {
          await testDrawerAndOverlays(page, mode.name);
          await testTouchDetails(page, mode.name);
          await testOrientation(page, mode.name);
          if (mode.reducedMotion === "reduce")
            assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true, `${mode.name} reduced motion active`);
        }
        if (fixture.interactions) await testInteractions(page, mode.name, fixture.hand);
        assert.deepEqual(pageErrors, [], `${mode.name} browser errors: ${pageErrors.join("\n")}`);
        console.log(`PASS MOBILE ${mode.name} enemies=${fixture.enemies} hand=${fixture.hand}${fixture.overflow ? " overflow" : ""}`);
      } finally {
        await context.close();
      }
    }
  }
}

async function testPc(browser) {
  let seed = 9800;
  for (const mode of pcModes) {
    const context = await browser.newContext({ viewport: mode.viewport });
    try {
      const { page, pageErrors } = await openInstalledBattle(context, { enemies: 3, hand: 7 }, seed++);
      const state = await page.evaluate(() => {
        const box = (selector) => {
          const r = document.querySelector(selector)?.getBoundingClientRect();
          return r ? { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom } : null;
        };
        return {
          mobileClass: document.body.classList.contains("mobile-battle-active"),
          mobileHud: document.querySelectorAll(".mobile-battle-hud").length,
          drawer: document.querySelectorAll(".mobile-info-drawer").length,
          header: box("body > header"),
          layout: box(".play-layout"),
          battle: box(".battle"),
          hand: box(".hand"),
          enemyRails: document.querySelectorAll('.enemy[data-enemy-card-ui="1"]').length,
          harmonyCore: document.querySelectorAll(".harmony-sequence-term").length,
          stageActive: document.body.classList.contains("harmony-stage-active"),
          sidePanelsDirect: Boolean(document.querySelector(".play-layout > .player-stats") && document.querySelector(".play-layout > .acquired-panel")),
        };
      });
      assert.equal(state.mobileClass, false, `${mode.name} PC must not activate mobile composition`);
      assert.equal(state.mobileHud, 0, `${mode.name} PC no mobile HUD`);
      assert.equal(state.drawer, 0, `${mode.name} PC no mobile drawer`);
      assert.equal(state.stageActive, true, `${mode.name} frozen PC stage remains active`);
      assert.equal(state.sidePanelsDirect, true, `${mode.name} PC side panel structure unchanged`);
      assert.ok(state.enemyRails >= 1, `${mode.name} desktop Enemy Visual presentation remains active`);
      assert.ok(state.harmonyCore >= 1, `${mode.name} desktop Harmony Core remains active`);
      for (const [name, box] of Object.entries({ header: state.header, layout: state.layout, battle: state.battle, hand: state.hand }))
        inside(box, mode.viewport, `${mode.name} PC ${name}`);
      assert.deepEqual(pageErrors, [], `${mode.name} PC browser errors: ${pageErrors.join("\n")}`);
      console.log(`PASS PC REGRESSION ${mode.name}`);
    } finally {
      await context.close();
    }
  }
}

const server = spawn(process.execPath, ["scripts/serve.cjs"], { stdio: ["ignore", "pipe", "pipe"] });
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server timeout")), 10000);
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes("127.0.0.1:5173")) { clearTimeout(timer); resolve(); }
    });
    server.once("exit", (code) => reject(new Error(`server exited ${code}`)));
  });
  const browser = await chromium.launch({ headless: true });
  try {
    await testMobile(browser);
    await testPc(browser);
    console.log("PASS Project Harmony Step 9 Mobile Battle UX browser acceptance");
  } finally {
    await browser.close();
  }
} finally {
  server.kill("SIGTERM");
}
