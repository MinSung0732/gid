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
    before = [...run.deck],
    beforeLength = run.deck.length;
  E.enter(run, meta);
  assert.equal(run.phase, "chest", `${room} should still enter chest immediately`);
  assert.equal(run.deck.length, beforeLength + 1, `${room} should duplicate exactly one card`);
  const added = run.deck.find((card) => !before.includes(card));
  assert.ok(added, `${room} should expose the actual newly inserted runtime card`);
  assert.equal(run._roomRelicFeedback?.type, "cardDuplicate");
  assert.equal(run._roomRelicFeedback?.relicId, RELIC);
  assert.deepEqual(run._roomRelicFeedback?.card, added);
}

{
  const { run, meta } = mirrorRun("gather", 9103);
  const runtimeCard = { ...run.deck[0], level: 2, note: "middle", runtimeTag: "mirror-test" };
  run.deck = [runtimeCard];
  E.enter(run, meta);
  assert.equal(run.deck.length, 2);
  assert.deepEqual(run._roomRelicFeedback.card, runtimeCard, "feedback should preserve level, note and runtime fields");
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
    dispatched = [],
    order = [];
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  };
  globalThis.window = {
    dispatchEvent(event) { order.push("dispatch"); dispatched.push(event); },
  };
  const noop = () => {}, asyncNoop = async () => {},
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
      },
      render() { order.push("render"); },
      sleep: asyncNoop,
      reducedCombatMotion: () => false,
      hideRestUpgradeComparison: noop,
      confirmReplaceRun: () => true,
      openStartingDeckBuilder: noop,
      sound: { potion: noop, playerStatusHit: noop },
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
  assert.deepEqual(order.slice(0, 3), ["save", "render", "dispatch"], "state should save/render before non-blocking VFX dispatch");
  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, "harmony:room-relic-feedback");
  const added = run.deck.find((card) => !deckBefore.has(card));
  assert.ok(added);
  assert.deepEqual(dispatched[0].detail.card, added, "dispatched card must be the exact engine-added runtime card data");
  delete globalThis.window;
  delete globalThis.CustomEvent;
}

const engineSource = await readFile(new URL("../games/harmony/engine.js", import.meta.url), "utf8"),
  presentationSource = await readFile(new URL("../games/harmony/room-relic-presentation.js", import.meta.url), "utf8"),
  cardPresentationSource = await readFile(new URL("../games/harmony/card-presentation.js", import.meta.url), "utf8"),
  css = await readFile(new URL("../games/harmony/room-relic-presentation.css", import.meta.url), "utf8"),
  index = await readFile(new URL("../games/harmony/index.html", import.meta.url), "utf8");

assert.doesNotMatch(engineSource, /deck\s*\[\s*(?:s\.)?deck\.length\s*-\s*1\s*\]/, "engine facade must not guess the duplicate from the last deck slot");
assert.doesNotMatch(presentationSource, /Math\.random|\bpick\s*\(/, "presentation must never choose a second random card");
assert.match(presentationSource, /HarmonyCardPresentation/);
assert.match(presentationSource, /presentation\.cardHtml\(card\)/, "mirror VFX must reuse the current card presentation pipeline");
assert.match(cardPresentationSource, /globalThis\.HarmonyCardPresentation = presentation/);
assert.match(css, /pointer-events:\s*none/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.match(css, /@media \(max-width:\s*900px\)/);
assert.doesNotMatch(css, /shake/i, "mirror room VFX must not add camera shake");
assert.match(index, /room-relic-presentation\.css/);
assert.match(index, /room-relic-presentation\.js/);

console.log("PASS Harmony mirror relic: exact engine duplicate feedback, transient save-safe dispatch, shared card presentation, responsive and reduced-motion VFX contracts.");
