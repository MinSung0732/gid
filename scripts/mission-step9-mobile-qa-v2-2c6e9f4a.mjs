import { chromium } from "playwright";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const origin = "http://127.0.0.1:5173";
const gameUrl = `${origin}/games/harmony/?local=1`;
const mobileModes = [
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932, reducedMotion: "reduce" },
  { name: "844x390", width: 844, height: 390 },
  { name: "932x430", width: 932, height: 430 },
];
const pcModes = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1366x768", width: 1366, height: 768 },
];
const fixtures = [
  { enemies: 1, hand: 1 },
  { enemies: 2, hand: 4, interaction: true },
  { enemies: 3, hand: 7, overflow: true },
];

const box = async (locator) => {
  const value = await locator.boundingBox();
  return value && { ...value, right: value.x + value.width, bottom: value.y + value.height };
};

function assertInside(value, viewport, label) {
  assert.ok(value, `${label}: missing bounds`);
  assert.ok(value.x >= -1, `${label}: left clipped (${value.x})`);
  assert.ok(value.y >= -1, `${label}: top clipped (${value.y})`);
  assert.ok(value.right <= viewport.width + 1, `${label}: right clipped (${value.right}/${viewport.width})`);
  assert.ok(value.bottom <= viewport.height + 1, `${label}: bottom clipped (${value.bottom}/${viewport.height})`);
}

async function waitForApp(page) {
  await page.waitForFunction(() => typeof document.querySelector("#tools-toggle")?.onclick === "function", null, { timeout: 15000 });
}

async function installFixture(page, fixture, seed) {
  return page.evaluate(async ({ fixture, seed }) => {
    const E = await import("/games/harmony/engine.js");
    const { CARDS, ITEMS } = await import("/games/harmony/data.js");
    const persistence = await import("/games/harmony/persistence.js");
    const { createScopedStorage, GUEST_SCOPE } = await import("/games/harmony/scoped-storage.js");
    const storage = createScopedStorage(window.localStorage, GUEST_SCOPE);
    storage.clear();
    for (const key of Object.values(persistence.SAVE_KEYS)) window.localStorage.removeItem(key);
    window.localStorage.removeItem("harmony_cached_user_id");
    window.localStorage.setItem("harmony_combat_fx", "off");

    const meta = E.freshMeta();
    const run = E.newRun(seed);
    run.route[0] = "battle";
    E.enter(run, meta);
    run.hp = Math.min(run.maxHp, 67);
    run.gold = 123;
    run.potions = 2;

    const battle = run.battle;
    const enemyTemplate = structuredClone(battle.enemies[0]);
    const cardIds = Object.keys(CARDS).filter((id) => id !== "impurity");
    const playableId = CARDS.strike ? "strike" : cardIds[0];
    const itemIds = Object.values(ITEMS)
      .filter((item) => ["trait", "relic"].includes(item.kind) && !item.signatureOnly)
      .slice(0, 2)
      .map((item) => item.id);
    run.inventory = [...run.inventory, ...itemIds];

    battle.enemies = Array.from({ length: fixture.enemies }, (_, index) => ({
      ...structuredClone(enemyTemplate),
      name: `${enemyTemplate.name}${fixture.enemies > 1 ? ` ${index + 1}` : ""}`,
      hp: 999,
      maxHp: 999,
      shield: index === 1 ? 3 : 0,
      intent: { type: "guard", value: 0 },
      statuses: index === 0 ? { vulnerable: { stacks: 2, turns: 2 } } : {},
    }));
    battle.selectedTarget = 0;
    battle.ap = 10;
    battle.shield = 12;
    battle.absorb = 34;
    battle.pendingDiscard = 0;
    battle.enemyPhase = false;
    battle.completedEnemies = [];
    battle.actingEnemy = null;
    battle.discard = [];
    battle.hand = Array.from({ length: fixture.hand }, (_, index) => ({
      id: index === 0 ? playableId : cardIds[index % cardIds.length],
      level: 0,
    }));
    battle.draw = Array.from({ length: 9 }, (_, index) => ({
      id: cardIds[(fixture.hand + index + 5) % cardIds.length],
      level: 0,
    }));
    E.attachEnemyAliases(battle);

    const revision = persistence.saveGame(storage, { meta, run }, 500000 + seed);
    const loaded = persistence.loadGame(storage);
    return {
      phase: loaded.run?.phase,
      enemies: loaded.run?.battle?.enemies?.length,
      hand: loaded.run?.battle?.hand?.length,
      revision,
      scope: storage.scope,
    };
  }, { fixture, seed });
}

