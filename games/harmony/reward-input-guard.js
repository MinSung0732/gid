export function createRewardInputGuard({
  now = () => performance.now(),
  cooldownMs = 180,
} = {}) {
  let stateKey = null,
    unlockAt = 0,
    pointerTarget = null,
    pointerId = null;

  function sync(nextKey) {
    const normalized = nextKey || null;
    if (normalized === stateKey) return false;
    stateKey = normalized;
    pointerTarget = null;
    pointerId = null;
    unlockAt = normalized ? now() + Math.max(0, Number(cooldownMs) || 0) : 0;
    return true;
  }

  function notePointerDown(target, nextPointerId = null) {
    if (!stateKey || !target || now() < unlockAt) {
      pointerTarget = null;
      pointerId = null;
      return false;
    }
    pointerTarget = target;
    pointerId = nextPointerId;
    return true;
  }

  function notePointerCancel(nextPointerId = null) {
    if (
      nextPointerId === null ||
      pointerId === null ||
      nextPointerId === pointerId
    ) {
      pointerTarget = null;
      pointerId = null;
    }
  }

  function allowClick(target, { detail = 1 } = {}) {
    if (!stateKey) return true;
    if (detail === 0) return true;
    const allowed =
      now() >= unlockAt &&
      pointerTarget !== null &&
      pointerTarget === target;
    pointerTarget = null;
    pointerId = null;
    return allowed;
  }

  return {
    sync,
    notePointerDown,
    notePointerCancel,
    allowClick,
    isLocked: () => Boolean(stateKey && now() < unlockAt),
  };
}
