import { loadGame } from "./persistence.js";

const app = document.getElementById("app");
const deckRoot = document.getElementById("run-deck-list");
const dialog = document.getElementById("run-summary");

let lastSnapshot = null;
let syncQueued = false;
let toastTimer = null;
let toastQueue = [];

function currentRun() {
  try {
    return loadGame(localStorage).run;
  } catch {
    return null;
  }
}

function impurityCount(run) {
  return Array.isArray(run?.deck)
    ? run.deck.reduce((count, card) => count + (card?.id === "impurity" ? 1 : 0), 0)
    : 0;
}

function pendingImpurityCount(run) {
  return Math.max(0, Number(run?.pendingImpurities) || 0);
}

function snapshotOf(run) {
  if (!run) return null;
  return {
    runKey: `${run.seed ?? "none"}:${run.version ?? "none"}`,
    deckCount: impurityCount(run),
    pendingCount: pendingImpurityCount(run),
    deckSize: Array.isArray(run.deck) ? run.deck.length : 0,
  };
}

function ensureToast() {
  let toast = document.querySelector(".impurity-change-toast");
  if (toast) return toast;
  toast = document.createElement("div");
  toast.className = "impurity-change-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.hidden = true;
  document.body.append(toast);
  return toast;
}

function playNextToast() {
  if (toastTimer || !toastQueue.length) return;
  const toast = ensureToast(),
    message = toastQueue.shift();
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.remove("impurity-change-toast-show");
  // Restart the entrance animation even when two impurity changes happen close together.
  void toast.offsetWidth;
  toast.classList.add("impurity-change-toast-show");
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("impurity-change-toast-show");
    window.setTimeout(() => {
      toast.hidden = true;
      toastTimer = null;
      playNextToast();
    }, 180);
  }, 1850);
}

function queueToast(message) {
  if (!message) return;
  toastQueue.push(message);
  playNextToast();
}

function notifyChanges(next) {
  if (!next) {
    lastSnapshot = null;
    return;
  }
  if (!lastSnapshot || lastSnapshot.runKey !== next.runKey) {
    lastSnapshot = next;
    return;
  }

  const deckDelta = next.deckCount - lastSnapshot.deckCount,
    pendingDelta = next.pendingCount - lastSnapshot.pendingCount;

  if (deckDelta > 0) {
    queueToast(
      `☣ 불순물 +${deckDelta} · 덱의 불순물 ${lastSnapshot.deckCount} → ${next.deckCount}장`,
    );
  }
  if (pendingDelta > 0) {
    queueToast(
      `☣ 불순물 예정 +${pendingDelta} · 다음 전투에 ${next.pendingCount}장`,
    );
  }

  lastSnapshot = next;
}

function syncDeckButton(snapshot) {
  document.querySelectorAll(".run-summary-button").forEach((button) => {
    let badge = button.querySelector(":scope > .impurity-deck-button-badge");
    const visible = snapshot && (snapshot.deckCount > 0 || snapshot.pendingCount > 0);
    if (!visible) {
      badge?.remove();
      button.classList.remove("has-impurity-count");
      return;
    }

    if (!badge) {
      badge = document.createElement("span");
      badge.className = "impurity-deck-button-badge";
      badge.setAttribute("aria-hidden", "true");
      button.append(badge);
    }

    badge.replaceChildren();
    const owned = document.createElement("b");
    owned.textContent = `☣ ${snapshot.deckCount}`;
    badge.append(owned);
    if (snapshot.pendingCount > 0) {
      const pending = document.createElement("small");
      pending.textContent = `예정 +${snapshot.pendingCount}`;
      badge.append(pending);
    }
    button.classList.add("has-impurity-count");
    button.setAttribute(
      "aria-description",
      `덱의 불순물 ${snapshot.deckCount}장${snapshot.pendingCount ? `, 다음 전투 예정 ${snapshot.pendingCount}장` : ""}`,
    );
  });
}

function syncDeckSummary(snapshot) {
  if (!deckRoot) return;
  let strip = deckRoot.querySelector(":scope > .impurity-deck-summary");
  if (!snapshot) {
    strip?.remove();
    return;
  }

  if (!strip) {
    strip = document.createElement("div");
    strip.className = "impurity-deck-summary";
    deckRoot.prepend(strip);
  }

  strip.innerHTML = `
    <span><b>덱 ${snapshot.deckSize}장</b></span>
    <span class="impurity-deck-summary-owned">☣ 불순물 <b>${snapshot.deckCount}장</b></span>
    ${snapshot.pendingCount > 0
      ? `<span class="impurity-deck-summary-pending">다음 전투 예정 <b>+${snapshot.pendingCount}장</b></span>`
      : ""}
  `;
}

function sync() {
  syncQueued = false;
  const run = currentRun(),
    snapshot = snapshotOf(run);
  notifyChanges(snapshot);
  syncDeckButton(snapshot);
  syncDeckSummary(snapshot);
}

function queueSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(sync);
}

if (app) {
  new MutationObserver(queueSync).observe(app, { childList: true, subtree: true });
}
if (deckRoot) {
  new MutationObserver(queueSync).observe(deckRoot, { childList: true, subtree: true });
}
dialog?.addEventListener("toggle", queueSync);
document.addEventListener("click", queueSync, true);
window.addEventListener("storage", queueSync);
queueSync();
