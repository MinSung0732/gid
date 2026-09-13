const PRESERVED_SCROLL_SELECTORS = [
  ".hand",
  ".battle-info",
  ".turn-order",
  ".enemies-field",
  ".discard-preview-cards",
  ".atelier-products",
  ".card-reward-choices",
  ".rest-card-choices",
  ".summary-card-grid",
  ".summary-item-grid",
  ".builder-selected",
  ".builder-pool",
  ".deck-replace-filters",
  ".deck-replace-grid",
  ".stat-grid",
  ".acquired-list",
  ".deck-card-picker-grid",
  ".deck-card-picker-detail",
  ".run-summary-body",
  ".collection[open]",
];

const scrollMemory = new Map();
const MEMORY_TTL = 4000;
let restoreQueued = false;
let restoring = false;

function memoryKey(selector, index) {
  return `${selector}::${index}`;
}

function isScrollable(element) {
  return (
    element.scrollWidth > element.clientWidth + 1 ||
    element.scrollHeight > element.clientHeight + 1 ||
    element.scrollLeft !== 0 ||
    element.scrollTop !== 0
  );
}

function rememberElement(selector, element, index) {
  if (!element || !isScrollable(element)) return;
  scrollMemory.set(memoryKey(selector, index), {
    left: element.scrollLeft,
    top: element.scrollTop,
    at: performance.now(),
  });
}

function rememberAllScrollAreas() {
  if (restoring) return;
  PRESERVED_SCROLL_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element, index) => {
      rememberElement(selector, element, index);
    });
  });
}

function restoreElement(element, saved) {
  const maxLeft = Math.max(0, element.scrollWidth - element.clientWidth);
  const maxTop = Math.max(0, element.scrollHeight - element.clientHeight);
  const left = Math.min(saved.left, maxLeft);
  const top = Math.min(saved.top, maxTop);
  if (Math.abs(element.scrollLeft - left) > 0.5) element.scrollLeft = left;
  if (Math.abs(element.scrollTop - top) > 0.5) element.scrollTop = top;
}

function restoreAllScrollAreas({ pruneMissing = false } = {}) {
  const now = performance.now();
  restoring = true;
  try {
    PRESERVED_SCROLL_SELECTORS.forEach((selector) => {
      const elements = [...document.querySelectorAll(selector)];
      let hadFreshMemory = false;
      elements.forEach((element, index) => {
        const key = memoryKey(selector, index);
        const saved = scrollMemory.get(key);
        if (!saved) return;
        if (now - saved.at > MEMORY_TTL) {
          scrollMemory.delete(key);
          return;
        }
        hadFreshMemory = true;
        restoreElement(element, saved);
      });

      // If a rerender leaves this view entirely, forget its old scroll so a
      // later, unrelated room/battle never inherits a stale position.
      if (pruneMissing && !elements.length && hadFreshMemory === false) {
        for (const key of [...scrollMemory.keys()]) {
          if (key.startsWith(`${selector}::`)) scrollMemory.delete(key);
        }
      }
    });
  } finally {
    restoring = false;
  }
}

function queueRestore() {
  if (restoreQueued) return;
  restoreQueued = true;
  queueMicrotask(() => {
    restoreAllScrollAreas();
    requestAnimationFrame(() => {
      restoreAllScrollAreas();
      requestAnimationFrame(() => {
        restoreQueued = false;
        restoreAllScrollAreas({ pruneMissing: true });
      });
    });
  });
}

// Capture before click handlers mutate state and replace #app contents.
document.addEventListener("pointerdown", rememberAllScrollAreas, true);
document.addEventListener("click", rememberAllScrollAreas, true);
document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") rememberAllScrollAreas();
}, true);

// Native scroll events do not bubble, but they are observable in capture mode.
document.addEventListener(
  "scroll",
  (event) => {
    if (restoring || !(event.target instanceof Element)) return;
    for (const selector of PRESERVED_SCROLL_SELECTORS) {
      if (!event.target.matches(selector)) continue;
      const elements = [...document.querySelectorAll(selector)];
      const index = elements.indexOf(event.target);
      if (index >= 0) rememberElement(selector, event.target, index);
      break;
    }
  },
  true,
);

new MutationObserver(queueRestore).observe(document.body, {
  childList: true,
  subtree: true,
});
