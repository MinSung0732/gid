import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { CARDS } from "../games/harmony/data.js";

const outDir = "/tmp/hand-flicker-v2";
const orchestratorPath = new URL("../games/harmony/combat-card-orchestrator.js", import.meta.url);
await fs.mkdir(outDir, { recursive: true });

const original = await fs.readFile(orchestratorPath, "utf8");
let instrumented = original;
instrumented = instrumented.replace(
  "export function createCombatCardOrchestrator({",
  `function handProbe(label, run, extra = {}) {\n  const cards = [...document.querySelectorAll(\".hand > .card\")];\n  console.info(\"__HAND_PROBE__\", JSON.stringify({\n    caseName: window.__handProbeCase || null, label, time: performance.now(),\n    domCount: cards.length, stateHandCount: run?.battle?.hand?.length ?? null,\n    drawFeedback: run?._drawFeedback || 0,\n    pendingCount: cards.filter((card) => card.classList.contains(\"card-draw-pending\")).length,\n    drawingCount: cards.filter((card) => card.classList.contains(\"card-drawing\")).length,\n    visibleCount: cards.filter((card) => { const s = getComputedStyle(card); return s.opacity !== \"0\" && s.visibility !== \"hidden\"; }).length,\n    oldNodeCount: cards.filter((card) => card.dataset.probeNode).length,\n    positions: cards.map((card) => Math.round(card.getBoundingClientRect().left * 10) / 10),\n    ...extra,\n  }));\n}\n\nexport function createCombatCardOrchestrator({`,
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
  `    save();\n    render();\n    handProbe(\"after-render\", run, { drawn });\n    queueMicrotask(() => handProbe(\"next-microtask\", run, { drawn }));\n    requestAnimationFrame(() => handProbe(\"next-animation-frame\", run, { drawn }));\n    stageDrawFeedback(drawn);\n    handProbe(\"after-stage-draw\", run, { drawn });`,
);
for (const needle of ["after-engine-play", "after-collapse", "after-render", "after-stage-draw"])
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

