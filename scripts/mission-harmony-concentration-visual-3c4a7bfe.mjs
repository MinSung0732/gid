import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const baseUrl = "http://127.0.0.1:5173/games/harmony/";
const out = "artifacts/concentration-visual";
await mkdir(out, { recursive: true });
await writeFile(`${out}/mission-started.txt`, "started\n");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  recordVideo: { dir: out, size: { width: 1440, height: 1000 } },
});
const page = await context.newPage();
const recordedVideo = page.video();
const consoleLines = [];
page.on("console", (msg) => consoleLines.push(`${msg.type()}: ${msg.text()}`));
page.on("pageerror", (error) => consoleLines.push(`pageerror: ${error.stack || error.message}`));

await page.goto(baseUrl + "?local=1", { waitUntil: "domcontentloaded" });
await page.evaluate(async () => {
  const E = await import("/games/harmony/engine.js?v=mission-concentration-visual-3c4a7bfe");
  const S = await import("/games/harmony/statuses.js?v=mission-concentration-visual-3c4a7bfe");
  const P = await import("/games/harmony/persistence.js?v=mission-concentration-visual-3c4a7bfe");
  const Scoped = await import("/games/harmony/scoped-storage.js?v=mission-concentration-visual-3c4a7bfe");
  const run = E.newRun(9222026), meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  run.battle.enemies.splice(1);
  run.battle.enemies[0].hp = 300;
  run.battle.enemies[0].maxHp = 300;
  run.battle.enemies[0].shield = 0;
  run.battle.enemies[0].intent = { type: "guard", value: 0 };
  run.battle.hand = [{ id: "contact_glass_dropper_strike", level: 0 }];
  run.battle.draw = [];
  run.battle.discard = [];
  run.battle.ap = 20;
  run.battle.selectedTarget = 0;
  S.applyStatus(run, "concentration", 1);
  const storage = Scoped.createScopedStorage(localStorage, Scoped.GUEST_SCOPE);
  storage.clear();
  P.saveGame(storage, { run, meta }, 0);
});
await page.reload({ waitUntil: "domcontentloaded" });
const reloadDiagnostic = await page.evaluate(async () => {
  const P = await import("/games/harmony/persistence.js?v=mission-concentration-diagnostic-3c4a7bfe");
  const Scoped = await import("/games/harmony/scoped-storage.js?v=mission-concentration-diagnostic-3c4a7bfe");
  const storage = Scoped.createScopedStorage(localStorage, Scoped.GUEST_SCOPE);
  const loaded = P.loadGame(storage);
  return {
    url: location.href,
    runtimeScope: window.HarmonyRuntime?.scope || null,
    rawKeys: Object.keys(localStorage),
    scopedKeys: Array.from({ length: storage.length }, (_, index) => storage.key(index)),
    loaded: { source: loaded.source, phase: loaded.run?.phase || null, hand: loaded.run?.battle?.hand || null, statuses: loaded.run?.statuses || null },
    appText: document.getElementById("app")?.textContent?.replace(/\\s+/g, " ").trim().slice(0, 1200) || null,
  };
});
await page.screenshot({ path: `${out}/reload-diagnostic.png`, fullPage: true });
await writeFile(`${out}/reload-diagnostic.json`, JSON.stringify({ reloadDiagnostic, consoleLines }, null, 2));
console.log("RELOAD_DIAGNOSTIC", JSON.stringify(reloadDiagnostic));
await page.waitForSelector('[data-action="resume"]', { timeout: 5000 });
await page.locator('[data-action="resume"]').click();
await page.waitForSelector('.battle .hand [data-action="play"]');
const chipDiagnostic = await page.evaluate(() =>
  [...document.querySelectorAll('.status-chip[data-status-id="concentration"]')].map((element) => {
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
    return {
      text: element.textContent?.replace(/\\s+/g, " ").trim(),
      rect: { x:rect.x, y:rect.y, width:rect.width, height:rect.height },
      clientRects: element.getClientRects().length,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      parentClass: element.parentElement?.className || null,
      rowClass: element.closest(".player-effects-row")?.className || null,
    };
  }),
);
await writeFile(`${out}/chip-diagnostic.json`, JSON.stringify(chipDiagnostic, null, 2));
console.log("CHIP_DIAGNOSTIC", JSON.stringify(chipDiagnostic));
await page.screenshot({ path: `${out}/battle-before.png`, fullPage: true });

