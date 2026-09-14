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

function combatPiles(run) {
  const battle = run?.battle;
  if (!battle) return [];
  return [battle.draw, battle.hand, battle.discard].filter(Array.isArray);
}

function combatImpurityCount(run) {
  return combatPiles(run).reduce((total, pile) => total + countImpurities(pile), 0);
}

function combatDeckSize(run) {
  return combatPiles(run).reduce((total, pile) => total + pile.length, 0);
}

function pendingImpurityCount(run) {
  return Math.max(0, Number(run?.pendingImpurities) || 0);
}

function latestInjectionLog(run) {
  const entry = Array.isArray(run?.log)
    ? run.log.find((line) => /불순물\s+\d+장\s+주입/.test(line))
    : null;
  if (!entry) return null;
  const amount = Number(entry.match(/불순물\s+(\d+)장\s+주입/)?.[1] || 0);
  return amount > 0 ? { entry, amount } : null;
}

function snapshotOf(run) {
  if (!run) return null;
  const inBattle = run.phase === "battle" && Boolean(run.battle),
    injection = inBattle ? latestInjectionLog(run) : null;
  return {
    runKey: `${run.seed ?? "none"}:${run.version ?? "none"}`,
    battleKey: inBattle ? `${run.seed ?? "none"}:${run.loop ?? 0}:${run.node ?? 0}` : null,
    deckCount: impurityCount(run),
    combatCount: inBattle ? combatImpurityCount(run) : 0,
    combatDeckSize: inBattle ? combatDeckSize(run) : 0,
    pendingCount: pendingImpurityCount(run),
    deckSize: Array.isArray(run.deck) ? run.deck.length : 0,
    injectionLog: injection?.entry || null,
    injectionAmount: injection?.amount || 0,
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
    combatDelta = sameBattle ? next.combatCount - lastSnapshot.combatCount : 0,
    newInjectionLog = sameBattle && next.injectionLog && next.injectionLog !== lastSnapshot.injectionLog;

  if (combatDelta > 0) {
    showInjectionFeedback(combatDelta, next.combatCount);
  } else if (newInjectionLog) {
    // The combat renderer and save can land in either order. The battle log is
    // a second source of truth so an enemy pollution action still gets visible
    // feedback even if the pile delta was observed between two UI syncs.
    showInjectionFeedback(next.injectionAmount, next.combatCount);
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

  const signature = `${snapshot.deckSize}:${snapshot.deckCount}:${snapshot.combatDeckSize}:${snapshot.combatCount}:${snapshot.pendingCount}:${snapshot.inBattle}`;
  if (!strip) {
    strip = document.createElement("div");
    strip.className = "impurity-deck-summary";
    deckRoot.prepend(strip);
  }
  if (strip.dataset.impuritySignature === signature) return;
  strip.dataset.impuritySignature = signature;

  const sizeMarkup = snapshot.inBattle
    ? `<span><b>전투 덱 ${snapshot.combatDeckSize}장</b></span><span class="impurity-deck-summary-base">원본 덱 <b>${snapshot.deckSize}장</b></span>`
    : `<span><b>덱 ${snapshot.deckSize}장</b></span>`;
  const impurityMarkup = snapshot.inBattle
    ? `<span class="impurity-deck-summary-owned">☣ 불순물 <b>${snapshot.combatCount}장</b></span>`
    : `<span class="impurity-deck-summary-owned">☣ 불순물 <b>${snapshot.deckCount}장</b></span>`;

  strip.innerHTML = `
    ${sizeMarkup}
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
// Enemy actions can update the saved battle state between visual rerenders.
// A lightweight poll makes impurity count/feedback independent from unrelated
// DOM mutations and prevents future UI patches from breaking this indicator.
window.setInterval(queueSync, 250);
queueSync();