async function openBattle(context, fixture, seed) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  const installed = await installFixture(page, fixture, seed);
  assert.deepEqual(
    { phase: installed.phase, enemies: installed.enemies, hand: installed.hand, scope: installed.scope },
    { phase: "battle", enemies: fixture.enemies, hand: fixture.hand, scope: "guest" },
    `fixture installed incorrectly: ${JSON.stringify(installed)}`,
  );

  await page.goto(gameUrl, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const resume = page.locator('[data-action="resume"]');
  assert.equal(await resume.count(), 1, `production bootstrap did not expose saved run: ${JSON.stringify(installed)}`);
  await resume.click();
  await page.waitForSelector(".battle > .hand", { timeout: 10000 });
  await page.waitForTimeout(80);
  return { page, errors };
}

async function assertMobileLayout(page, mode, fixture) {
  const viewport = { width: mode.width, height: mode.height };
  const state = await page.evaluate(() => {
    const scroller = document.scrollingElement;
    const hand = document.querySelector(".battle > .hand");
    return {
      htmlActive: document.documentElement.classList.contains("mobile-battle-active"),
      bodyActive: document.body.classList.contains("mobile-battle-active"),
      bodyOverflow: getComputedStyle(document.body).overflow,
      scrollWidth: scroller.scrollWidth,
      scrollHeight: scroller.scrollHeight,
      routeNodes: document.querySelectorAll(".mobile-battle-route > span").length,
      mobileHudCount: document.querySelectorAll(".mobile-battle-hud").length,
      drawerCount: document.querySelectorAll("#mobile-info-drawer").length,
      statsCount: document.querySelectorAll(".player-stats").length,
      buildCount: document.querySelectorAll(".acquired-panel").length,
      panelsInDrawer: Boolean(document.querySelector("#mobile-info-drawer .player-stats") && document.querySelector("#mobile-info-drawer .acquired-panel")),
      desktopEnemyRails: document.querySelectorAll(".enemy-status-rail,.enemy-defense-rail").length,
      harmonyText: document.querySelector(".mobile-harmony-core")?.textContent || "",
      handScrollWidth: hand?.scrollWidth || 0,
      handClientWidth: hand?.clientWidth || 0,
    };
  });

  assert.equal(state.htmlActive, true, `${mode.name}: html mobile state`);
  assert.equal(state.bodyActive, true, `${mode.name}: body mobile state`);
  assert.equal(state.bodyOverflow, "hidden", `${mode.name}: body scroll lock`);
  assert.ok(state.scrollWidth <= viewport.width + 1, `${mode.name}: document horizontal scroll ${state.scrollWidth}/${viewport.width}`);
  assert.ok(state.scrollHeight <= viewport.height + 1, `${mode.name}: document vertical scroll ${state.scrollHeight}/${viewport.height}`);
  assert.equal(state.routeNodes, 12, `${mode.name}: 12-node route`);
  assert.equal(state.mobileHudCount, 1, `${mode.name}: compact HUD`);
  assert.equal(state.drawerCount, 1, `${mode.name}: one mobile drawer`);
  assert.equal(state.statsCount, 1, `${mode.name}: Player Stats DOM is not duplicated`);
  assert.equal(state.buildCount, 1, `${mode.name}: Build DOM is not duplicated`);
  assert.equal(state.panelsInDrawer, true, `${mode.name}: existing side panels moved into drawer`);
  assert.equal(state.desktopEnemyRails, 0, `${mode.name}: mobile Enemy uses original structure`);
  assert.match(state.harmonyText, /HARMONY/i, `${mode.name}: Harmony visible`);
  if (fixture.overflow)
    assert.ok(state.handScrollWidth > state.handClientWidth + 20, `${mode.name}: 7-card hand horizontally scrolls`);

  const locators = {
    hud: page.locator(".mobile-battle-hud"),
    route: page.locator(".mobile-battle-route"),
    head: page.locator(".battle-top"),
    turnOrder: page.locator(".turn-order"),
    enemies: page.locator(".enemies-field"),
    harmony: page.locator(".mobile-harmony-core"),
    resources: page.locator(".combat-stats"),
    hand: page.locator(".battle > .hand"),
    footer: page.locator(".turn-bar"),
    draw: page.locator(".draw-pile-chip"),
    discard: page.locator(".discard-pile-trigger"),
    endTurn: page.locator('[data-action="end"]'),
  };
  for (const [name, locator] of Object.entries(locators))
    assertInside(await box(locator), viewport, `${mode.name} ${name}`);

  assert.equal(await page.locator(".enemies-field > .enemy").count(), fixture.enemies, `${mode.name}: enemy ${fixture.enemies}`);
  for (let index = 0; index < fixture.enemies; index++) {
    const enemy = page.locator(".enemies-field > .enemy").nth(index);
    assertInside(await box(enemy), viewport, `${mode.name} enemy ${index + 1}`);
    assertInside(await box(enemy.locator(".intent")), viewport, `${mode.name} enemy ${index + 1} intent`);
    assertInside(await box(enemy.locator(".enemy-hp")), viewport, `${mode.name} enemy ${index + 1} hp`);
  }

  const cards = page.locator(".battle > .hand > .card");
  assert.equal(await cards.count(), fixture.hand, `${mode.name}: hand ${fixture.hand}`);
  const handBox = await box(page.locator(".battle > .hand"));
  for (let index = 0; index < fixture.hand; index++) {
    const cardBox = await box(cards.nth(index));
    assert.ok(cardBox.y >= handBox.y - 1 && cardBox.bottom <= handBox.bottom + 1, `${mode.name}: card ${index + 1} vertically clipped`);
    const minimum = mode.width > mode.height ? 130 : 145;
    assert.ok(cardBox.width >= minimum, `${mode.name}: card ${index + 1} over-shrunk (${cardBox.width})`);
  }
  const firstCard = await box(cards.first());
  assert.ok(firstCard.x < viewport.width && firstCard.right > 0, `${mode.name}: first card not visible`);

  assert.ok((await box(page.locator('[data-action="end"]'))).height >= 38, `${mode.name}: End Turn touch target`);
  assert.ok((await box(page.locator(".discard-pile-trigger"))).height >= 38, `${mode.name}: Discard touch target`);
  assert.ok((await box(page.locator(".enemy").first())).width >= 90, `${mode.name}: enemy target hit area`);
}

