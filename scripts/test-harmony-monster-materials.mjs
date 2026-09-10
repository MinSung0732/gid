import assert from "node:assert/strict";
import { ACT1_BOSSES, ACT1_ELITES } from "../games/harmony/act1-monsters.js";
import {
  ACT2_BOSSES,
  ACT2_ELITES,
  ACT2_MONSTERS,
} from "../games/harmony/act2-monsters.js";
import {
  ACT3_BOSSES,
  ACT3_ELITES,
  ACT3_MONSTERS,
} from "../games/harmony/act3-monsters.js";
import { EARLY_MONSTERS } from "../games/harmony/monsters.js";

const MATERIALS = new Set(["glass", "stone", "gas", "liquid", "spirit"]),
  monsters = {
    ...EARLY_MONSTERS,
    ...ACT1_ELITES,
    ...ACT1_BOSSES,
    ...ACT2_MONSTERS,
    ...ACT2_ELITES,
    ...ACT2_BOSSES,
    ...ACT3_MONSTERS,
    ...ACT3_ELITES,
    ...ACT3_BOSSES,
  };

for (const [id, monster] of Object.entries(monsters)) {
  assert.ok(MATERIALS.has(monster.material), `${id} has a valid material`);
}

assert.equal(
  Object.keys(monsters).length,
  58,
  "all 58 monsters are classified",
);
console.log(
  "PASS Harmony monster materials: all 58 monsters use a supported material.",
);
