import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { CARDS } from "../games/harmony/data.js";

const outDir = "/tmp/hand-flicker-v3";
const orchestratorPath = new URL("../games/harmony/combat-card-orchestrator.js", import.meta.url);
await fs.mkdir(outDir, { recursive: true });
const original = await fs.readFile(orchestratorPath, "utf8");
let instrumented = original;

instrumented = instrumented.replace(
  "export function createCombatCardOrchestrator({",
  `function handProbe(label, run, extra = {}) {\n  const cards = [...document.querySelectorAll(\".hand > .card\")];\n  const hand = document.querySelector(\".hand\");\n  console.info(\"__HAND_PROBE__\", JSON.stringify({\n    caseName: window.__handProbeCase || null, label, time: performance.now(),\n    domCount: cards.length, stateHandCount: run?.battle?.hand?.length ?? null,\n    drawFeedback: run?._drawFeedback || 0,\n    pendingCount: cards.filter((card) => card.classList.contains(\"card-draw-pending\")).length,\n    drawingCount: cards.filter((card) => card.classList.contains(\"card-drawing\")).length,\n    visibleCount: cards.filter((card) => { const s = getComputedStyle(card); return s.opacity !== \"0\" && s.visibility !== \"hidden\" && s.display !== \"none\"; }).length,\n    oldNodeCount: cards.filter((card) => card.dataset.probeNode).length,\n    ids: cards.map((card) => card.dataset.cardId || card.querySelector(\".card-name\")?.textContent?.trim() || card.textContent.trim().slice(0, 32)),\n    positions: cards.map((card) => { const r = card.getBoundingClientRect(); return { left: Math.round(r.left * 10) / 10, top: Math.round(r.top * 10) / 10, width: Math.round(r.width * 10) / 10 }; }),\n    handWidth: hand ? Math.round(hand.getBoundingClientRect().width * 10) / 10 : null,\n    ...extra,\n  }));\n}\n\nexport function createCombatCardOrchestrator({`,
);
instrumented = instrumented.replace(
  "    engine.play(run, index, meta);\n    engine.checkUnlocks(run, meta);",
  "    engine.play(run, index, meta);\n    handProbe(\"after-engine-play\", run);\n    engine.checkUnlocks(run, meta);",
);
instrumented = instrumented.replace(
  "    await collapseUsedCard(button);\n\n    await showImpurityOverflowQueue(impurityOverflowHits);",
  "    await collapseUsedCard(button);\n    handProbe(\"after-collapse\", run, { drawn });\n\n    await showImpurityOverflowQueue(impurityOverflowHits);",
);
instrumented = instrumented.replace(
  "    save();\n    render();\n    stageDrawFeedback(drawn);",
  `    save();\n    render();\n    handProbe(\"after-render\", run, { drawn });\n    queueMicrotask(() => handProbe(\"microtask\", run, { drawn }));\n    requestAnimationFrame(() => {\n      handProbe(\"raf-1\", run, { drawn });\n      requestAnimationFrame(() => handProbe(\"raf-2\", run, { drawn }));\n    });\n    stageDrawFeedback(drawn);\n    handProbe(\"after-stage-draw\", run, { drawn });`,
);
for (const needle of ["after-engine-play", "after-collapse", "after-render", "microtask", "raf-1", "raf-2", "after-stage-draw"])
  if (!instrumented.includes(needle)) throw new Error(`instrumentation failed: ${needle}`);
await fs.writeFile(orchestratorPath, instrumented);

const allCards = Object.values(CARDS);
const simple = (card) => card && card.id !== "impurity" && !card.requiredAbsorb && !card.absorbCost && !card.executeRatio && !card.randomEachHit && !card.searchDrawCard && !card.discard && !card.pendingDiscard;
const chosen = {
  contact: allCards.find((card) => simple(card) && card.tier === 1 && card.attack > 0 && (card.attackPattern || "contact") === "contact" && !card.draw && !card.drawOnKill && !card.drawOnBreak),
  nonContact: allCards.find((card) => simple(card) && card.tier === 1 && card.attack > 0 && card.attackPattern === "nonContact" && !card.draw && !card.drawOnKill && !card.drawOnBreak),
  draw: allCards.find((card) => simple(card) && card.tier === 1 && card.draw > 0 && !card.attack && !card.burst && !card.weight && !card.randomDiscard),
  defense: allCards.find((card) => simple(card) && card.tier === 1 && card.shield > 0 && !card.draw && !card.attack),
  heal: allCards.find((card) => simple(card) && card.tier === 1 && card.heal > 0 && !card.draw && !card.attack),
  randomDiscard: allCards.find((card) => card.id !== "impurity" && card.randomDiscard > 0),
  impurity: CARDS.impurity,
};
for (const [kind, card] of Object.entries(chosen)) if (!card) throw new Error(`missing ${kind} test card`);
const fillers = allCards.filter((card) => card.id !== "impurity" && simple(card)).slice(0, 24).map((card) => card.id);
const instance = (id) => ({ id, level: 0 });
const makeHand = (first, size) => [first, ...Array.from({ length: Math.max(0, size - 1) }, (_, index) => fillers[index % fillers.length])];
const drawPile = Array.from({ length: 16 }, (_, index) => fillers[(index + 8) % fillers.length]);

