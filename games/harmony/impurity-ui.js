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

function countImpurities(cards) {
  return Array.isArray(cards)
    ? cards.reduce((count, card) => count + (card?.id === "impurity" ? 1 : 0), 0)
    : 0;
}

function impurityCount(run) {
  return countImpurities(run?.deck);
}

function combatImpurityCount(run) {
  const battle = run?.phase === "battle" ? run.battle : null;
  if (!battle) return 0;
  // Exhausted impurities have already left circulation. Everything still in
  // draw/hand/discard is part of the current battle deck and should be visible
  // to the player, including monster-injected impurities.
  return (
    countImpurities(battle.draw) +
    countImpurities(battle.hand) +
    countImpurities(battle.discard)
  );
}

function pendingImpurityCount(run) {
  return Math.max(0, Number(run?.pendingImpurities) || 0);
}

function snapshotOf(run) {
  if (!run) return null;
  const inBattle = run.phase === "battle" && Boolean(run.battle);
  return {
    runKey: `${run.seed ?? "none"}:${run.version ?? "none"}`,
    battleKey: inBattle ? `${run.seed ?? "none"}:${run.loop ?? 0}:${run.node ?? 0}` : null,
    deckCount: impurityCount(run),
    combatCount: combatImpurityCount(run),
    pendingCount: pendingImpurityCount(run),
    deckSize: Array.isArray(run.deck) ? run.deck.length : 0,
    inBattle,
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

function showInjectionFeedback(amount, total) {
  if (amount <= 0) return;
  const discard = document.querySelector(".battle .discard-pile-trigger");
  if (discard) {
    discard.classList.remove("impurity-injected");
    void discard.offsetWidth;
    discard.classList.add("impurity-injected");
    window.setTimeout(() => discard.classList.remove("impurity-injected"), 760);

    const rect = discard.getBoundingClientRect(),
      popup = document.createElement("strong");
    popup.className = "impurity-injection-pop";
    popup.textContent = `☣ +${amount}`;
    popup.style.left = `${rect.left + rect.width / 2}px`;
    popup.style.top = `${Math.max(12, rect.top - 4)}px`;
    document.body.append(popup);
    popup.addEventListener("animationend", () => popup.remove(), { once: true });
    window.setTimeout(() => popup.remove(), 1200);
  }

  queueToast(`☣ 불순물 +${amount} 주입 · 현재 전투 불순물 ${total}장`);
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
    pendingDelta = next.pendingCount - lastSnapshot.pendingCount,
    sameBattle = Boolean(next.battleKey && next.battleKey === lastSnapshot.battleKey),
    combatDelta = sameBattle ? next.combatCount - lastSnapshot.combatCount : 0;

  if (combatDelta > 0) {
    showInjectionFeedback(combatDelta, next.combatCount);
  } else if (deckDelta > 0) {
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

function displayImpurityCount(snapshot) {
  return snapshot?.inBattle ? snapshot.combatCount : snapshot?.deckCount || 0;
}

function syncDeckButton(snapshot) {
  document.querySelectorAll(".run-summary-button").forEach((button) => {
    let badge = button.querySelector(":scope > .impurity-deck-button-badge");
    const shownCount = displayImpurityCount(snapshot),
      visible = snapshot && (shownCount > 0 || snapshot.pendingCount > 0);
    if (!visible) {
      if (badge) badge.remove();
      button.classList.remove("has-impurity-count");
      button.removeAttribute("aria-description");
      return;
    }

    const signature = `${snapshot.inBattle ? "battle" : "deck"}:${shownCount}:${snapshot.pendingCount}`,
      description = snapshot.inBattle
        ? `현재 전투 불순물 ${shownCount}장${snapshot.pendingCount ? `, 다음 전투 예정 ${snapshot.pendingCount}장` : ""}`
        : `덱의 불순물 ${shownCount}장${snapshot.pendingCount ? `, 다음 전투 예정 ${snapshot.pendingCount}장` : ""}`;

    if (!badge) {
      badge = document.createElement("span");
      badge.className = "impurity-deck-button-badge";
      badge.setAttribute("aria-hidden", "true");
      button.append(badge);
    }

    if (badge.dataset.impuritySignature !== signature) {
      badge.dataset.impuritySignature = signature;
      badge.replaceChildren();
      const owned = document.createElement("b");
      owned.textContent = `☣ ${shownCount}`;
      badge.append(owned);
      if (snapshot.pendingCount > 0) {
        const pending = document.createElement("small");
        pending.textContent = `예정 +${snapshot.pendingCount}`;
        badge.append(pending);
      }
    }
    button.classList.add("has-impurity-count");
    if (button.getAttribute("aria-description") !== description)
      button.setAttribute("aria-description", description);
  });
}

function syncDeckSummary(snapshot) {
  if (!deckRoot) return;
  let strip = deckRoot.querySelector(":scope > .impurity-deck-summary");
  if (!snapshot) {
    if (strip) strip.remove();
    return;
  }

  const signature = `${snapshot.deckSize}:${snapshot.deckCount}:${snapshot.combatCount}:${snapshot.pendingCount}:${snapshot.inBattle}`;
  if (!strip) {
    strip = document.createElement("div");
    strip.className = "impurity-deck-summary";
    deckRoot.prepend(strip);
  }
  if (strip.dataset.impuritySignature === signature) return;
  strip.dataset.impuritySignature = signature;

  const impurityMarkup = snapshot.inBattle
    ? `<span class="impurity-deck-summary-owned">☣ 현재 전투 불순물 <b>${snapshot.combatCount}장</b></span>${snapshot.deckCount !== snapshot.combatCount ? `<span class="impurity-deck-summary-base">기본 덱 <b>${snapshot.deckCount}장</b></span>` : ""}`
    : `<span class="impurity-deck-summary-owned">☣ 불순물 <b>${snapshot.deckCount}장</b></span>`;

  strip.innerHTML = `
    <span><b>덱 ${snapshot.deckSize}장</b></span>
    ${impurityMarkup}
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