const before = await page.evaluate(() => {
  const visible = (selector) => [...document.querySelectorAll(selector)].find((element) => {
    const r = element.getBoundingClientRect();
    return element.isConnected && element.getClientRects().length > 0 && r.width > 0 && r.height > 0;
  }) || null;
  const chip = visible('.status-chip[data-status-id="concentration"]');
  const card = visible('.hand [data-action="play"]');
  const layer = document.getElementById("fx-layer");
  const rect = (el) => {
    const r = el?.getBoundingClientRect();
    return r ? { x:r.x, y:r.y, width:r.width, height:r.height, cx:r.x+r.width/2, cy:r.y+r.height/2 } : null;
  };
  const ancestors = (el) => {
    const rows = [];
    for (let node = el; node && rows.length < 8; node = node.parentElement) {
      const s = getComputedStyle(node);
      rows.push({ tag: node.tagName, id: node.id, className: node.className, overflow:s.overflow, opacity:s.opacity, zIndex:s.zIndex, transform:s.transform, position:s.position });
    }
    return rows;
  };
  window.__concentrationVisualTrace = { mutations: [], samples: [] };
  const trace = window.__concentrationVisualTrace;
  const observeRoot = document.body;
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        const interesting = node.matches?.(".hmy-stack-resource-flow,.hmy-stack-resource-target-spark") ||
          node.querySelector?.(".hmy-stack-resource-flow,.hmy-stack-resource-target-spark");
        if (interesting) {
          const roots = node.matches?.(".hmy-stack-resource-flow") ? [node] : [...node.querySelectorAll?.(".hmy-stack-resource-flow") || []];
          for (const root of roots) {
            const s = getComputedStyle(root);
            trace.mutations.push({
              t: performance.now(),
              className: root.className,
              parentId: root.parentElement?.id || null,
              connected: root.isConnected,
              opacity: s.opacity,
              zIndex: s.zIndex,
              position: s.position,
              color: s.color,
              vars: {
                x: root.style.getPropertyValue("--stack-resource-x"),
                y: root.style.getPropertyValue("--stack-resource-y"),
                dx: root.style.getPropertyValue("--stack-resource-dx"),
                dy: root.style.getPropertyValue("--stack-resource-dy"),
                distance: root.style.getPropertyValue("--stack-resource-distance"),
                life: root.style.getPropertyValue("--stack-resource-life"),
              },
              moteCount: root.querySelectorAll(".hmy-stack-resource-mote").length,
              sparkCount: root.querySelectorAll(".hmy-stack-resource-target-spark").length,
            });
          }
        }
      }
    }
  }).observe(observeRoot, { childList: true, subtree: true });
  return {
    chipRect: rect(chip),
    cardRect: rect(card),
    chipText: chip?.textContent?.trim(),
    chipStyle: chip ? { color:getComputedStyle(chip).color, opacity:getComputedStyle(chip).opacity, zIndex:getComputedStyle(chip).zIndex } : null,
    cardText: card?.textContent?.replace(/\s+/g," ").trim(),
    layer: layer ? { rect:rect(layer), zIndex:getComputedStyle(layer).zIndex, overflow:getComputedStyle(layer).overflow, opacity:getComputedStyle(layer).opacity, position:getComputedStyle(layer).position } : null,
    chipAncestors: ancestors(chip),
    cardAncestors: ancestors(card),
  };
});
await page.screenshot({ path: `${out}/00-before.png`, fullPage: true });

const card = page.locator('.hand [data-action="play"]').first();
await card.click();

for (const delay of [30, 75, 135, 210, 285, 360]) {
  await page.waitForTimeout(delay - (globalThis.__lastDelay || 0));
  globalThis.__lastDelay = delay;
  await page.evaluate(() => {
    const chip = [...document.querySelectorAll('.status-chip[data-status-id="concentration"]')].find((element) => {
      const r = element.getBoundingClientRect();
      return element.isConnected && element.getClientRects().length > 0 && r.width > 0 && r.height > 0;
    }) || null;
    const roots = [...document.querySelectorAll(".hmy-stack-resource-flow")];
    const style = (el) => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return { className:el.className, opacity:s.opacity, visibility:s.visibility, display:s.display, zIndex:s.zIndex, color:s.color, rect:{x:r.x,y:r.y,width:r.width,height:r.height}, connected:el.isConnected };
    };
    window.__concentrationVisualTrace.samples.push({
      t: performance.now(),
      chipText: chip?.textContent?.trim() || null,
      chipClass: chip?.className || null,
      chipStyle: chip ? { opacity:getComputedStyle(chip).opacity, filter:getComputedStyle(chip).filter, transform:getComputedStyle(chip).transform, boxShadow:getComputedStyle(chip).boxShadow, outline:getComputedStyle(chip).outline } : null,
      roots: roots.map(style),
      motes: [...document.querySelectorAll(".hmy-stack-resource-mote")].map(style),
      sparks: [...document.querySelectorAll(".hmy-stack-resource-target-spark")].map(style),
    });
  });
}
await page.waitForTimeout(500);

const after = await page.evaluate(() => ({
  trace: window.__concentrationVisualTrace,
  chipText: [...document.querySelectorAll('.status-chip[data-status-id="concentration"]')].find((element) => {
    const r = element.getBoundingClientRect();
    return element.isConnected && element.getClientRects().length > 0 && r.width > 0 && r.height > 0;
  })?.textContent?.trim() || null,
  remainingFlows: document.querySelectorAll(".hmy-stack-resource-flow").length,
  fxLayerChildren: document.getElementById("fx-layer")?.children.length ?? null,
}));
await writeFile(`${out}/report.json`, JSON.stringify({ before, after, consoleLines }, null, 2));
console.log("CONCENTRATION_VISUAL_REPORT", JSON.stringify({
  before: { chipRect: before.chipRect, cardRect: before.cardRect, chipText: before.chipText, layer: before.layer },
  mutations: after.trace.mutations,
  samples: after.trace.samples.map((s) => ({ t:s.t, chipText:s.chipText, chipClass:s.chipClass, roots:s.roots.length, motes:s.motes.length, sparks:s.sparks.length, chipStyle:s.chipStyle })),
  remainingFlows: after.remainingFlows,
  fxLayerChildren: after.fxLayerChildren,
}, null, 2));
await page.screenshot({ path: `${out}/06-after.png`, fullPage: true });
await context.close();
if (recordedVideo) await recordedVideo.saveAs(`${out}/concentration-consume.webm`);
await browser.close();
