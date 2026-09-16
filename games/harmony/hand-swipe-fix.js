const HAND_SELECTOR = ".battle > .hand";
const DRAG_THRESHOLD = 12;
const OVERFLOW_EPSILON = 8;
const SYNTHETIC_CLICK_WINDOW_MS = 120;

let drag = null;
let suppressClickFor = null;
let suppressClickUntil = 0;
let refreshQueued = false;

function handCards(hand) {
  return [...hand.children].filter((element) => element.classList?.contains("card"));
}

function numericStyle(style, key) {
  const value = Number.parseFloat(style[key]);
  return Number.isFinite(value) ? value : 0;
}

function laidOutHandWidth(hand) {
  const cards = handCards(hand);
  if (!cards.length) return 0;

  const style = getComputedStyle(hand),
    gap = numericStyle(style, "columnGap") || numericStyle(style, "gap"),
    padding = numericStyle(style, "paddingLeft") + numericStyle(style, "paddingRight"),
    cardsWidth = cards.reduce((total, card) => total + card.offsetWidth, 0);

  return cardsWidth + Math.max(0, cards.length - 1) * gap + padding;
}

function maxLayoutScroll(hand) {
  if (!hand || hand.clientWidth <= 0) return 0;
  return Math.max(0, laidOutHandWidth(hand) - hand.clientWidth);
}

function hasRealHorizontalOverflow(hand) {
  return maxLayoutScroll(hand) > OVERFLOW_EPSILON;
}

function clampHandScroll(hand) {
  if (!hand) return 0;
  const max = hasRealHorizontalOverflow(hand) ? maxLayoutScroll(hand) : 0,
    next = Math.min(max, Math.max(0, hand.scrollLeft));
  if (Math.abs(hand.scrollLeft - next) > 0.5) hand.scrollLeft = next;
  return max;
}

function syncHandOverflow(hand) {
  const overflowing = hasRealHorizontalOverflow(hand);
  hand.classList.toggle("hand-has-real-overflow", overflowing);
  hand.classList.toggle("hand-no-real-overflow", !overflowing);
  clampHandScroll(hand);
  return overflowing;
}

export function syncAllHands() {
  document.querySelectorAll(HAND_SELECTOR).forEach(syncHandOverflow);
}

export function queueHandSync() {
  if (refreshQueued) return;
  refreshQueued = true;
  queueMicrotask(syncAllHands);
  requestAnimationFrame(() => {
    refreshQueued = false;
    syncAllHands();
  });
}

function clearClickSuppression() {
  suppressClickFor = null;
  suppressClickUntil = 0;
}

function finishDrag(event, cancelled = false) {
  if (!drag || drag.pointerId !== event.pointerId) return;

  const { hand, moved } = drag;
  if (hand.hasPointerCapture?.(event.pointerId)) {
    try {
      hand.releasePointerCapture(event.pointerId);
    } catch {
      // The browser may already have released capture during rerender.
    }
  }
  hand.classList.remove("mouse-drag-scroll", "is-mouse-dragging");
  clampHandScroll(hand);

  if (!cancelled && moved) {
    suppressClickFor = hand;
    suppressClickUntil = performance.now() + SYNTHETIC_CLICK_WINDOW_MS;
    window.setTimeout(() => {
      if (performance.now() >= suppressClickUntil) clearClickSuppression();
    }, SYNTHETIC_CLICK_WINDOW_MS + 30);
  } else {
    clearClickSuppression();
  }

  drag = null;
  if (moved) event.stopPropagation();
}

const app = document.getElementById("app");
if (app) {
  app.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const hand = event.target.closest?.(HAND_SELECTOR);
    if (!hand) return;

    clearClickSuppression();
    event.stopPropagation();

    if (!syncHandOverflow(hand)) {
      drag = null;
      return;
    }

    drag = {
      hand,
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: hand.scrollLeft,
      maxScroll: maxLayoutScroll(hand),
      moved: false,
    };
  });

  app.addEventListener("animationend", (event) => {
    if (event.animationName === "harmony-card-draw-reveal")
      event.target.classList?.remove("card-drawing");
    if (event.target.closest?.(HAND_SELECTOR)) queueHandSync();
  });
  app.addEventListener("transitionend", (event) => {
    if (event.target.closest?.(HAND_SELECTOR)) queueHandSync();
  });
  app.addEventListener(
    "scroll",
    (event) => {
      const hand = event.target.closest?.(HAND_SELECTOR);
      if (hand) clampHandScroll(hand);
    },
    true,
  );
}

window.addEventListener("pointermove", (event) => {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const distance = event.clientX - drag.startX;
  if (!drag.moved && Math.abs(distance) < DRAG_THRESHOLD) return;

  if (!drag.moved) {
    drag.moved = true;
    try {
      drag.hand.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is only an assist; dragging still works without it.
    }
    drag.hand.classList.add("mouse-drag-scroll", "is-mouse-dragging");
  }

  const liveMax = maxLayoutScroll(drag.hand);
  drag.maxScroll = liveMax;
  drag.hand.scrollLeft = Math.min(
    liveMax,
    Math.max(0, drag.startScrollLeft - distance),
  );
  event.preventDefault();
  event.stopPropagation();
});

window.addEventListener("pointerup", (event) => finishDrag(event));
window.addEventListener("pointercancel", (event) => finishDrag(event, true));

window.addEventListener(
  "click",
  (event) => {
    if (!suppressClickFor) return;
    const withinWindow = performance.now() <= suppressClickUntil,
      shouldSuppress = withinWindow && suppressClickFor.contains(event.target);
    clearClickSuppression();
    if (!shouldSuppress) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  },
  true,
);

const style = document.createElement("style");
style.textContent = `
  .battle > .hand.hand-no-real-overflow {
    overflow-x: hidden !important;
    overscroll-behavior-x: none !important;
    scroll-snap-type: none !important;
  }
`;
document.head.append(style);

window.addEventListener("resize", queueHandSync);
