import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as E from "../games/harmony/engine.js";
import * as S from "../games/harmony/statuses.js";
import { buildPlayerPoisonRegions } from "../games/harmony/poison-tick-layout.js";

const feedback = await readFile(
    new URL("../games/harmony/combat-feedback-vfx.js", import.meta.url),
    "utf8",
  ),
  css = await readFile(
    new URL("../games/harmony/poison-tick-vfx.css", import.meta.url),
    "utf8",
  ),
  index = await readFile(
    new URL("../games/harmony/index.html", import.meta.url),
    "utf8",
  ),
  layout = await readFile(
    new URL("../games/harmony/poison-tick-layout.js", import.meta.url),
    "utf8",
  );

function assertPlayerLayout({ name, bounds, handBounds, impact, viewportWidth, expectedCount }) {
  const spots = buildPlayerPoisonRegions({
    bounds,
    handBounds,
    impact,
    viewportWidth,
    random: () => .5,
  });
  assert.equal(spots.length, expectedCount, `${name} uses the intended spot count`);
  assert.deepEqual(
    spots.map((spot) => spot.delay),
    Array.from({ length: expectedCount }, (_, index) => index * 75),
    `${name} spots activate sequentially at 75ms intervals`,
  );
  assert.ok(
    spots.every((spot) => spot.x > bounds.left && spot.x < bounds.right && spot.y < handBounds.top - 19),
    `${name} spots stay inside battle bounds with centers above the hand content`,
  );
  for (let left = 0; left < spots.length; left++)
    for (let right = left + 1; right < spots.length; right++)
      assert.ok(
        Math.hypot(spots[left].x - spots[right].x, spots[left].y - spots[right].y) >= 56,
        `${name} spots remain spatially separated`,
      );
  return spots;
}

const desktopSpots = assertPlayerLayout({
  name: "desktop",
  bounds: { left: 100, top: 80, right: 1100, bottom: 780, width: 1000, height: 700 },
  handBounds: { left: 180, top: 650, right: 1020, bottom: 760, width: 840, height: 110 },
  impact: { x: 600, y: 610 },
  viewportWidth: 1280,
  expectedCount: 4,
});
assert.equal(desktopSpots.reduce((sum, spot) => sum + spot.particleCount, 0), 12);

const portraitSpots = assertPlayerLayout({
  name: "mobile portrait",
  bounds: { left: 0, top: 40, right: 390, bottom: 740, width: 390, height: 700 },
  handBounds: { left: 8, top: 600, right: 382, bottom: 730, width: 374, height: 130 },
  impact: { x: 195, y: 555 },
  viewportWidth: 390,
  expectedCount: 3,
});
assert.equal(portraitSpots.reduce((sum, spot) => sum + spot.particleCount, 0), 10);

assertPlayerLayout({
  name: "mobile landscape",
  bounds: { left: 0, top: 20, right: 740, bottom: 420, width: 740, height: 400 },
  handBounds: { left: 12, top: 330, right: 728, bottom: 410, width: 716, height: 80 },
  impact: { x: 370, y: 300 },
  viewportWidth: 740,
  expectedCount: 3,
});

const reducedSpots = buildPlayerPoisonRegions({
  bounds: { left: 0, top: 0, right: 1000, bottom: 700, width: 1000, height: 700 },
  handBounds: { left: 80, top: 580, right: 920, bottom: 690, width: 840, height: 110 },
  impact: { x: 500, y: 540 },
  viewportWidth: 1280,
  reduced: true,
  random: () => .5,
});
assert.equal(reducedSpots.length, 3);
assert.deepEqual(reducedSpots.map((spot) => spot.particleCount), [0, 0, 0]);
assert.deepEqual(reducedSpots.map((spot) => spot.delay), [0, 60, 120]);

const run = E.newRun(2026092001),
  meta = E.freshMeta();
run.route[0] = "battle";
E.enter(run, meta);
run.battle.enemies.forEach((enemy) => {
  enemy.intent = { type: "guard", value: 0 };
});
if (run.battle.enemies.length < 2) {
  const secondEnemy = structuredClone(run.battle.enemies[0]);
  secondEnemy.hp = secondEnemy.maxHp;
  secondEnemy.statuses = {};
  secondEnemy.intent = { type: "guard", value: 0 };
  run.battle.enemies.push(secondEnemy);
}
run.battle.shield = 99;
S.applyStatus(run, "poison", 6);
S.applyStatus(run.battle.enemies[0], "poison", 8);
S.applyStatus(run.battle.enemies[1], "poison", 4);
const playerHpBefore = run.hp,
  enemyHpBefore = run.battle.enemies[0].hp;
