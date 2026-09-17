import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as E from "../games/harmony/engine.js";
import { createGameActionOrchestrator } from "../games/harmony/game-action-orchestrator.js";

const RELIC = "relic_mirror_of_duplication";

function mirrorRun(room, seed = 9100) {
  const run = E.newRun(seed), meta = E.freshMeta();
  run.node = 0;
  run.phase = "map";
  run.route[0] = room;
  run.inventory.push(RELIC);
  return { run, meta };
}

for (const room of ["gather", "golden"]) {
  const { run, meta } = mirrorRun(room, room === "gather" ? 9101 : 9102),
    before = new Set(run.deck),
    beforeLength = run.deck.length;
  E.enter(run, meta);
  assert.equal(run.phase, "chest", `${room} should still enter chest immediately`);
  assert.equal(run.deck.length, beforeLength + 1, `${room} should duplicate exactly one card`);
  const added = run.deck.find((card) => !before.has(card));
  assert.ok(added, `${room} should expose exactly one newly inserted runtime card`);
  assert.equal(run._roomRelicFeedback?.type, "cardDuplicate");
  assert.equal(run._roomRelicFeedback?.relicId, RELIC);
  assert.deepEqual(run._roomRelicFeedback?.card, added, "feedback must match the exact inserted duplicate data");
}

{
  const { run, meta } = mirrorRun("gather", 9103);
  const runtimeCard = { ...run.deck[0], level: 2, note: "middle", runtimeTag: "mirror-test" };
  run.deck = [runtimeCard];
  E.enter(run, meta);
  assert.equal(run.deck.length, 2);
  assert.deepEqual(run._roomRelicFeedback.card, runtimeCard, "feedback should preserve level, note and runtime fields");
  assert.deepEqual(run.deck[1], runtimeCard, "actual duplicate should preserve the same runtime fields");
}

{
  const { run, meta } = mirrorRun("gather", 9104);
  run.inventory = run.inventory.filter((id) => id !== RELIC);
  const before = run.deck.length;
  E.enter(run, meta);
  assert.equal(run.deck.length, before);
  assert.equal(run._roomRelicFeedback, undefined, "no relic means no presentation feedback");
}

{
  const { run, meta } = mirrorRun("gather", 9105), id = run.deck[0].id;
  while (run.deck.length < E.deckLimit(run)) run.deck.push({ id, level: 0 });
  const before = run.deck.length;
  E.enter(run, meta);
  assert.equal(run.deck.length, before, "full deck should not duplicate");
  assert.equal(run._roomRelicFeedback, undefined, "full deck should not show +1 feedback");
}

{
  const { run, meta } = mirrorRun("gather", 9106);
  E.enter(run, meta);
  const afterFirst = run.deck.length;
  delete run._roomRelicFeedback;
  run.phase = "map";
  E.enter(run, meta);
  assert.equal(run.deck.length, afterFirst, "same node must not duplicate twice");
  assert.equal(run._roomRelicFeedback, undefined, "same node must not emit duplicate VFX twice");
}

{
  const { run, meta } = mirrorRun("mystery", 9107), before = run.deck.length;
  E.enter(run, meta);
  assert.equal(run.deck.length, before, "other special rooms must not use mirror relic duplication");
  assert.equal(run._roomRelicFeedback, undefined);
}