const scenarios = [
  { name: "A-contact-hand1", kind: "A", first: chosen.contact.id, size: 1 },
  { name: "B-draw-hand1", kind: "B", first: chosen.draw.id, size: 1 },
  { name: "A-contact-hand4", kind: "A", first: chosen.contact.id, size: 4, capture: true },
  { name: "B-draw-hand4", kind: "B", first: chosen.draw.id, size: 4, capture: true },
  { name: "A-noncontact-hand7", kind: "A", first: chosen.nonContact.id, size: 7 },
  { name: "B-draw-hand7", kind: "B", first: chosen.draw.id, size: 7 },
  { name: "A-overflow-hand9", kind: "A", first: chosen.contact.id, size: 9 },
  { name: "defense-hand4", kind: "A", first: chosen.defense.id, size: 4 },
  { name: "heal-hand4", kind: "A", first: chosen.heal.id, size: 4, damaged: true },
  { name: "impurity-hand4", kind: "special", first: chosen.impurity.id, size: 4 },
  { name: "random-discard-hand7", kind: "special", first: chosen.randomDiscard.id, size: 7 },
];
const modes = [
  { name: "1440x900", viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" },
  { name: "1366x768", viewport: { width: 1366, height: 768 }, reducedMotion: "no-preference" },
  { name: "reduced-motion", viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" },
];

function makePayload(basePayload, scenario) {
  const payload = structuredClone(basePayload);
  const run = payload.run;
  run.phase = "battle";
  run.finished = false;
  run.testMode = true;
  run.hp = scenario.damaged ? Math.max(1, run.maxHp - 25) : run.maxHp;
  run.battle.hand = makeHand(scenario.first, scenario.size).map(instance);
  run.battle.draw = drawPile.map(instance);
  run.battle.discard = [];
  run.battle.ap = 99;
  run.battle.pendingDiscard = 0;
  run.battle.enemyPhase = false;
  run.battle.actingEnemy = null;
  run.battle.completedEnemies = [];
  run.battle.selectedTarget = 0;
  run.battle.shield = 0;
  run.battle.absorb = 80;
  run.battle.notes = [];
  run.battle.cardsPlayedThisTurn = 0;
  for (const enemy of run.battle.enemies) {
    enemy.hp = 9999;
    enemy.maxHp = 9999;
    enemy.shield = 0;
    enemy.statuses = {};
  }
  return payload;
}

async function installPayload(page, payload) {
  return page.evaluate(async (nextPayload) => {
    const persistence = await import("/games/harmony/persistence.js");
    const storage = window.HarmonyRuntime?.storage;
    if (!storage) throw new Error("HarmonyRuntime.storage missing");
    storage.clear();
    const revision = persistence.saveGame(storage, nextPayload, 0);
    const loaded = persistence.loadGame(storage);
    return {
      scope: window.HarmonyRuntime.scope,
      revision,
      source: loaded.source,
      hand: loaded.run?.battle?.hand?.length ?? null,
      rawKeys: Array.from({ length: storage.length }, (_, index) => storage.key(index)),
    };
  }, payload);
}

async function readRuntimeState(page) {
  return page.evaluate(async () => {
    const persistence = await import("/games/harmony/persistence.js");
    const storage = window.HarmonyRuntime?.storage;
    const loaded = storage ? persistence.loadGame(storage) : null;
    return {
      scope: window.HarmonyRuntime?.scope ?? null,
      source: loaded?.source ?? null,
      hand: loaded?.run?.battle?.hand?.length ?? null,
      revision: loaded?.revision ?? null,
      primary: storage?.getItem(persistence.SAVE_KEYS.primary) ? true : false,
      temporary: storage?.getItem(persistence.SAVE_KEYS.temporary) ? true : false,
      backup: storage?.getItem(persistence.SAVE_KEYS.backup) ? true : false,
    };
  });
}

async function startScreencast(page, caseName) {
  const safe = caseName.replace(/[^a-zA-Z0-9_-]+/g, "_");
  const dir = path.join(outDir, "frames", safe);
  await fs.mkdir(dir, { recursive: true });
  const session = await page.context().newCDPSession(page);
  let index = 0;
  const writes = [];
  session.on("Page.screencastFrame", ({ data, sessionId }) => {
    if (index < 90) {
      const file = path.join(dir, `${String(index).padStart(3, "0")}.jpg`);
      writes.push(fs.writeFile(file, Buffer.from(data, "base64")));
      index += 1;
    }
    void session.send("Page.screencastFrameAck", { sessionId });
  });
  await session.send("Page.startScreencast", { format: "jpeg", quality: 90, everyNthFrame: 1 });
  return async () => {
    await session.send("Page.stopScreencast").catch(() => {});
    await Promise.all(writes);
    await session.detach().catch(() => {});
    return { dir, frameCount: index };
  };
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
  const results = [];
  for (const mode of modes) {
    const context = await browser.newContext({ viewport: mode.viewport, reducedMotion: mode.reducedMotion });
    const page = await context.newPage();
    const probes = [];
    page.on("console", (message) => {
      const text = message.text();
      if (text.startsWith("__HAND_PROBE__ ")) probes.push(JSON.parse(text.slice("__HAND_PROBE__ ".length)));
    });

    await page.goto("http://127.0.0.1:5173/games/harmony/?local=1", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.HarmonyRuntime?.storage));
    await page.waitForSelector('[data-action="test-new"]');
    await page.locator('[data-action="test-new"]').click();
    await page.waitForSelector('[data-builder-action="preset"]');
    await page.locator('[data-builder-action="preset"]').click();
    await page.locator('[data-builder-action="start"]').click();
    await page.waitForSelector('[data-action="enter"]');
    await page.locator('[data-action="enter"]').click();
    await page.waitForSelector(".hand > .card");

    const baseline = await page.evaluate(async () => {
      const persistence = await import("/games/harmony/persistence.js");
      const loaded = persistence.loadGame(window.HarmonyRuntime.storage);
      return { meta: loaded.meta, run: loaded.run };
    });
    console.log("BASELINE", mode.name, JSON.stringify({ scope: await page.evaluate(() => window.HarmonyRuntime.scope), hand: baseline.run?.battle?.hand?.length }));

    for (const scenario of scenarios) {
      const caseName = `${mode.name}/${scenario.name}`;
      const payload = makePayload(baseline, scenario);
      const installed = await installPayload(page, payload);
      if (installed.hand !== scenario.size) throw new Error(`${caseName}: production saveGame reload before navigation expected ${scenario.size}, got ${installed.hand}`);

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(window.HarmonyRuntime?.storage));
      const beforeResumeState = await readRuntimeState(page);
      if (beforeResumeState.hand !== scenario.size) throw new Error(`${caseName}: bootstrap load expected ${scenario.size}, got ${beforeResumeState.hand}; ${JSON.stringify(beforeResumeState)}`);
      await page.waitForSelector('[data-action="resume"]');
      await page.locator('[data-action="resume"]').click();
      await page.waitForSelector(".hand > .card");
      const afterResumeState = await readRuntimeState(page);

      const startProbeIndex = probes.length;
      const before = await page.evaluate(({ caseName, expected }) => {
        window.__handProbeCase = caseName;
        const cards = [...document.querySelectorAll(".hand > .card")];
        cards.forEach((card, index) => { card.dataset.probeNode = `old-${index}`; });
        const visible = cards.filter((card) => { const s = getComputedStyle(card); return s.opacity !== "0" && s.visibility !== "hidden" && s.display !== "none"; });
        return {
          time: performance.now(), domCount: cards.length, visibleCount: visible.length, expected,
          firstText: cards[0]?.textContent.trim().replace(/\s+/g, " ").slice(0, 80) || "",
          firstDisabled: cards[0]?.matches(":disabled") || cards[0]?.getAttribute("aria-disabled") === "true",
          positions: cards.map((card) => { const r = card.getBoundingClientRect(); return { left: Math.round(r.left * 10) / 10, top: Math.round(r.top * 10) / 10, width: Math.round(r.width * 10) / 10 }; }),
        };
      }, { caseName, expected: scenario.size });
      if (before.domCount !== scenario.size) throw new Error(`${caseName}: expected hand ${scenario.size}, got ${before.domCount}`);
      if (before.firstDisabled) throw new Error(`${caseName}: first card disabled (${before.firstText})`);

      let stopCast = null;
      if (scenario.capture) stopCast = await startScreencast(page, caseName);
      const framesPromise = page.evaluate(async () => {
        const frames = [];
        for (let frame = 0; frame < 110; frame += 1) {
          await new Promise(requestAnimationFrame);
          const cards = [...document.querySelectorAll(".hand > .card")];
          frames.push({
            frame, time: performance.now(), domCount: cards.length,
            pendingCount: cards.filter((card) => card.classList.contains("card-draw-pending")).length,
            drawingCount: cards.filter((card) => card.classList.contains("card-drawing")).length,
            visibleCount: cards.filter((card) => { const s = getComputedStyle(card); return s.opacity !== "0" && s.visibility !== "hidden" && s.display !== "none"; }).length,
            oldNodeCount: cards.filter((card) => card.dataset.probeNode).length,
            positions: cards.map((card) => { const r = card.getBoundingClientRect(); return { left: Math.round(r.left * 10) / 10, top: Math.round(r.top * 10) / 10, width: Math.round(r.width * 10) / 10 }; }),
          });
        }
        return frames;
      });
      await page.locator('.hand > .card[data-index="0"]').click();
      const frames = await framesPromise;
      const capture = stopCast ? await stopCast() : null;
      const caseProbes = probes.slice(startProbeIndex).filter((probe) => probe.caseName === caseName);
      const byLabel = Object.fromEntries(caseProbes.map((probe) => [probe.label, probe]));
      const afterRenderTime = byLabel["after-render"]?.time ?? Number.POSITIVE_INFINITY;
      const postRenderFrames = frames.filter((frame) => frame.time >= afterRenderTime);
      const summary = {
        persistence: { installed, beforeResumeState, afterResumeState },
        drawFeedback: byLabel["after-engine-play"]?.drawFeedback ?? null,
        beforeDom: before.domCount,
        beforeVisible: before.visibleCount,
        afterEngineDom: byLabel["after-engine-play"]?.domCount ?? null,
        afterEngineState: byLabel["after-engine-play"]?.stateHandCount ?? null,
        afterCollapseDom: byLabel["after-collapse"]?.domCount ?? null,
        afterRenderDom: byLabel["after-render"]?.domCount ?? null,
        afterRenderVisible: byLabel["after-render"]?.visibleCount ?? null,
        afterRenderPending: byLabel["after-render"]?.pendingCount ?? null,
        afterRenderOldNodes: byLabel["after-render"]?.oldNodeCount ?? null,
        afterStagePending: byLabel["after-stage-draw"]?.pendingCount ?? null,
        microtaskDom: byLabel.microtask?.domCount ?? null,
        microtaskVisible: byLabel.microtask?.visibleCount ?? null,
        microtaskPending: byLabel.microtask?.pendingCount ?? null,
        raf1Dom: byLabel["raf-1"]?.domCount ?? null,
        raf1Visible: byLabel["raf-1"]?.visibleCount ?? null,
        raf1Pending: byLabel["raf-1"]?.pendingCount ?? null,
        raf1Drawing: byLabel["raf-1"]?.drawingCount ?? null,
        raf2Dom: byLabel["raf-2"]?.domCount ?? null,
        raf2Visible: byLabel["raf-2"]?.visibleCount ?? null,
        raf2Pending: byLabel["raf-2"]?.pendingCount ?? null,
        raf2Drawing: byLabel["raf-2"]?.drawingCount ?? null,
        maxVisiblePostRender: postRenderFrames.length ? Math.max(...postRenderFrames.map((frame) => frame.visibleCount)) : null,
        minVisiblePostRender: postRenderFrames.length ? Math.min(...postRenderFrames.map((frame) => frame.visibleCount)) : null,
        maxDomPostRender: postRenderFrames.length ? Math.max(...postRenderFrames.map((frame) => frame.domCount)) : null,
        oldNodeFramesPostRender: postRenderFrames.filter((frame) => frame.oldNodeCount > 0).length,
        capture,
      };
      if (scenario.kind === "A" && summary.drawFeedback !== 0) throw new Error(`${caseName}: expected _drawFeedback=0, got ${summary.drawFeedback}`);
      if (scenario.kind === "B" && !(summary.drawFeedback > 0)) throw new Error(`${caseName}: expected _drawFeedback>0, got ${summary.drawFeedback}`);
      results.push({ caseName, mode, scenario, before, probes: caseProbes, frames, summary });
      console.log("CASE_SUMMARY", caseName, JSON.stringify(summary));
    }
    await context.close();
  }

  await fs.writeFile(`${outDir}/results.json`, JSON.stringify({ chosen: Object.fromEntries(Object.entries(chosen).map(([key, card]) => [key, { id: card.id, name: card.name }])), results }, null, 2));
  console.log("RESULT_SUMMARIES", JSON.stringify(results.map(({ caseName, summary }) => ({ caseName, ...summary }))));
  await browser.close();
} finally {
  server.kill("SIGTERM");
  await fs.writeFile(orchestratorPath, original);
}
