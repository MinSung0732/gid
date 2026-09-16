import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { CARDS } from "../games/harmony/data.js";

const outDir = "/tmp/hand-flicker";
const orchestratorPath = new URL("../games/harmony/combat-card-orchestrator.js", import.meta.url);
await fs.mkdir(outDir, { recursive: true });

const originalOrchestrator = await fs.readFile(orchestratorPath, "utf8");
let instrumentedOrchestrator = originalOrchestrator;
instrumentedOrchestrator = instrumentedOrchestrator.replace(
  "export function createCombatCardOrchestrator({",
  `function handProbe(label, run, extra = {}) {\n  const cards = [...document.querySelectorAll(\".hand > .card\")];\n  console.info(\"__HAND_PROBE__\", JSON.stringify({\n    caseName: window.__handProbeCase || null,\n    label,\n    time: performance.now(),\n    domCount: cards.length,\n    stateHandCount: run?.battle?.hand?.length ?? null,\n    drawFeedback: run?._drawFeedback || 0,\n    pendingCount: cards.filter((card) => card.classList.contains(\"card-draw-pending\")).length,\n    drawingCount: cards.filter((card) => card.classList.contains(\"card-drawing\")).length,\n    cards: cards.map((card) => ({\n      index: card.dataset.index ?? null,\n      nodeToken: card.dataset.probeNode || null,\n      text: card.textContent.trim().replace(/\\s+/g, \" \" ).slice(0, 64),\n      className: card.className,\n      opacity: getComputedStyle(card).opacity,\n      visibility: getComputedStyle(card).visibility,\n    })),\n    ...extra,\n  }));\n}\n\nexport function createCombatCardOrchestrator({`,
);
instrumentedOrchestrator = instrumentedOrchestrator.replace(
  "    engine.play(run, index, meta);\n    engine.checkUnlocks(run, meta);",
  "    engine.play(run, index, meta);\n    handProbe(\"after-engine-play\", run);\n    engine.checkUnlocks(run, meta);",
);
instrumentedOrchestrator = instrumentedOrchestrator.replace(
  "    await collapseUsedCard(button);\n\n    await showImpurityOverflowQueue(impurityOverflowHits);",
  "    await collapseUsedCard(button);\n    handProbe(\"after-collapse\", run, { drawn });\n\n    await showImpurityOverflowQueue(impurityOverflowHits);",
);
instrumentedOrchestrator = instrumentedOrchestrator.replace(
  "    save();\n    render();\n    stageDrawFeedback(drawn);",
  `    save();\n    render();\n    handProbe(\"after-render\", run, { drawn });\n    queueMicrotask(() => handProbe(\"next-microtask\", run, { drawn }));\n    requestAnimationFrame(() => handProbe(\"next-animation-frame\", run, { drawn }));\n    stageDrawFeedback(drawn);\n    handProbe(\"after-stage-draw\", run, { drawn });`,
);
for (const needle of ["after-engine-play", "after-collapse", "after-render", "after-stage-draw"])
  if (!instrumentedOrchestrator.includes(needle)) throw new Error(`instrumentation failed: ${needle}`);
await fs.writeFile(orchestratorPath, instrumentedOrchestrator);

const values = Object.values(CARDS);
const simple = (card) =>
  card && card.id !== "impurity" && !card.requiredAbsorb && !card.absorbCost && !card.executeRatio &&
  !card.randomEachHit && !card.searchDrawCard && !card.discard && !card.pendingDiscard;
const chosen = {
  contact: values.find((card) => simple(card) && card.tier === 1 && card.attack > 0 && (card.attackPattern || "contact") === "contact" && !card.draw && !card.drawOnKill && !card.drawOnBreak),
  nonContact: values.find((card) => simple(card) && card.tier === 1 && card.attack > 0 && card.attackPattern === "nonContact" && !card.draw && !card.drawOnKill && !card.drawOnBreak),
  draw: values.find((card) => simple(card) && card.tier === 1 && card.draw > 0 && !card.attack && !card.burst && !card.weight && !card.randomDiscard),
  defense: values.find((card) => simple(card) && card.tier === 1 && card.shield > 0 && !card.draw && !card.attack),
  heal: values.find((card) => simple(card) && card.tier === 1 && card.heal > 0 && !card.draw && !card.attack),
  randomDiscard: values.find((card) => card.id !== "impurity" && card.randomDiscard > 0),
  impurity: CARDS.impurity,
};
for (const [name, card] of Object.entries(chosen))
  if (!card) throw new Error(`No card found for ${name}`);
console.log("CHOSEN_CARDS", JSON.stringify(Object.fromEntries(Object.entries(chosen).map(([key, card]) => [key, { id: card.id, name: card.name, draw: card.draw || 0, randomDiscard: card.randomDiscard || 0, attackPattern: card.attackPattern || null }])), null, 2));