async function assertDrawerAndOverlays(page, mode) {
  const menuButton = page.locator("[data-mobile-menu]");
  await menuButton.click();
  const drawer = page.locator("#mobile-info-drawer");
  assert.equal(await drawer.isVisible(), true, `${mode}: drawer opens`);
  await page.locator('[data-mobile-drawer-tab="stats"]').click();
  assert.equal(await page.locator('[data-mobile-drawer-pane="stats"]').isVisible(), true, `${mode}: stats drawer pane`);
  await page.locator('[data-mobile-drawer-tab="build"]').click();
  assert.equal(await page.locator(".mobile-build-summary").isVisible(), true, `${mode}: Build Core drawer pane`);
  assert.equal(await page.locator("#mobile-info-drawer .acquired-panel").count(), 1, `${mode}: Traits/Relics reused`);
  await page.locator('[data-mobile-drawer-tab="menu"]').click();

  const openClose = async (action, dialog, close) => {
    await page.locator(`[data-mobile-open="${action}"]`).click();
    await page.locator(dialog).waitFor({ state: "visible", timeout: 5000 });
    assert.equal(await drawer.isVisible(), false, `${mode}: drawer yields to ${action}`);
    await page.locator(close).click();
    await page.locator(dialog).waitFor({ state: "hidden", timeout: 5000 });
    await menuButton.click();
    await page.locator('[data-mobile-drawer-tab="menu"]').click();
  };
  await openClose("deck", "#run-summary", "#run-summary-close");
  await openClose("log", "#battle-log", "#battle-log-close");
  await openClose("codex", "#tools", "#tools-close");
  await openClose("settings", "#settings", "#settings-close");

  await page.keyboard.press("Escape");
  assert.equal(await drawer.isVisible(), false, `${mode}: ESC closes drawer`);
  assert.equal(await menuButton.evaluate((node) => node === document.activeElement), true, `${mode}: drawer focus returns to Menu`);
}

