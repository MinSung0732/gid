import assert from "node:assert/strict";
import {
  DEFAULT_IMPURITY_INJECTION,
  extractRecentImpurities,
  impurityInjectionConfig,
  placeImpurities,
} from "../games/harmony/impurity-injection.js";

const impurity = () => ({ id: "impurity", level: 0 });

{
  const config = impurityInjectionConfig({ type: "pollute", value: 1 });
  assert.deepEqual(config, DEFAULT_IMPURITY_INJECTION);
}

{
  const discard = [
    { id: "used-card", level: 0 },
    impurity(),
    { id: "other-card", level: 0 },
    impurity(),
  ];
  const extracted = extractRecentImpurities(discard, 2);
  assert.equal(extracted.length, 2);
  assert.deepEqual(discard.map((card) => card.id), ["used-card", "other-card"]);
}

{
  const battle = {
    draw: [{ id: "a" }, { id: "b" }],
    hand: [],
    discard: [],
  };
  const result = placeImpurities(
    battle,
    [impurity()],
    impurityInjectionConfig({}),
    { random: () => 0.5 },
  );
  assert.deepEqual(battle.draw.map((card) => card.id), ["a", "impurity", "b"]);
  assert.equal(battle.discard.length, 0);
  assert.equal(result.primaryDestination, "draw");
}

{
  const topBattle = { draw: [{ id: "a" }], hand: [], discard: [] };
  placeImpurities(
    topBattle,
    [impurity()],
    impurityInjectionConfig({ impurityInjection: { destination: "draw", placement: "top" } }),
  );
  assert.equal(topBattle.draw.at(-1).id, "impurity");

  const bottomBattle = { draw: [{ id: "a" }], hand: [], discard: [] };
  placeImpurities(
    bottomBattle,
    [impurity()],
    impurityInjectionConfig({ impurityInjection: { destination: "draw", placement: "bottom" } }),
  );
  assert.equal(bottomBattle.draw[0].id, "impurity");
}

{
  const battle = { draw: [], hand: [], discard: [] };
  const config = impurityInjectionConfig({
    impurityInjection: {
      destination: "hand",
      handOverflowDestination: "discard",
    },
  });
  const result = placeImpurities(battle, [impurity()], config, {
    canAddToHand: () => false,
  });
  assert.equal(battle.hand.length, 0);
  assert.equal(battle.discard.length, 1);
  assert.equal(result.primaryDestination, "discard");
}

{
  const battle = { draw: [], hand: [], discard: [] };
  const config = impurityInjectionConfig({
    impurityInjection: {
      destination: "hand",
      respectHandLimit: false,
    },
  });
  const result = placeImpurities(battle, [impurity()], config, {
    canAddToHand: () => false,
  });
  assert.equal(battle.hand.length, 1);
  assert.equal(result.primaryDestination, "hand");
}

{
  const battle = { draw: [], hand: [], discard: [] };
  const config = impurityInjectionConfig({
    impurityInjection: { destination: "discard" },
  });
  const result = placeImpurities(battle, [impurity(), impurity()], config);
  assert.equal(battle.discard.length, 2);
  assert.equal(result.destinations.discard, 2);
  assert.equal(result.total, 2);
}

console.log("harmony impurity injection tests passed");
