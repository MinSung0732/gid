import assert from "node:assert/strict";
import {
  MULTI_HIT_IMPACT_CAP,
  createMultiHitPresentationScheduler,
  getMultiHitImpactPoint,
  multiHitInterval,
  multiHitReactionEnabled,
  multiHitSoundEnabled,
  multiHitVisualScale,
  usesMultiHitPresentation,
} from "../games/harmony/multi-hit-presentation.js";

assert.equal(MULTI_HIT_IMPACT_CAP, 12);
assert.equal(usesMultiHitPresentation([{ targetIndex: 0 }]), false);
assert.equal(usesMultiHitPresentation([{ targetIndex: 0 }, { targetIndex: 0 }]), true);
assert.equal(multiHitInterval(2), 90);
assert.equal(multiHitInterval(6), 65);
assert.equal(multiHitInterval(15), 45);
assert.equal(multiHitInterval(24), 45);
assert.equal(multiHitInterval(40), 30);
assert.equal(multiHitReactionEnabled(0, 40), true);
assert.equal(multiHitReactionEnabled(1, 40), false);
assert.equal(multiHitReactionEnabled(39, 40), true);
assert.equal(multiHitSoundEnabled(1, 40), false);
assert.equal(multiHitSoundEnabled(39, 40), true);
assert.ok(multiHitVisualScale(39, 40) > multiHitVisualScale(20, 40));
assert.ok(multiHitVisualScale(39, 40) <= 1.4);

const rect = { left: 100, top: 200, width: 300, height: 240 };
const first = getMultiHitImpactPoint({ targetRect: rect, hitIndex: 0, hitCount: 6 });
const middle = getMultiHitImpactPoint({
  targetRect: rect,
  targetIndex: 0,
  hitIndex: 1,
  hitCount: 6,
  previousPoint: first,
  previousRegion: first.region,
});
const next = getMultiHitImpactPoint({
  targetRect: rect,
  targetIndex: 0,
  hitIndex: 2,
  hitCount: 6,
  previousPoint: middle,
  previousRegion: middle.region,
});
const last = getMultiHitImpactPoint({ targetRect: rect, hitIndex: 5, hitCount: 6 });
for (const point of [first, middle, next, last]) {
  assert.ok(point.x >= rect.left + rect.width * 0.2 && point.x <= rect.left + rect.width * 0.8);
  assert.ok(point.y >= rect.top + rect.height * 0.22 && point.y <= rect.top + rect.height * 0.76);
}
assert.notEqual(middle.region, first.region);
assert.notEqual(next.region, middle.region);
assert.equal(first.region, "CC");
assert.equal(last.region, "CC");

const sleeps = [], spawned = [], hits40 = Array.from({ length: 40 }, (_, index) => ({
  targetIndex: index % 3,
  damage: 1,
  impactId: index + 1,
}));
const present = createMultiHitPresentationScheduler({
  sleep: async (ms) => sleeps.push(ms),
  resolveImpactPoint: ({ targetIndex, hitIndex, hitCount, previousPoint, previousRegion }) =>
    getMultiHitImpactPoint({ targetRect: rect, targetIndex, hitIndex, hitCount, previousPoint, previousRegion }),
});
await present(hits40, (hit, metadata) => spawned.push({ hit, metadata }));
assert.equal(spawned.length, 40, "all actual hit feedback events are presented");
assert.equal(sleeps.length, 39);
assert.equal(sleeps.reduce((sum, value) => sum + value, 0), 1170, "40-hit cadence stays near 1.2 seconds");
assert.deepEqual(spawned.map(({ hit }) => hit.targetIndex), hits40.map((hit) => hit.targetIndex), "actual targetIndex order is preserved");
assert.equal(spawned[0].metadata.hitIndex, 0);
assert.equal(spawned[39].metadata.isFinisher, true);
assert.equal(spawned[20].metadata.hitCount, 40);

const deadEarlyHits = Array.from({ length: 10 }, (_, index) => ({ targetIndex: 0, damage: 1, impactId: index + 1 }));
const earlySpawned = [];
await present(deadEarlyHits, (hit) => earlySpawned.push(hit));
assert.equal(earlySpawned.length, 10, "presentation never synthesizes hits after engine stops producing events");

const noAwaitPresent = createMultiHitPresentationScheduler({
  sleep: async () => {},
  resolveImpactPoint: () => first,
});
const completion = noAwaitPresent(
  [{ targetIndex: 0 }, { targetIndex: 0 }],
  () => new Promise(() => {}),
);
const completionState = await Promise.race([
  completion.then(() => "completed"),
  new Promise((resolve) => setTimeout(() => resolve("timed-out"), 80)),
]);
assert.equal(completionState, "completed", "scheduler does not await transient VFX lifespan promises");

console.log("Harmony multi-hit presentation tests passed");