E.endTurn(run, meta);

const poisonHits = run._damageFeedback.filter(
    (hit) => hit.statusId === "poison" && hit.presentation === "turnEndTick",
  ),
  playerHit = poisonHits.find((hit) => hit.target === "player"),
  enemyHit = poisonHits.find(
    (hit) => hit.target === "enemy" && hit.targetIndex === 0,
  ),
  secondEnemyHit = poisonHits.find(
    (hit) => hit.target === "enemy" && hit.targetIndex === 1,
  );
assert.deepEqual(
  playerHit,
  {
    target: "player",
    amount: 6,
    statusId: "poison",
    hpBefore: playerHpBefore,
    hpAfter: playerHpBefore - 6,
    maxHp: run.maxHp,
    shieldBefore: 99,
    shieldAfter: 99,
    stackBefore: 6,
    stackAfter: 5,
    presentation: "turnEndTick",
  },
  "player poison tick exposes engine-owned before/after presentation metadata",
);
assert.deepEqual(
  enemyHit,
  {
    target: "enemy",
    amount: 8,
    statusId: "poison",
    targetIndex: 0,
    hpBefore: enemyHpBefore,
    hpAfter: enemyHpBefore - 8,
    maxHp: run.battle.enemies[0].maxHp,
    shieldBefore: 0,
    shieldAfter: 0,
    stackBefore: 8,
    stackAfter: 7,
    presentation: "turnEndTick",
  },
  "enemy poison tick keeps its exact target index and stack result",
);
assert.deepEqual(
  secondEnemyHit,
  {
    target: "enemy",
    amount: 4,
    statusId: "poison",
    targetIndex: 1,
    hpBefore: run.battle.enemies[1].maxHp,
    hpAfter: run.battle.enemies[1].maxHp - 4,
    maxHp: run.battle.enemies[1].maxHp,
    shieldBefore: 0,
    shieldAfter: 0,
    stackBefore: 4,
    stackAfter: 3,
    presentation: "turnEndTick",
  },
  "a second poisoned enemy keeps an independent target index",
);
assert.equal(playerHpBefore - run.hp, 6, "poison still deals its stack count to the player");
assert.equal(
  enemyHpBefore - run.battle.enemies[0].hp,
  8,
  "poison still deals its stack count to the enemy",
);
assert.equal(S.stacks(run, "poison"), 5, "player poison still decays by one after damage");
assert.equal(
  S.stacks(run.battle.enemies[0], "poison"),
  7,
  "enemy poison still decays by one after damage",
);

function poisonBattle(seed) {
  const state = E.newRun(seed), stateMeta = E.freshMeta();
  state.route[0] = "battle";
  E.enter(state, stateMeta);
  state.battle.enemies.forEach((enemy) => {
    enemy.intent = { type: "guard", value: 0 };
  });
  return { state, stateMeta };
}

const playerOne = poisonBattle(2026092002);
playerOne.state.hp = 10;
S.applyStatus(playerOne.state, "poison", 1);
E.endTurn(playerOne.state, playerOne.stateMeta);
assert.equal(playerOne.state.hp, 9);
assert.equal(S.stacks(playerOne.state, "poison"), 0);
assert.deepEqual(
  playerOne.state._damageFeedback.find((hit) => hit.target === "player"),
  {
    target: "player",
    amount: 1,
    statusId: "poison",
    hpBefore: 10,
    hpAfter: 9,
    maxHp: playerOne.state.maxHp,
    shieldBefore: 0,
    shieldAfter: 0,
    stackBefore: 1,
    stackAfter: 0,
    presentation: "turnEndTick",
  },
);

const playerLethal = poisonBattle(2026092003);
playerLethal.state.hp = 1;
S.applyStatus(playerLethal.state, "poison", 1);
E.endTurn(playerLethal.state, playerLethal.stateMeta);
assert.equal(playerLethal.state.hp, 0, "lethal player poison still resolves death");
assert.equal(
  playerLethal.state._damageFeedback.filter((hit) => hit.statusId === "poison").length,
  1,
  "lethal player poison still emits exactly one damage popup event",
);

