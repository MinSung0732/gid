const HAND_SELECTOR = ".battle > .hand";
const DRAG_THRESHOLD = 12;
const OVERFLOW_EPSILON = 3;

let drag = null;
let suppressClickFor = null;
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

function hasRealHorizontalOverflow(hand) {
  if (!hand || hand.clientWidth <= 0) return false;

  // Do not use getBoundingClientRect()/scrollWidth here. Draw animations,
  // hover transforms, glows, tooltips and impurity FX can temporarily enlarge
  // those visual measurements even when every card still fits in the hand.
  // offsetWidth + flex gap measures the actual layout width and is unaffected
  // by those transforms, so patches that add UI effects cannot re-enable swipe.
  return laidOutHandWidth(hand) > hand.clientWidth + OVERFLOW_EPSILON;
}

function syncHandOverflow(hand) {
  const overflowing = hasRealHorizontalOverflow(hand);
  hand.classList.toggle("hand-has-real-overflow", overflowing);
  hand.classList.toggle("hand-no-real-overflow", !overflowing);
  if (!overflowing && Math.abs(hand.scrollLeft) > 0.5) hand.scrollLeft = 0;
  return overflowing;
}

function syncAllHands() {
  document.querySelectorAll(HAND_SELECTOR).forEach(syncHandOverflow);
}

function queueHandSync() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    syncAllHands();
  });
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
  suppressClickFor = !cancelled && moved ? hand : null;
  drag = null;

  // A normal click must receive its pointerup. Only an actual drag gesture is
  // consumed; this keeps card play reliable even when the hand really does
  // overflow and the user simply clicks a card without dragging it.
  if (moved) event.stopPropagation();
}

// main.js also has a generic mouse-drag helper. Capture hand pointerdown at the
// window so that generic scrollWidth-based logic never owns battle-hand input.
// This dedicated handler enables dragging only for genuine layout overflow.
window.addEventListener(
  "pointerdown",
  (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const hand = event.target.closest?.(HAND_SELECTOR);
    if (!hand) return;

    suppressClickFor = null;
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
      moved: false,
    };
  },
  true,
);

window.addEventListener(
  "pointermove",
  (event) => {
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

    drag.hand.scrollLeft = drag.startScrollLeft - distance;
    event.preventDefault();
    event.stopPropagation();
  },
  true,
);

window.addEventListener("pointerup", (event) => finishDrag(event), true);
window.addEventListener("pointercancel", (event) => finishDrag(event, true), true);

window.addEventListener(
  "click",
  (event) => {
    if (!suppressClickFor) return;
    const shouldSuppress = suppressClickFor.contains(event.target);
    suppressClickFor = null;
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

const app = document.getElementById("app");
if (app) {
  new MutationObserver(queueHandSync).observe(app, { childList: true, subtree: true });
  app.addEventListener("animationend", (event) => {
    if (event.target.closest?.(HAND_SELECTOR)) queueHandSync();
  });
  app.addEventListener("transitionend", (event) => {
    if (event.target.closest?.(HAND_SELECTOR)) queueHandSync();
  });
  queueHandSync();
}
window.addEventListener("resize", queueHandSync);
