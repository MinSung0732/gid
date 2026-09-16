export function getPlayerHealthAnchor() {
  return (
    document.querySelector(".run-hud-health-slot") ||
    document.querySelector(".run-hud-health") ||
    document.querySelector(".player-stats .health-stat") ||
    document.querySelector(".health-stat")
  );
}

export function getPlayerImpactPoint() {
  const battle = document.querySelector(".battle");
  if (!battle) return null;
  const bounds = battle.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value)),
    edgeInsetX = Math.min(18, Math.max(8, bounds.width * .04)),
    edgeInsetY = Math.min(18, Math.max(8, bounds.height * .035)),
    safeLeft = bounds.left + edgeInsetX,
    safeRight = bounds.right - edgeInsetX,
    safeTop = bounds.top + edgeInsetY,
    safeBottom = bounds.bottom - edgeInsetY,
    hand = battle.querySelector(".hand"),
    handBounds = hand?.getBoundingClientRect();
  let minX,
    maxX,
    minY,
    maxY;
  if (handBounds && handBounds.width > 1 && handBounds.height > 1) {
    const handLeft = clamp(handBounds.left, safeLeft, safeRight),
      handRight = clamp(handBounds.right, safeLeft, safeRight),
      handWidth = Math.max(0, handRight - handLeft),
      horizontalInset = Math.min(
        Math.max(16, handWidth * .055),
        handWidth * .18,
      ),
      handTop = clamp(handBounds.top, safeTop, safeBottom),
      aboveHand = Math.min(72, Math.max(30, handBounds.height * .18)),
      insideHand = Math.min(52, Math.max(22, handBounds.height * .14));
    if (handWidth > horizontalInset * 2 + 1) {
      minX = handLeft + horizontalInset;
      maxX = handRight - horizontalInset;
      minY = clamp(handTop - aboveHand, safeTop, safeBottom);
      maxY = clamp(handTop + insideHand, safeTop, safeBottom);
    }
  }
  if (!(maxX > minX) || !(maxY > minY)) {
    minX = clamp(bounds.left + bounds.width * .12, safeLeft, safeRight);
    maxX = clamp(bounds.left + bounds.width * .88, safeLeft, safeRight);
    minY = clamp(bounds.top + bounds.height * .58, safeTop, safeBottom);
    maxY = clamp(bounds.top + bounds.height * .76, safeTop, safeBottom);
  }
  const x = minX + Math.random() * Math.max(0, maxX - minX),
    y = minY + Math.random() * Math.max(0, maxY - minY);
  return {
    x: clamp(x, safeLeft, safeRight),
    y: clamp(y, safeTop, safeBottom),
  };
}
