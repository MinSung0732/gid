const CARD_SELECTOR = ".card.card-compact-status";
const BOOSTER_SUMMARY_LABEL = "다음 2장 흡수";
const BOOSTER_DETAIL_SENTENCE = /\s*이번 턴 다음 <b[^>]*>2장<\/b>의 카드가 얻는 <span[^>]*>흡수<\/span>를 각각 <b[^>]*>[^<]+<\/b> 증가시킵니다\.\s*/g;

let syncQueued = false;

function dedupeCardDetail(card) {
  if (!card || card.dataset.detailDedupeDone === "1") return;

  const summary = card.querySelector(".card-effect-main"),
    tooltip = card.querySelector(".card-effect-tooltip");
  if (!summary || !tooltip) return;

  // The compact summary already communicates the full absorb-booster rule
  // ("다음 2장 흡수 +N"). Repeating the same rule as the final prose sentence
  // makes primer cards read as if they have two separate +N effects.
  if (summary.textContent.includes(BOOSTER_SUMMARY_LABEL)) {
    const next = tooltip.innerHTML.replace(BOOSTER_DETAIL_SENTENCE, " ").trim();
    if (next !== tooltip.innerHTML) tooltip.innerHTML = next;
  }

  card.dataset.detailDedupeDone = "1";
}

function syncCardDetails(root = document) {
  root.querySelectorAll?.(CARD_SELECTOR).forEach(dedupeCardDetail);
}

function queueSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    syncCardDetails();
  });
}

const app = document.getElementById("app");
if (app) new MutationObserver(queueSync).observe(app, { childList: true, subtree: true });

const runSummary = document.getElementById("run-summary");
if (runSummary) new MutationObserver(queueSync).observe(runSummary, { childList: true, subtree: true });

syncCardDetails();
