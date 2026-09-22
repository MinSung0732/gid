import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const baseUrl = "http://127.0.0.1:5173/games/harmony/";
const out = "artifacts/concentration-visual";
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const consoleLines = [];
page.on("console", (msg) => consoleLines.push(`${msg.type()}: ${msg.text()}`));
page.on("pageerror", (error) => consoleLines.push(`pageerror: ${error.stack || error.message}`));

await page.goto(baseUrl + "?local=1", { waitUntil: "networkidle" });
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
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector('.battle .hand [data-action="play"]');
await page.waitForSelector('.status-chip[data-status-id="concentration"]');

const before = await page.evaluate(() => {
  const chip = document.querySelector('.status-chip[data-status-id="concentration"]');
  const card = document.querySelector('.hand [data-action="play"]');
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

for (const [delay, name] of [[35,"01-pulse"],[80,"02-travel-start"],[140,"03-travel"],[205,"04-spark"],[285,"05-result"]]) {
  await page.waitForTimeout(delay - (globalThis.__lastDelay || 0));
  globalThis.__lastDelay = delay;
  const sample = await page.evaluate(() => {
    const chip = document.querySelector('.status-chip[data-status-id="concentration"]');
    const roots = [...document.querySelectorAll(".hmy-stack-resource-flow")];
    const style = (el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { className:el.className, opacity:s.opacity, visibility:s.visibility, display:s.display, zIndex:s.zIndex, color:s.color, rect:{x:r.x,y:r.y,width:r.width,height:r.height}, connected:el.isConnected };
    };
    const row = {
      t: performance.now(),
      chipText: chip?.textContent?.trim() || null,
      chipClass: chip?.className || null,
      chipStyle: chip ? { opacity:getComputedStyle(chip).opacity, filter:getComputedStyle(chip).filter, transform:getComputedStyle(chip).transform, boxShadow:getComputedStyle(chip).boxShadow, outline:getComputedStyle(chip).outline } : null,
      roots: roots.map(style),
      motes: [...document.querySelectorAll(".hmy-stack-resource-mote")].map(style),
      sparks: [...document.querySelectorAll(".hmy-stack-resource-target-spark")].map(style),
    };
    window.__concentrationVisualTrace.samples.push(row);
    return row;
  });
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
}

const after = await page.evaluate(() => ({
  trace: window.__concentrationVisualTrace,
  chipText: document.querySelector('.status-chip[data-status-id="concentration"]')?.textContent?.trim() || null,
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
await browser.close();
