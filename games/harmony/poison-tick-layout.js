export function buildPlayerPoisonRegions({
  bounds,
  handBounds,
  impact,
  viewportWidth,
  reduced = false,
  random = Math.random,
}) {
  if (!bounds || !impact || bounds.width <= 0 || bounds.height <= 0) return [];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value)),
    mobile = viewportWidth <= 760,
    count = reduced || mobile || bounds.width < 720 ? 3 : 4,
    insetX = clamp(bounds.width * .1, 24, 96),
    insetY = clamp(bounds.height * .08, 18, 64),
    safeLeft = bounds.left + insetX,
    safeRight = bounds.right - insetX,
    safeTop = bounds.top + insetY,
    handTop = handBounds?.height > 1
      ? clamp(handBounds.top, safeTop, bounds.bottom - insetY)
      : bounds.top + bounds.height * .78,
    bandTop = clamp(handTop - clamp(bounds.height * .18, 72, 126), safeTop, handTop),
    bandBottom = clamp(handTop - clamp(bounds.height * .045, 20, 34), bandTop + 1, bounds.bottom - insetY),
    bandHeight = Math.max(1, bandBottom - bandTop),
    templates = [
      { x: impact.x, y: clamp(impact.y, bandTop, bandBottom), scale: 1.1, particles: 4 },
      { x: bounds.left + bounds.width * .24, y: bandTop + bandHeight * .38, scale: .95, particles: 3 },
      { x: bounds.left + bounds.width * .76, y: bandTop + bandHeight * .28, scale: .88, particles: 3 },
      { x: bounds.left + bounds.width * .56, y: bandTop + bandHeight * .82, scale: .82, particles: 2 },
    ],
    minimumDistance = mobile
      ? clamp(bounds.width * .15, 56, 76)
      : clamp(bounds.width * .09, 72, 96),
    spots = [];
  for (let index = 0; index < count; index++) {
    const template = templates[index],
      jitterX = index ? clamp(bounds.width * .035, 8, 28) : 5,
      jitterY = index ? clamp(bandHeight * .12, 5, 15) : 4;
    let point = null;
    for (let attempt = 0; attempt < 5 && !point; attempt++) {
      const candidate = {
        x: clamp(template.x + (random() * 2 - 1) * jitterX, safeLeft, safeRight),
        y: clamp(template.y + (random() * 2 - 1) * jitterY, bandTop, bandBottom),
      };
      if (
        spots.every(
          (spot) => Math.hypot(candidate.x - spot.x, candidate.y - spot.y) >= minimumDistance,
        )
      )
        point = candidate;
    }
    if (!point) {
      const width = safeRight - safeLeft,
        fallbackCandidates = [.08, .28, .5, .72, .92].map((ratio) => ({
          x: safeLeft + width * ratio,
          y: clamp(template.y, bandTop, bandBottom),
        })),
        clearance = (candidate) => Math.min(
          ...spots.map((spot) => Math.hypot(candidate.x - spot.x, candidate.y - spot.y)),
        );
      point = fallbackCandidates.sort((a, b) => clearance(b) - clearance(a))[0];
    }
    spots.push({
      ...point,
      scale: template.scale,
      particleCount: reduced ? 0 : template.particles,
      delay: index * (reduced ? 60 : 75),
      rotation: -15 + random() * 30,
      intensity: index ? .82 : 1,
    });
  }
  return spots;
}