async function assertTouchDetails(page, mode) {
  const resource = page.locator(".combat-stats > .combat-term:not(.mobile-harmony-core)").first();
  await resource.click();
  const expanded = await resource.getAttribute("aria-expanded");
  assert.ok(expanded === "true" || await resource.locator(".combat-term-detail").count(), `${mode}: resource detail works by tap/focus`);
  if (expanded === "true") await resource.click();

  const status = page.locator(".enemy .status-chip").first();
  if (await status.count()) {
    await status.click();
    const statusExpanded = await status.getAttribute("aria-expanded");
    assert.ok(statusExpanded === "true" || await status.locator(".status-detail").count(), `${mode}: status detail works by tap/focus`);
    if (statusExpanded === "true") await status.click();
  }

  const detailCard = page.locator(".battle > .hand > .card:has(.card-effect-tooltip)").first();
  if (await detailCard.count()) {
    await detailCard.focus();
    await page.waitForTimeout(50);
    assert.equal(await page.locator(".battle-card-effect-tooltip-portal").count(), 1, `${mode}: Card Summary portal opens on focus`);
    await page.locator('[data-action="end"]').focus();
    await page.waitForTimeout(50);
    assert.equal(await page.locator(".battle-card-effect-tooltip-portal").count(), 0, `${mode}: Card Summary portal cleans up`);
  }
}

async function assertInteraction(page, mode, expectedHand) {
  const secondEnemy = page.locator('.enemy[data-target="1"]');
  if (await secondEnemy.count()) {
    await secondEnemy.click();
    await page.waitForFunction(() => document.querySelector('.enemy[data-target="1"]')?.classList.contains("selected"), null, { timeout: 5000 });
  }

  const cardsBefore = await page.locator(".hand > .card").count();
  assert.equal(cardsBefore, expectedHand, `${mode}: interaction fixture hand`);
  const playable = page.locator('.hand > .card[data-action="play"]:not([aria-disabled="true"])').first();
  assert.equal(await playable.count(), 1, `${mode}: playable card exists`);
  await playable.click();
  await page.waitForFunction((before) => document.querySelectorAll(".hand > .card").length < before, cardsBefore, { timeout: 8000 });
  assert.ok(Number(await page.locator(".discard-pile-trigger b").textContent()) >= 1, `${mode}: card use updates discard`);

  const roundBefore = await page.locator(".battle-top .eyebrow").textContent();
  const end = page.locator('[data-action="end"]');
  assert.equal(await end.isEnabled(), true, `${mode}: End Turn enabled`);
  await end.click();
  await page.waitForFunction((previous) => {
    const text = document.querySelector(".battle-top .eyebrow")?.textContent || "";
    return document.querySelector(".battle")?.classList.contains("player-phase") && text !== previous;
  }, roundBefore, { timeout: 12000 });
  assert.match(await page.locator(".battle-top .eyebrow").textContent(), /ROUND\s+2/i, `${mode}: End Turn advances round`);
}