{
  const { run, meta } = mirrorRun("gather", 9108),
    deckBefore = new Set(run.deck),
    shown = [],
    order = [];
  const noop = () => {}, asyncNoop = async () => {},
    roomRelicPresentation = {
      clear() { order.push("clear"); },
      show(value) { order.push("show"); shown.push(value); },
    },
    orchestrator = createGameActionOrchestrator({
      engine: E,
      enemyDefinitionFor: () => null,
      getRun: () => run,
      getMeta: () => meta,
      setStarted: noop,
      setCardAnimating: noop,
      save() {
        order.push("save");
        assert.equal(run._roomRelicFeedback, undefined, "transient feedback must be removed before save");
        const serialized = JSON.stringify(run);
        assert.doesNotMatch(serialized, /_roomRelicFeedback/, "save payload must not contain mirror feedback");
      },
      render() { order.push("render"); },
      sleep: asyncNoop,
      reducedCombatMotion: () => false,
      hideRestUpgradeComparison: noop,
      confirmReplaceRun: () => true,
      openStartingDeckBuilder: noop,
      sound: { potion: noop, playerStatusHit: noop },
      roomRelicPresentation,
      feedback: {
        animateDiscardedCard: asyncNoop,
        showImpurityOverflowQueue: asyncNoop,
        showHarmonyFeedback: noop,
        showEnemyHitQueue: asyncNoop,
        showStatusDamageQueue: asyncNoop,
        showStatusProcQueue: asyncNoop,
        showStatusProcVfx: asyncNoop,
        showPlayerDeath: asyncNoop,
        waitForLethalHitEffects: asyncNoop,
        showMonsterDeath: asyncNoop,
        stageDrawFeedback: noop,
        showShuffleFeedback: asyncNoop,
        showDrawFeedback: asyncNoop,
        showPlayerDamage: noop,
        showPlayerHealing: noop,
        showAbsorbGain: noop,
        showShieldGain: noop,
      },
    });
  await orchestrator.handleGameAction({ dataset: { action: "enter" } });
  assert.deepEqual(order.slice(0, 4), ["clear", "save", "render", "show"], "state should save/render before non-blocking room VFX");
  assert.equal(shown.length, 1);
  const added = run.deck.find((card) => !deckBefore.has(card));
  assert.ok(added);
  assert.deepEqual(shown[0].card, added, "presentation must receive exact engine duplicate data");

  const clearCount = order.filter((entry) => entry === "clear").length;
  await orchestrator.handleGameAction({ dataset: { action: "open" } });
  assert.equal(order.filter((entry) => entry === "clear").length, clearCount + 1, "first room interaction should clean the result strip without blocking the action");
  assert.notEqual(run.phase, "chest", "open action should continue normally while presentation is cleaned up");
}

const coreSource = await readFile(new URL("../games/harmony/engine-core.js", import.meta.url), "utf8"),
  engineSource = await readFile(new URL("../games/harmony/engine.js", import.meta.url), "utf8"),
  presentationSource = await readFile(new URL("../games/harmony/room-relic-presentation.js", import.meta.url), "utf8"),
  cardPresentationSource = await readFile(new URL("../games/harmony/card-presentation.js", import.meta.url), "utf8"),
  mainSource = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8"),
  css = await readFile(new URL("../games/harmony/room-relic-presentation.css", import.meta.url), "utf8"),
  index = await readFile(new URL("../games/harmony/index.html", import.meta.url), "utf8");

assert.match(coreSource, /const source = pick\(s, s\.deck\);[\s\S]*?s\.deck\.push\(\{ \.\.\.source \}\);[\s\S]*?_roomRelicFeedback[\s\S]*?card: \{ \.\.\.source \}/, "core must emit feedback from the same source chosen for deck.push");
assert.doesNotMatch(engineSource, /deckBefore|_roomRelicFeedback|deck\.find\(/, "engine facade must not infer which card Core duplicated");
assert.doesNotMatch(presentationSource, /Math\.random|\bpick\s*\(|deck\s*\[/, "presentation must never choose or infer a duplicate card");
assert.match(presentationSource, /presentationCardHtml\(card\)/, "mirror VFX must reuse main's current public card presentation renderer");
assert.doesNotMatch(cardPresentationSource, /HarmonyCardPresentation|globalThis/, "card presentation facade must not be exposed globally for mirror VFX");
assert.match(mainSource, /createRoomRelicPresentation\(\{[\s\S]*?presentationCardHtml/);
assert.match(mainSource, /roomRelicPresentation,/);
assert.match(css, /pointer-events:\s*none/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.match(css, /@media \(max-width:\s*900px\)/);
assert.doesNotMatch(css, /shake/i, "mirror room VFX must not add camera shake");
assert.match(index, /room-relic-presentation\.css/);
assert.doesNotMatch(index, /room-relic-presentation\.js/, "room presentation should be imported through main, not a second global module entrypoint");

console.log("PASS Harmony mirror relic: exact Core-selected duplicate feedback, transient save-safe room presentation, shared card renderer, click-through cleanup, responsive and reduced-motion contracts.");