const fillers = allCards.filter((card) => card.id !== "impurity" && simple(card)).slice(0, 20).map((card) => card.id);
const makeHand = (first, size) => [first, ...Array.from({ length: Math.max(0, size - 1) }, (_, index) => fillers[index % fillers.length])];
const drawPile = Array.from({ length: 12 }, (_, index) => fillers[(index + 8) % fillers.length]);
const scenarios = [
  { name: "contact-no-draw-hand1", first: chosen.contact.id, size: 1 },
  { name: "draw-hand4", first: chosen.draw.id, size: 4 },
  { name: "defense-hand4", first: chosen.defense.id, size: 4 },
  { name: "heal-hand4", first: chosen.heal.id, size: 4, damaged: true },
  { name: "noncontact-hand7", first: chosen.nonContact.id, size: 7 },
  { name: "impurity-hand4", first: chosen.impurity.id, size: 4 },
  { name: "random-discard-hand7", first: chosen.randomDiscard.id, size: 7 },
  { name: "overflow-hand9", first: chosen.contact.id, size: 9 },
];
const modes = [
  { name: "1440x900", viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" },
  { name: "1366x768", viewport: { width: 1366, height: 768 }, reducedMotion: "no-preference" },
  { name: "reduced-motion", viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" },
];

function rewriteEnvelope(envelopeText, desiredHand, damaged) {
  const envelope = JSON.parse(envelopeText), run = envelope.payload.run, instance = (id) => ({ id, level: 0 });
  run.phase = "battle";
  run.finished = false;
  run.hp = damaged ? Math.max(1, run.maxHp - 25) : run.maxHp;
  run.battle.hand = desiredHand.map(instance);
  run.battle.draw = drawPile.map(instance);
  run.battle.discard = [];
  run.battle.ap = 99;
  run.battle.pendingDiscard = 0;
  run.battle.enemyPhase = false;
  run.battle.selectedTarget = 0;
  run.battle.shield = 0;
  run.battle.absorb = 80;
  run.battle.notes = [];
  run.battle.cardsPlayedThisTurn = 0;
  for (const enemy of run.battle.enemies) {
    enemy.hp = 9999; enemy.maxHp = 9999; enemy.shield = 0; enemy.statuses = {};
  }
  envelope.revision = Number(envelope.revision || 0) + 100;
  envelope.savedAt = Date.now();
  const payloadText = JSON.stringify(envelope.payload);
  let hash = 2166136261;
  for (let index = 0; index < payloadText.length; index += 1) {
    hash ^= payloadText.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  envelope.checksum = (hash >>> 0).toString(16).padStart(8, "0");
  return JSON.stringify(envelope);
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
    await page.waitForSelector('[data-action="test-new"]');
    await page.locator('[data-action="test-new"]').click();
    await page.waitForSelector('[data-builder-action="preset"]');
    await page.locator('[data-builder-action="preset"]').click();
    await page.locator('[data-builder-action="start"]').click();
    await page.waitForSelector('[data-action="enter"]');
    await page.locator('[data-action="enter"]').click();
    await page.waitForSelector(".hand > .card");

    const baseline = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((candidate) => candidate.startsWith("harmony:guest:") && candidate.endsWith("gyeolideun-harmony-save-v2"));
      if (!key) throw new Error(`guest primary save missing: ${Object.keys(localStorage).join(",")}`);
      return { key, envelope: localStorage.getItem(key) };
    });
    console.log("BASELINE_KEY", mode.name, baseline.key);

    for (const scenario of scenarios) {
      const caseName = `${mode.name}/${scenario.name}`;
      const desiredHand = makeHand(scenario.first, scenario.size);
      const encoded = rewriteEnvelope(baseline.envelope, desiredHand, Boolean(scenario.damaged));
      await page.evaluate(({ key, encoded }) => {
        const suffix = "gyeolideun-harmony-save-v2", prefix = key.slice(0, -suffix.length);
        localStorage.setItem(key, encoded);
        localStorage.setItem(`${prefix}${suffix}-temporary`, encoded);
        localStorage.setItem(`${prefix}${suffix}-backup`, encoded);
      }, { key: baseline.key, encoded });

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-action="resume"], .hand > .card', { state: "attached" });
      const resume = page.locator('[data-action="resume"]');
      if (await resume.count()) await resume.click();
      await page.waitForSelector(".hand > .card");

      const startProbeIndex = probes.length;
      const before = await page.evaluate(({ caseName, expected }) => {
        window.__handProbeCase = caseName;
        const cards = [...document.querySelectorAll(".hand > .card")];
        cards.forEach((card, index) => { card.dataset.probeNode = `old-${index}`; });
        return {
          time: performance.now(), domCount: cards.length, expected,
          firstText: cards[0]?.textContent.trim().replace(/\s+/g, " ").slice(0, 80) || "",
          firstDisabled: cards[0]?.matches(":disabled") || cards[0]?.getAttribute("aria-disabled") === "true",
          positions: cards.map((card) => Math.round(card.getBoundingClientRect().left * 10) / 10),
        };
      }, { caseName, expected: scenario.size });
      if (before.domCount !== scenario.size) throw new Error(`${caseName}: expected hand ${scenario.size}, got ${before.domCount}`);
      if (before.firstDisabled) throw new Error(`${caseName}: first card disabled (${before.firstText})`);

      const framesPromise = page.evaluate(async () => {
        const frames = [];
        for (let frame = 0; frame < 90; frame += 1) {
          await new Promise(requestAnimationFrame);
          const cards = [...document.querySelectorAll(".hand > .card")];
          frames.push({
            frame, time: performance.now(), domCount: cards.length,
            pendingCount: cards.filter((card) => card.classList.contains("card-draw-pending")).length,
            drawingCount: cards.filter((card) => card.classList.contains("card-drawing")).length,
            visibleCount: cards.filter((card) => { const s = getComputedStyle(card); return s.opacity !== "0" && s.visibility !== "hidden"; }).length,
            oldNodeCount: cards.filter((card) => card.dataset.probeNode).length,
            positions: cards.map((card) => Math.round(card.getBoundingClientRect().left * 10) / 10),
          });
        }
        return frames;
      });
      await page.locator('.hand > .card[data-index="0"]').click();
      const frames = await framesPromise;
      const caseProbes = probes.slice(startProbeIndex).filter((probe) => probe.caseName === caseName);
      const byLabel = Object.fromEntries(caseProbes.map((probe) => [probe.label, probe]));
      const afterRenderTime = byLabel["after-render"]?.time ?? Number.POSITIVE_INFINITY;
      const postRenderFrames = frames.filter((frame) => frame.time >= afterRenderTime);
      const summary = {
        drawFeedback: byLabel["after-engine-play"]?.drawFeedback ?? null,
        beforeDom: before.domCount,
        afterEngineDom: byLabel["after-engine-play"]?.domCount ?? null,
        afterEngineState: byLabel["after-engine-play"]?.stateHandCount ?? null,
        afterCollapseDom: byLabel["after-collapse"]?.domCount ?? null,
        afterRenderDom: byLabel["after-render"]?.domCount ?? null,
        afterRenderPending: byLabel["after-render"]?.pendingCount ?? null,
        afterStagePending: byLabel["after-stage-draw"]?.pendingCount ?? null,
        microtaskDom: byLabel["next-microtask"]?.domCount ?? null,
        microtaskPending: byLabel["next-microtask"]?.pendingCount ?? null,
        rafDom: byLabel["next-animation-frame"]?.domCount ?? null,
        rafPending: byLabel["next-animation-frame"]?.pendingCount ?? null,
        rafDrawing: byLabel["next-animation-frame"]?.drawingCount ?? null,
        maxVisiblePostRender: postRenderFrames.length ? Math.max(...postRenderFrames.map((frame) => frame.visibleCount)) : null,
        maxDomPostRender: postRenderFrames.length ? Math.max(...postRenderFrames.map((frame) => frame.domCount)) : null,
        oldNodeFramesPostRender: postRenderFrames.filter((frame) => frame.oldNodeCount > 0).length,
      };
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