async function assertOrientation(page) {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(100);
  const landscape = await page.evaluate(() => ({
    active: document.body.classList.contains("mobile-battle-active"),
    columns: getComputedStyle(document.querySelector(".battle")).gridTemplateColumns,
    scrollHeight: document.scrollingElement.scrollHeight,
    innerHeight,
  }));
  assert.equal(landscape.active, true, "orientation: mobile state persists");
  assert.ok(landscape.columns.trim().split(/\s+/).length >= 2, `orientation: landscape composition (${landscape.columns})`);
  assert.ok(landscape.scrollHeight <= landscape.innerHeight + 1, "orientation: landscape document locked");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  const portrait = await page.locator(".battle").evaluate((node) => getComputedStyle(node).gridTemplateColumns);
  assert.ok(portrait.trim().split(/\s+/).length <= 1, `orientation: portrait composition restored (${portrait})`);
}

async function testMobile(browser) {
  let seed = 9400;
  for (const mode of mobileModes) {
    for (const fixture of fixtures) {
      const context = await browser.newContext({
        viewport: { width: mode.width, height: mode.height },
        reducedMotion: mode.reducedMotion || "no-preference",
      });
      try {
        const { page, errors } = await openBattle(context, fixture, seed++);
        await assertMobileLayout(page, mode, fixture);
        if (fixture.enemies === 1) {
          await assertDrawerAndOverlays(page, mode.name);
          await assertTouchDetails(page, mode.name);
          if (mode.name === "390x844") await assertOrientation(page);
          if (mode.reducedMotion === "reduce")
            assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true, `${mode.name}: reduced motion`);
        }
        if (fixture.interaction) await assertInteraction(page, mode.name, fixture.hand);
        assert.deepEqual(errors, [], `${mode.name}: browser errors\n${errors.join("\n")}`);
        console.log(`PASS MOBILE ${mode.name} enemy=${fixture.enemies} hand=${fixture.hand}${fixture.overflow ? " overflow" : ""}`);
      } finally {
        await context.close();
      }
    }
  }
}

async function testPc(browser) {
  let seed = 9900;
  for (const mode of pcModes) {
    const context = await browser.newContext({ viewport: { width: mode.width, height: mode.height } });
    try {
      const { page, errors } = await openBattle(context, { enemies: 3, hand: 7 }, seed++);
      const state = await page.evaluate(() => ({
        mobileActive: document.body.classList.contains("mobile-battle-active"),
        mobileHud: document.querySelectorAll(".mobile-battle-hud").length,
        drawer: document.querySelectorAll(".mobile-info-drawer").length,
        stage: document.body.classList.contains("harmony-stage-active"),
        directPanels: Boolean(document.querySelector(".play-layout > .player-stats") && document.querySelector(".play-layout > .acquired-panel")),
        enemyCardUi: document.querySelectorAll('.enemy[data-enemy-card-ui="1"]').length,
        harmony: document.querySelectorAll(".harmony-sequence-term").length,
      }));
      assert.equal(state.mobileActive, false, `${mode.name}: mobile composition inactive on PC`);
      assert.equal(state.mobileHud, 0, `${mode.name}: no mobile HUD on PC`);
      assert.equal(state.drawer, 0, `${mode.name}: no mobile drawer on PC`);
      assert.equal(state.stage, true, `${mode.name}: frozen PC stage active`);
      assert.equal(state.directPanels, true, `${mode.name}: frozen side panel DOM unchanged`);
      assert.ok(state.enemyCardUi >= 1, `${mode.name}: frozen Enemy Visual active`);
      assert.ok(state.harmony >= 1, `${mode.name}: frozen Harmony Core active`);
      const viewport = { width: mode.width, height: mode.height };
      for (const [label, locator] of Object.entries({ header: page.locator("body > header"), layout: page.locator(".play-layout"), battle: page.locator(".battle"), hand: page.locator(".hand") }))
        assertInside(await box(locator), viewport, `${mode.name} ${label}`);
      assert.deepEqual(errors, [], `${mode.name}: PC browser errors\n${errors.join("\n")}`);
      console.log(`PASS PC ${mode.name}`);
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
    console.log("PASS Project Harmony Step 9 Mobile Battle UX browser acceptance v2");
  } finally {
    await browser.close();
  }
} finally {
  server.kill("SIGTERM");
}
