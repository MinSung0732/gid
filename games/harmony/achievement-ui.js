import { fetchAchievementSummary } from "./achievement-service.js";

export const ACHIEVEMENT_RARITY_THRESHOLDS = Object.freeze([
  Object.freeze({ min: 50, label: "흔함", key: "common" }),
  Object.freeze({ min: 20, label: "보통", key: "uncommon" }),
  Object.freeze({ min: 5, label: "희귀", key: "rare" }),
  Object.freeze({ min: 1, label: "매우 희귀", key: "very-rare" }),
  Object.freeze({ min: 0, label: "전설적", key: "legendary" }),
]);

const TYPE_ICONS = Object.freeze({
  card: "▱",
  trait: "✦",
  relic: "◇",
  boss: "♛",
});

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function rewardLabel(kind) {
  if (kind === "card") return "카드 해금";
  if (kind === "item") return "증강 해금";
  if (kind === "title") return "칭호";
  if (kind === "profile") return "프로필 장식";
  return "보상";
}

function rewardsFromUnlock(unlock, items, cards) {
  const rewards = [];
  if (unlock.item)
    rewards.push({ kind: "item", id: unlock.item, label: items[unlock.item]?.name || unlock.item });
  if (unlock.card)
    rewards.push({ kind: "card", id: unlock.card, label: cards[unlock.card]?.name || unlock.card });
  return rewards;
}

function localAchievementRows({ unlocks, items, cards, meta }) {
  const unlocked = new Set(meta?.unlocked || []);
  return unlocks
    .filter((entry) => !entry.legacy)
    .map((entry, index) => ({
      achievementId: entry.id,
      name: entry.name,
      description: entry.goal,
      icon: entry.icon || TYPE_ICONS[entry.type] || "◇",
      reward: rewardsFromUnlock(entry, items, cards),
      hidden: Boolean(entry.hidden),
      hideReward: Boolean(entry.hideReward),
      sortOrder: Number(entry.sortOrder) || index + 1,
      unlocked: unlocked.has(entry.id),
      unlockedAt: null,
      clearCount: null,
      eligiblePlayerCount: null,
      clearRate: null,
    }));
}

export function normalizeAchievementRows({
  rows,
  unlocks,
  items,
  cards,
  meta,
  authenticated = false,
}) {
  const fallback = localAchievementRows({ unlocks, items, cards, meta }),
    fallbackById = new Map(fallback.map((entry) => [entry.achievementId, entry])),
    localUnlocked = new Set(meta?.unlocked || []);
  if (!Array.isArray(rows) || !rows.length) return fallback;

  return rows.map((row, index) => {
    const achievementId = row.achievement_id || row.achievementId,
      local = fallbackById.get(achievementId) || {};
    return {
      achievementId,
      name: row.name || local.name || achievementId,
      description: row.description || local.description || "",
      icon: row.icon || local.icon || "◇",
      reward: Array.isArray(row.reward) ? row.reward : local.reward || [],
      hidden: Boolean(row.hidden),
      hideReward: Boolean(row.hide_reward ?? row.hideReward),
      sortOrder: Number(row.sort_order ?? row.sortOrder) || local.sortOrder || index + 1,
      unlocked: authenticated ? Boolean(row.unlocked || localUnlocked.has(achievementId)) : localUnlocked.has(achievementId),
      unlockedAt: authenticated ? row.unlocked_at || row.unlockedAt || null : null,
      clearCount: Number.isFinite(Number(row.clear_count ?? row.clearCount)) ? Number(row.clear_count ?? row.clearCount) : null,
      eligiblePlayerCount: Number.isFinite(Number(row.eligible_player_count ?? row.eligiblePlayerCount))
        ? Number(row.eligible_player_count ?? row.eligiblePlayerCount)
        : null,
      clearRate: row.clear_rate === null || row.clearRate === null
        ? null
        : Number.isFinite(Number(row.clear_rate ?? row.clearRate))
          ? Number(row.clear_rate ?? row.clearRate)
          : null,
    };
  });
}

export function rarityForRate(clearRate) {
  if (!Number.isFinite(clearRate)) return { label: "집계 전", key: "pending" };
  const rate = Math.max(0, Math.min(100, clearRate));
  return ACHIEVEMENT_RARITY_THRESHOLDS.find((entry) => rate >= entry.min) || ACHIEVEMENT_RARITY_THRESHOLDS.at(-1);
}

export function formatClearRate(clearRate) {
  if (!Number.isFinite(clearRate)) return "-";
  const rate = Math.max(0, Math.min(100, clearRate));
  return `${Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(1)}%`;
}

export function filterAndSortAchievements(entries, filter = "all") {
  const filtered = entries.filter((entry) => {
    if (filter === "unlocked") return entry.unlocked;
    if (filter === "locked") return !entry.unlocked;
    if (filter === "rare") return Number.isFinite(entry.clearRate) && entry.clearRate < 20;
    return true;
  });
  return filtered.sort((left, right) => {
    if (filter === "rare" && left.clearRate !== right.clearRate)
      return left.clearRate - right.clearRate;
    if (left.unlocked !== right.unlocked) return left.unlocked ? -1 : 1;
    return left.sortOrder - right.sortOrder;
  });
}

function unlockedDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date);
}

function rewardsMarkup(entry) {
  if (!entry.unlocked && entry.hideReward)
    return '<span class="achievement-reward-secret">보상 ???</span>';
  if (!entry.reward.length)
    return '<span class="achievement-reward-none">추가 해금 보상 없음</span>';
  return entry.reward.map((reward) =>
    `<span><small>${rewardLabel(reward.kind)}</small><strong>${escapeHtml(reward.label || reward.id || "보상")}</strong></span>`,
  ).join("");
}

export function achievementCardHtml(entry) {
  const locked = !entry.unlocked,
    rarity = rarityForRate(entry.clearRate),
    date = unlockedDate(entry.unlockedAt),
    name = locked ? "???" : entry.name,
    description = locked ? "???" : entry.description,
    rate = formatClearRate(entry.clearRate),
    counts = Number.isFinite(entry.eligiblePlayerCount) && entry.eligiblePlayerCount > 0
      ? `${entry.clearCount.toLocaleString("ko-KR")} / ${entry.eligiblePlayerCount.toLocaleString("ko-KR")}`
      : "집계 전";
  return `<article class="achievement-card ${locked ? "locked" : "unlocked"} rarity-${rarity.key}" data-achievement-id="${escapeHtml(entry.achievementId)}">
    <div class="achievement-card-head"><span class="achievement-icon" aria-hidden="true">${locked ? "🔒" : escapeHtml(entry.icon)}</span><span class="achievement-state">${locked ? "미달성" : "달성 완료"}</span></div>
    <h3>${escapeHtml(name)}</h3><p class="achievement-description">${escapeHtml(description)}</p>
    <div class="achievement-rewards"><b>보상</b>${rewardsMarkup(entry)}</div>
    <footer><span title="전체 Harmony 플레이어 ${counts}">달성률 ${rate}</span><b>${rarity.label}</b>${date ? `<time datetime="${escapeHtml(entry.unlockedAt)}">서버 기록 ${date}</time>` : ""}</footer>
  </article>`;
}

function identityText(runtime) {
  if (!runtime?.user) return "비회원으로 진행중입니다";
  const name = runtime.profile?.display_name || runtime.user.user_metadata?.name || runtime.user.email || "Harmony 회원";
  return `프로필 · ${name}님 환영합니다`;
}

export function createAchievementUi({
  unlocks,
  items,
  cards,
  getMeta,
  runtime = typeof window === "undefined" ? null : window.HarmonyRuntime,
  fetchSummary = fetchAchievementSummary,
  getElement = (id) => document.getElementById(id),
} = {}) {
  let entries = [],
    filter = "all",
    loaded = false,
    loading = null,
    loadWarning = "";

  function renderIdentity() {
    const identity = getElement("header-profile");
    if (identity) identity.textContent = identityText(runtime);
  }

  function render() {
    const completed = entries.filter((entry) => entry.unlocked).length,
      total = entries.length,
      percent = total ? Math.round(completed * 100 / total) : 0,
      visible = filterAndSortAchievements(entries, filter),
      summary = getElement("achievement-summary"),
      grid = getElement("achievement-grid"),
      status = getElement("achievement-status");
    if (summary)
      summary.innerHTML = `<div><span>개인 달성도</span><strong>${completed} / ${total}</strong></div><div class="achievement-progress" role="progressbar" aria-label="도전과제 달성도" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div><small>${percent}% 완료</small>`;
    if (status) {
      status.textContent = loadWarning || `${visible.length}개의 도전과제`;
      status.dataset.state = loadWarning ? "warning" : "ready";
    }
    if (grid)
      grid.innerHTML = visible.map(achievementCardHtml).join("") || '<p class="achievement-empty">조건에 맞는 도전과제가 없습니다.</p>';
    getElement("achievement-filters")?.querySelectorAll?.("[data-achievement-filter]").forEach((button) => {
      const selected = button.dataset.achievementFilter === filter;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  async function load() {
    if (loaded) return;
    if (loading) return loading;
    const status = getElement("achievement-status");
    if (status) {
      status.textContent = "도전과제 기록을 불러오는 중입니다.";
      status.dataset.state = "loading";
    }
    loading = (async () => {
      let rows = [];
      try {
        rows = await fetchSummary();
      } catch (error) {
        console.error("Harmony achievement summary load failed", error);
        loadWarning = "서버 통계를 불러오지 못해 이 기기의 기록만 표시합니다.";
      }
      entries = normalizeAchievementRows({
        rows,
        unlocks,
        items,
        cards,
        meta: getMeta?.() || {},
        authenticated: Boolean(runtime?.user),
      });
      loaded = true;
      loading = null;
      render();
    })();
    return loading;
  }

  async function open() {
    const dialog = getElement("achievements");
    if (!dialog) return;
    dialog.showModal();
    await load();
  }

  function handleClick(event) {
    const button = event.target.closest?.("[data-achievement-filter]");
    if (!button) return;
    filter = button.dataset.achievementFilter;
    render();
  }

  renderIdentity();
  return { handleClick, load, open, render, renderIdentity };
}
