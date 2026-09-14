const HAND_SELECTOR = ".battle > .hand";
const DRAG_THRESHOLD = 12;
const OVERFLOW_EPSILON = 3;

let drag = null;
let suppressClickFor = null;
let refreshQueued = false;

function handCards(hand) {
  return [...hand.children].filter((element) => element.classList?.contains("card"));
}

function hasRealHorizontalOverflow(hand) {
  const cards = handCards(hand);
  if (!cards.length || hand.clientWidth <= 0) return false;

  const handRect = hand.getBoundingClientRect(),
    rects = cards.map((card) => card.getBoundingClientRect()),
    left = Math.min(...rects.map((rect) => rect.left)),
    right = Math.max(...rects.map((rect) => rect.right)),
    cardSpan = right - left;

  // Only the laid-out card span decides whether the hand needs horizontal
  // drag. Tooltips, disabled overlays, glow rings and draw FX can extend the
  // element's scrollWidth even while every actual card still fits. Using only
  // the span also means an old non-zero scrollLeft cannot create a false
  // overflow reading after a rerender.
  return cardSpan > handRect.width + OVERFLOW_EPSILON;
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
  event.stopPropagation();
}

// main.js also has a generic mouse-drag helper. Capture hand gestures at the
// window first so the hand uses this stricter implementation instead: drag is
// enabled only for genuine card overflow and requires deliberate movement.
window.addEventListener(
  "pointerdown",
  (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const hand = event.target.closest?.(HAND_SELECTOR);
    if (!hand) return;

    // A new press always belongs to a new gesture; never let the previous drag
    // swallow an intentional card click.
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
  queueHandSync();
}
window.addEventListener("resize", queueHandSync);