const fillerIds = values.filter((card) => card.id !== "impurity" && simple(card)).slice(0, 16).map((card) => card.id);
const handIds = (first, size) => [first, ...Array.from({ length: Math.max(0, size - 1) }, (_, index) => fillerIds[index % fillerIds.length])];
const drawIds = Array.from({ length: 8 }, (_, index) => fillerIds[(index + 7) % fillerIds.length]);
const scenarios = [
  { name: "contact-no-draw-hand1", first: chosen.contact.id, size: 1 },
  { name: "draw-hand4", first: chosen.draw.id, size: 4, drawIds },
  { name: "defense-hand4", first: chosen.defense.id, size: 4 },
  { name: "heal-hand4", first: chosen.heal.id, size: 4, damaged: true },
  { name: "noncontact-hand7", first: chosen.nonContact.id, size: 7 },
  { name: "impurity-hand4", first: chosen.impurity.id, size: 4, drawIds },
  { name: "random-discard-hand7", first: chosen.randomDiscard.id, size: 7 },
  { name: "overflow-hand9", first: chosen.contact.id, size: 9 },
];

function checksum(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function visibleCardCount(frame) {
  return frame.cards.filter((card) => card.opacity !== "0" && card.visibility !== "hidden").length;
}

const server = spawn(process.execPath, ["scripts/serve.cjs"], { stdio: ["ignore", "pipe", "pipe"] });
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server timeout")), 10000);
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes("127.0.0.1:5173")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.once("exit", (code) => reject(new Error(`server exited ${code}`)));
  });

  const browser = await chromium.launch({ headless: true });
  const results = [];
  const modes = [
    { name: "1440x900", viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" },
    { name: "1366x768", viewport: { width: 1366, height: 768 }, reducedMotion: "no-preference" },
    { name: "reduced-motion", viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" },
  ];

  for (const mode of modes) {
    const context = await browser.newContext({ viewport: mode.viewport, reducedMotion: mode.reducedMotion });
    const page = await context.newPage();
    const probes = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.startsWith("__HAND_PROBE__ ")) {
        try { probes.push(JSON.parse(text.slice("__HAND_PROBE__ ".length))); }
        catch (error) { console.error("probe parse failed", error); }
      }
    });

    await page.goto("http://127.0.0.1:5173/games/harmony/?local=1", { waitUntil: "networkidle" });
    await page.locator('[data-action="test-new"]').click();
    await page.locator('[data-builder-action="preset"]').click();
    await page.locator('[data-builder-action="start"]').click();
    await page.locator('[data-action="enter"]').click();
    await page.waitForSelector(".hand > .card");

    const baseline = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((candidate) => candidate.endsWith("gyeolideun-harmony-save-v2") && !candidate.includes("backup") && !candidate.includes("temporary"));
      if (!key) throw new Error("primary save key not found");
      return { key, envelope: localStorage.getItem(key) };
    });

    for (const scenario of scenarios) {
      const caseName = `${mode.name}/${scenario.name}`;
      const startProbeIndex = probes.length;
      await page.evaluate(({ baseline, scenario, drawIdsForCase }) => {
        const envelope = JSON.parse(baseline.envelope);
        const run = envelope.payload.run;
        const instance = (id) => ({ id, level: 0 });
        run.phase = "battle";
        run.finished = false;
        run.hp = scenario.damaged ? Math.max(1, run.maxHp - 25) : run.maxHp;
        run.battle.hand = [scenario.first, ...scenario.rest].map(instance);
        run.battle.draw = drawIdsForCase.map(instance);
        run.battle.discard = [];
        run.battle.ap = 99;
        run.battle.pendingDiscard = 0;
        run.battle.enemyPhase = false;
        run.battle.selectedTarget = 0;
        run.battle.shield = 0;
        run.battle.absorb = Math.max(80, run.battle.absorb || 0);
        run.battle.notes = [];
        run.battle.cardsPlayedThisTurn = 0;
        for (const enemy of run.battle.enemies) {
          enemy.hp = 9999;
          enemy.maxHp = 9999;
          enemy.shield = 0;
          enemy.statuses = {};
        }
        envelope.revision = Number(envelope.revision || 0) + 1;
        envelope.savedAt = Date.now();
        const payloadText = JSON.stringify(envelope.payload);
        let hash = 2166136261;
        for (let index = 0; index < payloadText.length; index += 1) {
          hash ^= payloadText.charCodeAt(index);
          hash = Math.imul(hash, 16777619);
        }
        envelope.checksum = (hash >>> 0).toString(16).padStart(8, "0");
        localStorage.setItem(baseline.key, JSON.stringify(envelope));
      }, {
        baseline,
        scenario: {
          first: scenario.first,
          rest: handIds(scenario.first, scenario.size).slice(1),
          damaged: Boolean(scenario.damaged),
        },
        drawIdsForCase: scenario.drawIds || drawIds,
      });

      await page.reload({ waitUntil: "networkidle" });
      const resume = page.locator('[data-action="resume"]');
      if (await resume.count()) await resume.click();
      await page.waitForSelector(".hand > .card");
      await page.evaluate((caseName) => {
        window.__handProbeCase = caseName;
        [...document.querySelectorAll(".hand > .card")].forEach((card, index) => {
          card.dataset.probeNode = `old-${index}`;
        });
      }, caseName);

      const before = await page.evaluate(() => {
        const cards = [...document.querySelectorAll(".hand > .card")];
        return {
          time: performance.now(),
          domCount: cards.length,
          cards: cards.map((card) => ({
            index: card.dataset.index ?? null,
            nodeToken: card.dataset.probeNode || null,
            text: card.textContent.trim().replace(/\s+/g, " ").slice(0, 64),
            className: card.className,
            opacity: getComputedStyle(card).opacity,
            visibility: getComputedStyle(card).visibility,
          })),
        };
      });

      const framePromise = page.evaluate(async () => {
        const frames = [];
        for (let index = 0; index < 180; index += 1) {
          await new Promise(requestAnimationFrame);
          const cards = [...document.querySelectorAll(".hand > .card")];
          frames.push({
            frame: index,
            time: performance.now(),
            domCount: cards.length,
            pendingCount: cards.filter((card) => card.classList.contains("card-draw-pending")).length,
            drawingCount: cards.filter((card) => card.classList.contains("card-drawing")).length,
            cards: cards.map((card) => {
              const style = getComputedStyle(card);
              const rect = card.getBoundingClientRect();
              return {
                index: card.dataset.index ?? null,
                nodeToken: card.dataset.probeNode || null,
                text: card.textContent.trim().replace(/\s+/g, " ").slice(0, 48),
                className: card.className,
                opacity: style.opacity,
                visibility: style.visibility,
                left: Math.round(rect.left * 10) / 10,
                top: Math.round(rect.top * 10) / 10,
                width: Math.round(rect.width * 10) / 10,
              };
            }),
          });
        }
        return frames;
      });
      await page.locator('.hand > .card[data-index="0"]').click();
      const frames = await framePromise;
      await page.waitForTimeout(50);
      const caseProbes = probes.slice(startProbeIndex).filter((entry) => entry.caseName === caseName);
      const probeByLabel = Object.fromEntries(caseProbes.map((entry) => [entry.label, entry]));
      const engineProbe = probeByLabel["after-engine-play"];
      const rafProbe = probeByLabel["next-animation-frame"];
      const expectedFinalCount = engineProbe?.stateHandCount ?? null;
      const postRenderFrames = probeByLabel["after-render"]
        ? frames.filter((frame) => frame.time >= probeByLabel["after-render"].time)
        : [];
      const maxVisiblePostRender = postRenderFrames.length ? Math.max(...postRenderFrames.map(visibleCardCount)) : null;
      const oldTokenFramesAfterRender = postRenderFrames.filter((frame) => frame.cards.some((card) => card.nodeToken)).length;

      const result = {
        caseName,
        mode,
        scenario,
        before,
        probes: caseProbes,
        frames,
        summary: {
          drawFeedbackAtEnginePlay: engineProbe?.drawFeedback ?? null,
          beforeDomCount: before.domCount,
          afterEngineDomCount: engineProbe?.domCount ?? null,
          afterEngineStateCount: engineProbe?.stateHandCount ?? null,
          afterCollapseDomCount: probeByLabel["after-collapse"]?.domCount ?? null,
          afterRenderDomCount: probeByLabel["after-render"]?.domCount ?? null,
          afterRenderPending: probeByLabel["after-render"]?.pendingCount ?? null,
          afterStagePending: probeByLabel["after-stage-draw"]?.pendingCount ?? null,
          microtaskDomCount: probeByLabel["next-microtask"]?.domCount ?? null,
          microtaskPending: probeByLabel["next-microtask"]?.pendingCount ?? null,
          rafDomCount: rafProbe?.domCount ?? null,
          rafPending: rafProbe?.pendingCount ?? null,
          rafDrawing: rafProbe?.drawingCount ?? null,
          expectedFinalCount,
          maxVisiblePostRender,
          oldTokenFramesAfterRender,
        },
      };
      results.push(result);
      console.log("CASE_SUMMARY", JSON.stringify(result.summary), caseName);
      await page.screenshot({ path: `${outDir}/${caseName.replaceAll("/", "-")}.png`, fullPage: true });
    }
    await context.close();
  }

  await fs.writeFile(`${outDir}/hand-flicker-results.json`, JSON.stringify({ chosen, results }, null, 2));
  console.log("RESULT_SUMMARIES", JSON.stringify(results.map((result) => ({ caseName: result.caseName, ...result.summary })), null, 2));
  await browser.close();
} finally {
  server.kill("SIGTERM");
  await fs.writeFile(orchestratorPath, originalOrchestrator);
}
