import { chromium } from "playwright";

const BASE = "http://127.0.0.1:5173/games/harmony/";
const assert = (value, message) => { if (!value) throw new Error(message); };
const results = { pc: [], inventoryData: null, scenarios: [], mobile: [] };

async function startRun(page) {
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
}

async function enterBattle(page) {
  const enter = page.locator('.room [data-action="enter"]');
  await enter.waitFor({ state: "visible" });
  await enter.click();
  await page.locator(".battle").waitFor({ state: "visible" });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const run = window.HarmonyCurrentRenderRun;
    if (run) {
      run.maxHp = Math.max(Number(run.maxHp) || 0, 999);
      run.hp = 999;
    }
  });
}

async function nextPlayerTurn(page) {
  const before = await page.locator(".battle .eyebrow").textContent();
  const round = Number(before?.match(/ROUND\s+(\d+)/)?.[1] || 0);
  const button = page.locator('.battle [data-action="end"]');
  await button.waitFor({ state: "visible" });
  assert(!(await button.isDisabled()), "end turn disabled");
  await button.click();
  await page.waitForFunction((round) => {
    const text = document.querySelector(".battle .eyebrow")?.textContent || "";
    const next = Number(text.match(/ROUND\s+(\d+)/)?.[1] || 0);
    return next > round && document.querySelector(".battle")?.classList.contains("player-phase");
  }, round, { timeout: 45000 });
  await page.waitForTimeout(900);
  return {
    before,
    after: await page.locator(".battle .eyebrow").textContent(),
  };
}