const enemyLethal = poisonBattle(2026092004);
enemyLethal.state.battle.enemies.slice(1).forEach((enemy) => { enemy.hp = 0; });
enemyLethal.state.battle.enemies[0].hp = 1;
S.applyStatus(enemyLethal.state.battle.enemies[0], "poison", 1);
E.endTurn(enemyLethal.state, enemyLethal.stateMeta);
assert.equal(enemyLethal.state.battle.enemies[0].hp, 0, "lethal enemy poison still resolves death");
assert.equal(
  enemyLethal.state._damageFeedback.filter((hit) => hit.statusId === "poison").length,
  1,
  "lethal enemy poison still emits exactly one targeted damage popup event",
);

assert.match(feedback, /function isPoisonTick\(hit\)/);
assert.match(feedback, /hit\.presentation === "turnEndTick"/);
assert.match(feedback, /function getPlayerPoisonRegions\(reduced = false, impact = getPlayerImpactPoint\(\)\)/);
assert.match(feedback, /enemyElement\(hit\.targetIndex\)\?\.getBoundingClientRect\(\)/);
assert.match(feedback, /hmy-poison-tick-\$\{hit\.target\}/);
assert.match(
  layout,
  /count = reduced \|\| mobile \|\| bounds\.width < 720 \? 3 : 4/,
  "player poison uses three mobile/reduced spots and four sufficiently wide desktop spots",
);
assert.match(
  layout,
  /particles: 4[\s\S]*?particles: 3[\s\S]*?particles: 3[\s\S]*?particles: 2/,
  "player spot particle budgets remain bounded to ten on mobile and twelve on wide desktop",
);
assert.match(layout, /minimumDistance = mobile[\s\S]*?56, 76[\s\S]*?72, 96/);
assert.match(layout, /delay: index \* \(reduced \? 60 : 75\)/);
assert.match(feedback, /function createPoisonSpot\(\{/);
assert.match(feedback, /for \(const region of regions\)[\s\S]*?createPoisonSpot\(\{ effect, point: region, player: true, \.\.\.region \}\)/);
assert.match(feedback, /particleCount: reduced \? 0 : 5/);
assert.match(feedback, /hmy-poison-final-pulse/);
assert.match(feedback, /if \(isPoisonTick\(hit\)\) showPoisonTickVfx\(hit, showPopup\)/);
assert.match(
  feedback,
  /function showStatusDamageQueue\(hits\) \{\s*stageStatusDamageHealth\(hits\);\s*hits\.forEach\(showStatusDamage\);/s,
  "health is synchronously restored to the first Before value before the browser can paint the resolved state",
);
assert.match(
  feedback,
  /function showStatusDamagePopup\(hit, definition, slot\) \{\s*presentStatusHealth\(hit, hit\.hpAfter\);/s,
  "the health bar advances to After at the existing damage popup impact beat",
);
assert.match(
  feedback,
  /else \{\s*if \(hit\.target === "player"\) showPlayerStatusSmoke\(color\);\s*showPopup\(\);/s,
  "generic player smoke remains exclusive to non-tick status damage",
);
assert.equal(
  (feedback.match(/<small>\$\{definition\.name\}<\/small>-\$\{number\(hit\.amount\)\}/g) || []).length,
  1,
  "the existing status popup remains the only poison damage number",
);
assert.match(css, /\.hmy-poison-tick/);
assert.match(css, /\.hmy-poison-core/);
assert.match(css, /\.hmy-poison-particle/);
assert.match(css, /\.hmy-poison-stain\s*\{[\s\S]*?width: 112px;[\s\S]*?height: 74px;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?width: 98px;[\s\S]*?height: 64px;/);
assert.match(
  css,
  /translateX\(var\(--poison-distance\)\)[\s\S]*?translateX\(0\)/,
  "poison particles travel inward instead of exploding outward",
);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /\.hmy-poison-tick-reduced \.hmy-poison-particle,[\s\S]*?\.hmy-poison-tick-reduced \.hmy-poison-haze \{ display: none;/);
assert.match(css, /\.hmy-poison-tick-reduced \.hmy-poison-stain\s*\{[\s\S]*?hmy-poison-stain-reduced/);
assert.match(index, /poison-tick-vfx\.css\?v=20260920-3/);

console.log("PASS Harmony poison tick VFX: engine metadata, exact anchors, inward motion, existing popup reuse, FX-off-safe information, and reduced motion.");
