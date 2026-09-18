export const MULTI_HIT_IMPACT_CAP = 12;

const SAFE_X = Object.freeze([0.2, 0.8]);
const SAFE_Y = Object.freeze([0.22, 0.76]);
const REGIONS = Object.freeze([
  ["LT", 0.28, 0.3], ["CT", 0.5, 0.3], ["RT", 0.72, 0.3],
  ["LM", 0.28, 0.49], ["RM", 0.72, 0.49],
  ["LB", 0.28, 0.68], ["CB", 0.5, 0.68], ["RB", 0.72, 0.68],
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const seededUnit = (seed) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

export function usesMultiHitPresentation(hits = []) {
  return Array.isArray(hits) && hits.length >= 2;
}

export function multiHitInterval(hitCount) {
  if (hitCount <= 5) return 90;
  if (hitCount <= 12) return 65;
  if (hitCount <= 24) return 45;
  return 30;
}

export function multiHitReactionEnabled(hitIndex, hitCount) {
  if (hitIndex === 0 || hitIndex === hitCount - 1) return true;
  if (hitCount <= 5) return hitIndex % 2 === 0;
  if (hitCount <= 12) return hitIndex % 3 === 0;
  return hitIndex % 5 === 0;
}

export function multiHitSoundEnabled(hitIndex, hitCount) {
  if (hitIndex === 0 || hitIndex === hitCount - 1) return true;
  if (hitCount <= 5) return true;
  if (hitCount <= 12) return hitIndex % 2 === 0;
  if (hitCount <= 24) return hitIndex % 3 === 0;
  return hitIndex % 4 === 0;
}

export function multiHitVisualScale(hitIndex, hitCount) {
  const base = hitCount >= 25 ? 0.78 : hitCount >= 13 ? 0.84 : hitCount >= 6 ? 0.9 : 0.96;
  return hitIndex === hitCount - 1 ? Math.min(1.28, base * 1.28) : base;
}

function candidatePoint(targetRect, region, seed) {
  const [, rx, ry] = region,
    jitterX = (seededUnit(seed) - 0.5) * 0.06,
    jitterY = (seededUnit(seed + 17) - 0.5) * 0.05,
    nx = clamp(rx + jitterX, SAFE_X[0], SAFE_X[1]),
    ny = clamp(ry + jitterY, SAFE_Y[0], SAFE_Y[1]);
  return {
    x: targetRect.left + targetRect.width * nx,
    y: targetRect.top + targetRect.height * ny,
    localX: targetRect.width * nx,
    localY: targetRect.height * ny,
    region: region[0],
  };
}

export function getMultiHitImpactPoint({
  targetRect,
  targetIndex = 0,
  hitIndex = 0,
  hitCount = 2,
  previousPoint = null,
  previousRegion = null,
}) {
  if (!targetRect?.width || !targetRect?.height) return null;
  if (hitIndex === 0 || hitIndex === hitCount - 1) {
    const finisher = hitIndex === hitCount - 1,
      nx = finisher ? 0.52 : 0.5,
      ny = finisher ? 0.49 : 0.48;
    return {
      x: targetRect.left + targetRect.width * nx,
      y: targetRect.top + targetRect.height * ny,
      localX: targetRect.width * nx,
      localY: targetRect.height * ny,
      region: "CC",
    };
  }

  const baseIndex = (hitIndex * 5 + targetIndex * 3 + hitCount) % REGIONS.length,
    minDistance = Math.min(targetRect.width, targetRect.height) * 0.16;
  let fallback = null;
  for (let offset = 0; offset < REGIONS.length; offset++) {
    const region = REGIONS[(baseIndex + offset) % REGIONS.length];
    if (region[0] === previousRegion && offset < REGIONS.length - 1) continue;
    const point = candidatePoint(
      targetRect,
      region,
      hitIndex * 97 + hitCount * 31 + targetIndex * 53 + offset * 11,
    );
    fallback ||= point;
    if (!previousPoint || Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) >= minDistance)
      return point;
  }
  return fallback;
}

export function createMultiHitPresentationScheduler({ sleep, resolveImpactPoint }) {
  if (typeof sleep !== "function") throw new TypeError("sleep is required");
  if (typeof resolveImpactPoint !== "function")
    throw new TypeError("resolveImpactPoint is required");

  return async function presentMultiHit(hits, spawnImpact) {
    if (!usesMultiHitPresentation(hits)) return false;
    if (typeof spawnImpact !== "function") throw new TypeError("spawnImpact is required");

    const hitCount = hits.length,
      interval = multiHitInterval(hitCount),
      previousByTarget = new Map();
    for (let hitIndex = 0; hitIndex < hitCount; hitIndex++) {
      const hit = hits[hitIndex],
        targetIndex = Number.isInteger(hit?.targetIndex) ? hit.targetIndex : null,
        previous = previousByTarget.get(targetIndex) || {},
        impactPoint = resolveImpactPoint({
          targetIndex,
          hitIndex,
          hitCount,
          previousPoint: previous.point || null,
          previousRegion: previous.region || null,
        }),
        metadata = {
          multiHit: true,
          hitIndex,
          hitCount,
          impactPoint,
          isFinisher: hitIndex === hitCount - 1,
          react: multiHitReactionEnabled(hitIndex, hitCount),
          playSound: multiHitSoundEnabled(hitIndex, hitCount),
          visualScale: multiHitVisualScale(hitIndex, hitCount),
        };
      if (impactPoint)
        previousByTarget.set(targetIndex, {
          point: impactPoint,
          region: impactPoint.region,
        });
      // Intentionally do not await the VFX return value. Only hit cadence is serialized.
      spawnImpact(hit, metadata);
      if (hitIndex < hitCount - 1) await sleep(interval);
    }
    return true;
  };
}