async function pcPanelSnapshot(page) {
  return await page.evaluate(async () => {
    const E = await import("./engine.js");
    const run = window.HarmonyCurrentRenderRun;
    const rows = [...document.querySelectorAll(".player-core-stats .player-core-stat")].map((row) => ({
      label: row.querySelector(":scope > span")?.textContent?.trim() || "",
      value: row.querySelector(":scope > b")?.textContent?.trim() || "",
      labelClipped: (row.querySelector(":scope > span")?.scrollWidth || 0) > (row.querySelector(":scope > span")?.clientWidth || 0) + 1,
    }));
    const button = document.querySelector(".player-run-summary");
    const title = button?.querySelector(":scope > strong");
    const sub = button?.querySelector(":scope > small");
    const stats = document.querySelector(".player-core-stats")?.getBoundingClientRect();
    const status = document.querySelector(".player-core-status")?.getBoundingClientRect();
    const summary = button?.getBoundingClientRect();
    const panel = document.querySelector(".player-core-panel")?.getBoundingClientRect();
    return {
      rows,
      handLimit: E.handLimit(run),
      deckLength: run.deck.length,
      deckLimit: E.deckLimit(run),
      inventoryLength: run.inventory.length,
      augmentCount: run.deck.length + run.inventory.length,
      title: title?.textContent?.trim() || "",
      subtitle: sub?.textContent?.trim() || "",
      titleClipped: title ? title.scrollWidth > title.clientWidth + 1 : true,
      subtitleClipped: sub ? sub.scrollWidth > sub.clientWidth + 1 : true,
      layout: stats && status && summary && panel ? {
        statsBottom: stats.bottom,
        statusTop: status.top,
        statusBottom: status.bottom,
        summaryTop: summary.top,
        summaryBottom: summary.bottom,
        panelBottom: panel.bottom,
      } : null,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}

async function openSummary(page) {
  const dialog = page.locator("#run-summary");
  if (await dialog.evaluate((el) => el.open)) return;
  await page.locator(".player-run-summary").click();
  await page.waitForFunction(() => document.querySelector("#run-summary")?.open === true);
  await page.waitForTimeout(80);
}

async function closeSummary(page) {
  const dialog = page.locator("#run-summary");
  if (!(await dialog.evaluate((el) => el.open))) return;
  await page.locator("#run-summary-close").click();
  await page.waitForFunction(() => document.querySelector("#run-summary")?.open === false);
}

async function setScenario(page, spec) {
  await closeSummary(page);
  await page.evaluate(async (spec) => {
    const { CARDS, ITEMS } = await import("./data.js?v=20260918-3");
    const run = window.HarmonyCurrentRenderRun;
    const regular = Object.keys(CARDS).filter((id) => id !== "impurity");
    const itemIds = Object.keys(ITEMS).filter((id) => !ITEMS[id]?.hidden);
    const regularCount = Math.max(1, Number(spec.regularCount) || 1);
    const impurityCount = Math.max(0, Number(spec.impurityCount) || 0);
    const itemCount = Math.max(0, Number(spec.itemCount) || 0);
    run.deck = Array.from({ length: regularCount }, (_, index) => ({
      id: regular[index % regular.length],
      level: index % 2,
    }));
    for (let index = 0; index < impurityCount; index += 1)
      run.deck.push({ id: "impurity", level: 0 });
    run.inventory = Array.from({ length: itemCount }, (_, index) => itemIds[index % itemIds.length]);
  }, spec);
  await openSummary(page);
  return await page.evaluate((name) => {
    const shell = document.querySelector("#run-deck-list");
    const list = shell?.querySelector(".summary-deck-list");
    const entries = [...(list?.querySelectorAll(".summary-deck-entry") || [])];
    const itemGrid = document.querySelector("#run-item-list");
    const itemChildren = [...(itemGrid?.children || [])].filter((node) => node.nodeType === Node.ELEMENT_NODE);
    const rect = (element) => {
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height };
    };
    const listRect = rect(list);
    const entryRects = entries.map((entry) => rect(entry.querySelector(":scope > button") || entry));
    const itemGridRect = rect(itemGrid);
    const itemRects = itemChildren.map(rect);
    const pairOverlaps = (rects) => {
      let overlaps = 0;
      for (let i = 0; i < rects.length; i += 1) {
        for (let j = i + 1; j < rects.length; j += 1) {
          const a = rects[i], b = rects[j];
          if (!a || !b) continue;
          const horizontal = Math.min(a.right,b.right) - Math.max(a.left,b.left);
          const vertical = Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top);
          if (horizontal > 1 && vertical > 1) overlaps += 1;
        }
      }
      return overlaps;
    };
    const outside = (r, parent) => Boolean(r && parent && (r.left < parent.left - 1 || r.right > parent.right + 1));
    const run = window.HarmonyCurrentRenderRun;
    const impurityEntry = entries.find((entry) => /불순물/.test(entry.textContent || ""));
    return {
      name,
      deckLength: run.deck.length,
      inventoryLength: run.inventory.length,
      impurityCount: run.deck.filter((card) => card.id === "impurity").length,
      shellClass: shell?.className || "",
      listDisplay: list ? getComputedStyle(list).display : "",
      listDirection: list ? getComputedStyle(list).flexDirection : "",
      listOverflowX: list ? getComputedStyle(list).overflowX : "",
      listOverflowY: list ? getComputedStyle(list).overflowY : "",
      listHorizontalOverflow: list ? list.scrollWidth - list.clientWidth : 0,
      listVerticalOverflow: list ? list.scrollHeight - list.clientHeight : 0,
      entryCount: entries.length,
      entryPairOverlaps: pairOverlaps(entryRects),
      entryOutside: entryRects.some((r) => outside(r,listRect)),
      minEntryWidth: entryRects.length ? Math.min(...entryRects.map((r) => r.width)) : 0,
      maxEntryWidth: entryRects.length ? Math.max(...entryRects.map((r) => r.width)) : 0,
      impurityText: impurityEntry?.textContent?.replace(/\s+/g," ").trim() || "",
      itemGridDisplay: itemGrid ? getComputedStyle(itemGrid).display : "",
      itemGridColumns: itemGrid ? getComputedStyle(itemGrid).gridTemplateColumns : "",
      itemGridOverflowX: itemGrid ? getComputedStyle(itemGrid).overflowX : "",
      itemGridOverflowY: itemGrid ? getComputedStyle(itemGrid).overflowY : "",
      itemHorizontalOverflow: itemGrid ? itemGrid.scrollWidth - itemGrid.clientWidth : 0,
      itemVerticalOverflow: itemGrid ? itemGrid.scrollHeight - itemGrid.clientHeight : 0,
      itemCount: itemChildren.length,
      itemPairOverlaps: pairOverlaps(itemRects),
      itemOutside: itemRects.some((r) => outside(r,itemGridRect)),
      bodyOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  }, spec.name);
}

function validateScenario(state) {
  assert(state.listDisplay === "flex", state.name + ": current deck renderer should remain flex");
  assert(state.listDirection === "column", state.name + ": deck entries should remain a vertical list");
  assert(state.listHorizontalOverflow <= 2, state.name + ": deck list horizontal overflow");
  assert(state.entryPairOverlaps === 0, state.name + ": deck entries overlap");
  assert(!state.entryOutside, state.name + ": deck entry escaped container");
  assert(state.minEntryWidth > 200, state.name + ": deck entry width collapsed");
  assert(state.maxEntryWidth - state.minEntryWidth <= 2, state.name + ": inconsistent deck entry width");
  assert(state.itemGridDisplay === "grid", state.name + ": item inventory grid no longer grid");
  assert(state.itemHorizontalOverflow <= 2, state.name + ": item grid horizontal overflow");
  assert(state.itemPairOverlaps === 0, state.name + ": item cards overlap");
  assert(!state.itemOutside, state.name + ": item escaped grid");
  assert(state.bodyOverflow <= 2, state.name + ": body horizontal overflow");
  if (state.impurityCount > 0)
    assert(state.impurityText.includes("불순물") && state.impurityText.includes("총 " + state.impurityCount + "장"), state.name + ": impurity group count mismatch");
  else
    assert(!state.impurityText, state.name + ": stale impurity entry remained");
}

const browser = await chromium.launch({ headless:true });
try {
  for (const viewport of [{width:1440,height:900},{width:1366,height:768}]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("dialog", (d) => d.accept().catch(() => {}));
    await startRun(page);

    const initial = await pcPanelSnapshot(page);
    assert(JSON.stringify(initial.rows.map((row) => row.label)) === JSON.stringify([
      "공격력","방어력","AP 기본 / 상한","손패 한도","최대 덱 한도","첫 턴 패","턴 드로우"
    ]), "PC stat order mismatch: " + JSON.stringify(initial.rows));
    assert(initial.rows[3].value === String(initial.handLimit) + "장", "hand limit regressed");
    assert(initial.rows[4].value === initial.deckLength + " / " + initial.deckLimit + "장", "deck limit display mismatch");
    assert(initial.title === "인벤토리", "inventory title mismatch");
    assert(initial.subtitle === "증강카드 " + initial.augmentCount + "장", "augment count mismatch");
    assert(!initial.titleClipped && !initial.subtitleClipped, "inventory header clipped");
    assert(!initial.rows[4].labelClipped, "deck limit label clipped");
    assert(initial.overflow <= 2, "PC body overflow");
    assert(initial.layout && initial.layout.statsBottom <= initial.layout.statusTop + 1, "stats/status overlap");
    assert(initial.layout.statusBottom <= initial.layout.summaryTop + 1, "status/inventory summary overlap");
    assert(initial.layout.summaryBottom <= initial.layout.panelBottom + 1, "inventory summary escaped panel");

    const deckRow = page.locator('.player-core-stat[data-player-help-title="최대 덱 한도"]');
    await deckRow.hover();
    const tooltip = page.locator(".player-status-tooltip:not([hidden])");
    await tooltip.waitFor({ state:"visible", timeout:3000 });
    const tooltipText = (await tooltip.textContent())?.trim() || "";
    assert(tooltipText.includes("최대 덱 한도") && tooltipText.includes("현재 덱"), "deck limit tooltip missing");

    const dataInfo = await page.evaluate(async () => {
      const E = await import("./engine.js");
      const { ITEMS } = await import("./data.js?v=20260918-3");
      const run = window.HarmonyCurrentRenderRun;
      const ids = [
        "stat_sharp_pipette_tip",
        "stat_sharp_pipette_tip",
        "trait_overlapping_petals",
        "relic_scented_paperweight",
        "curse_dull_edge",
      ];
      const beforeLimit = E.deckLimit(run);
      const added = ids.map((id) => ({ id, ok:E.addInventoryItem(run,id), kind:ITEMS[id]?.kind || null }));
      return {
        beforeLimit,
        afterLimit:E.deckLimit(run),
        inventoryLength:run.inventory.length,
        deckLength:run.deck.length,
        added,
      };
    });
    assert(dataInfo.added.every((entry) => entry.ok), "failed to add inventory test entries: " + JSON.stringify(dataInfo));
    assert(dataInfo.afterLimit === dataInfo.beforeLimit + 2, "deckSize relic did not change engine deckLimit");
    assert(dataInfo.added.map((entry) => entry.kind).join(",") === "stat,stat,trait,relic,curse", "inventory kind classification mismatch");

    await enterBattle(page);
    const afterItems = await pcPanelSnapshot(page);
    assert(afterItems.rows[3].value === String(afterItems.handLimit) + "장", "hand limit changed unexpectedly");
    assert(afterItems.rows[4].value === afterItems.deckLength + " / " + afterItems.deckLimit + "장", "dynamic deck limit did not rerender");
    assert(afterItems.deckLimit === initial.deckLimit + 2, "dynamic deck limit UI source mismatch");
    assert(afterItems.subtitle === "증강카드 " + (afterItems.deckLength + afterItems.inventoryLength) + "장", "inventory total excludes an owned entry");

    const turn = await nextPlayerTurn(page);
    assert(/PLAYER PHASE/.test(turn.after || ""), "turn did not return to player phase");

    const beforeImpurityCount = await pcPanelSnapshot(page);
    await page.evaluate(() => window.HarmonyCurrentRenderRun.deck.push({id:"impurity",level:0}));
    await nextPlayerTurn(page);
    const withImpurity = await pcPanelSnapshot(page);
    assert(withImpurity.subtitle === "증강카드 " + (withImpurity.deckLength + withImpurity.inventoryLength) + "장", "permanent impurity not included in augment total");
    assert(withImpurity.augmentCount === beforeImpurityCount.augmentCount + 1, "augment count did not increase with permanent impurity");
    await page.evaluate(() => {
      const run=window.HarmonyCurrentRenderRun;
      const index=run.deck.findIndex((card) => card.id === "impurity");
      if(index>=0) run.deck.splice(index,1);
    });
    await nextPlayerTurn(page);
    const removedImpurity = await pcPanelSnapshot(page);
    assert(removedImpurity.augmentCount === beforeImpurityCount.augmentCount, "augment count did not recover after impurity removal");

    if (viewport.width === 1440) {
      results.inventoryData = { initial, dataInfo, afterItems, turn, beforeImpurityCount, withImpurity, removedImpurity, tooltipText };
      const specs = [
        {name:"impurity-0",regularCount:8,impurityCount:0,itemCount:4},
        {name:"impurity-1",regularCount:8,impurityCount:1,itemCount:4},
        {name:"impurity-3",regularCount:8,impurityCount:3,itemCount:4},
        {name:"mixed",regularCount:12,impurityCount:2,itemCount:7},
        {name:"small",regularCount:3,impurityCount:0,itemCount:1},
        {name:"partial-item-row",regularCount:10,impurityCount:0,itemCount:5},
        {name:"many",regularCount:20,impurityCount:2,itemCount:20},
        {name:"near-capacity",regularCount:21,impurityCount:1,itemCount:11},
      ];
      for (const spec of specs) {
        const state = await setScenario(page,spec);
        validateScenario(state);
        if (spec.name === "many") assert(state.listVerticalOverflow >= 0, "many: invalid deck scroll geometry");
        if (spec.name === "partial-item-row") assert(state.itemCount === 5, "partial item row count mismatch");
        results.scenarios.push(state);
      }

      const beforeAdd = await setScenario(page,{name:"rerender-before-add",regularCount:10,impurityCount:0,itemCount:11});
      validateScenario(beforeAdd);
      const afterAdd = await setScenario(page,{name:"rerender-after-add",regularCount:10,impurityCount:2,itemCount:11});
      validateScenario(afterAdd);
      const afterRemove = await setScenario(page,{name:"rerender-after-remove",regularCount:10,impurityCount:0,itemCount:11});
      validateScenario(afterRemove);
      assert(beforeAdd.itemCount === afterAdd.itemCount && afterAdd.itemCount === afterRemove.itemCount, "impurity mutation changed item grid count");
      assert(beforeAdd.itemGridColumns === afterAdd.itemGridColumns && afterAdd.itemGridColumns === afterRemove.itemGridColumns, "impurity mutation changed item grid columns");
      assert(!afterRemove.impurityText, "impurity removal left stale card entry");
      results.scenarios.push(beforeAdd,afterAdd,afterRemove);
      await closeSummary(page);
    }

    assert(errors.length === 0, "PC console errors: " + errors.join(" | "));
    results.pc.push({ viewport, initial, afterItems, withImpurity, removedImpurity, turn });
    await context.close();
  }

  for (const viewport of [{width:390,height:844},{width:430,height:932}]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("dialog", (d) => d.accept().catch(() => {}));
    await startRun(page);
    await enterBattle(page);
    const state = await page.evaluate(() => ({
      mobileActive:document.body.classList.contains("mobile-battle-active"),
      overflow:document.documentElement.scrollWidth-window.innerWidth,
      battle:Boolean(document.querySelector(".battle")),
      turn:Boolean(document.querySelector(".turn-order")),
      enemies:Boolean(document.querySelector(".enemies-field")),
      hand:Boolean(document.querySelector(".hand")),
    }));
    assert(state.mobileActive, "mobile battle mode not active");
    assert(state.overflow <= 2, "mobile horizontal overflow");
    assert(state.battle && state.turn && state.enemies && state.hand, "mobile composition missing");
    assert(errors.length === 0, "mobile console errors: " + errors.join(" | "));
    results.mobile.push({viewport,state});
    await context.close();
  }

  console.log("HARMONY_INVENTORY_DECK_LIMIT_SMOKE=" + JSON.stringify(results));
} finally {
  await browser.close();
}
