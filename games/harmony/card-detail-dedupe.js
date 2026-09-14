const CARD_SELECTOR = ".card.card-compact-status";

// cardEffectText() uses " · " as a compact separator. Some compound rules are
// later split into separate semantic rules even though compactCardEffectSummary()
// already writes one complete detailed sentence for the same mechanic. Keep the
// useful detailed sentence and remove only those leftover generic fragments.
const ORPHAN_DETAIL_RULES = [
  {
    summary: "다음 2장 흡수",
    patterns: [
      /\s*<span class="detail-absorb">흡수<\/span>\s*획득\s*<b[^>]*>\+?\d+(?:\.\d+)?<\/b>\s*효과가 적용됩니다\.\s*/g,
    ],
  },
  {
    summary: "서치 카드",
    patterns: [
      /\s*손패가 가득 차면 유지 효과가 적용됩니다\.\s*/g,
    ],
  },
  {
    summary: "오일 비용",
    patterns: [
      /\s*최소\s*<b[^>]*>0<\/b>\s*효과가 적용됩니다\.\s*/g,
    ],
  },
  {
    summary: "위축",
    patterns: [
      /\s*피해량\s*<b[^>]*>\+?\d+(?:\.\d+)?<\/b>\s*감소 효과가 적용됩니다\.\s*/g,
      /\s*<b[^>]*>1턴<\/b>\s*효과가 적용됩니다\.\s*/g,
    ],
  },
];

const FLOOR_DETAIL_RULES = [
  {
    summary: "오일 비용",
    alreadyExplained: /(0 아래로 내려가지|최소\s*0)/,
    sentence: " 카드 AP 비용은 최소 0입니다.",
  },
  {
    summary: "피해 경감",
    alreadyExplained: /(피해[^.]*최소\s*0|피해[^.]*0 아래로 내려가지)/,
    sentence: " 플레이어가 받는 피해는 최소 0입니다.",
  },
  {
    summary: "위축",
    alreadyExplained: /(직접 피해[^.]*최소\s*0|직접 피해[^.]*0 아래로 내려가지)/,
    sentence: " 위축으로 감소한 직접 피해는 최소 0입니다.",
  },
];

let syncQueued = false;

function cleanupCardDetail(card) {
  if (!card || card.dataset.detailDedupeDone === "1") return;

  const summary = card.querySelector(".card-effect-main"),
    tooltip = card.querySelector(".card-effect-tooltip");
  if (!summary || !tooltip) return;

  const summaryText = summary.textContent,
    before = tooltip.innerHTML;
  let next = before;

  for (const rule of ORPHAN_DETAIL_RULES) {
    if (!summaryText.includes(rule.summary)) continue;
    for (const pattern of rule.patterns) next = next.replace(pattern, " ");
  }

  const plainDetail = () => {
    const probe = document.createElement("div");
    probe.innerHTML = next;
    return probe.textContent || "";
  };

  for (const rule of FLOOR_DETAIL_RULES) {
    if (!summaryText.includes(rule.summary)) continue;
    if (!rule.alreadyExplained.test(plainDetail())) next += rule.sentence;
  }

  if (next !== before) tooltip.innerHTML = next.replace(/\s{2,}/g, " ").trim();
  card.dataset.detailDedupeDone = "1";
}

function syncCardDetails(root = document) {
  root.querySelectorAll?.(CARD_SELECTOR).forEach(cleanupCardDetail);
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
