import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CARDS, ITEMS, UNLOCKS } from "../games/harmony/data.js";
import { fetchAchievementSummary } from "../games/harmony/achievement-service.js";
import {
  ACHIEVEMENT_RARITY_THRESHOLDS,
  achievementCardHtml,
  createAchievementUi,
  filterAndSortAchievements,
  formatClearRate,
  normalizeAchievementRows,
  rarityForRate,
} from "../games/harmony/achievement-ui.js";

assert.deepEqual(
  ACHIEVEMENT_RARITY_THRESHOLDS.map(({ min, label }) => [min, label]),
  [[50, "흔함"], [20, "보통"], [5, "희귀"], [1, "매우 희귀"], [0, "전설적"]],
);
assert.equal(rarityForRate(100).label, "흔함");
assert.equal(rarityForRate(49.9).label, "보통");
assert.equal(rarityForRate(7.3).label, "희귀");
assert.equal(rarityForRate(4.7).label, "매우 희귀");
assert.equal(rarityForRate(0.8).label, "전설적");
assert.equal(rarityForRate(null).label, "집계 전");
assert.equal(formatClearRate(0), "0%");
assert.equal(formatClearRate(100), "100%");
assert.equal(formatClearRate(7.34), "7.3%");
assert.equal(formatClearRate(null), "-");

const serverRows = [
  {
    achievement_id: "a-done",
    name: "긴 이름을 가진 달성 도전과제 테스트",
    description: "완료 설명",
    icon: "✦",
    reward: [{ kind: "item", id: "long", label: "매우 긴 이름을 가진 희귀 유물 해금 보상" }],
    hidden: false,
    hide_reward: false,
    sort_order: 2,
    unlocked: true,
    unlocked_at: "2026-09-20T00:00:00Z",
    clear_count: 100,
    eligible_player_count: 100,
    clear_rate: 100,
  },
  {
    achievement_id: "a-locked",
    name: "숨겨질 이름",
    description: "숨겨질 설명",
    icon: "♛",
    reward: [{ kind: "card", id: "card", label: "공개되는 카드 보상" }],
    hidden: false,
    hide_reward: false,
    sort_order: 1,
    unlocked: false,
    unlocked_at: null,
    clear_count: 0,
    eligible_player_count: 100,
    clear_rate: 0,
  },
  {
    achievement_id: "a-secret",
    name: "비밀 이름",
    description: "비밀 설명",
    icon: "?",
    reward: [{ kind: "item", id: "secret", label: "비밀 보상" }],
    hidden: true,
    hide_reward: true,
    sort_order: 3,
    unlocked: false,
    unlocked_at: null,
    clear_count: 1,
    eligible_player_count: 125,
    clear_rate: 0.8,
  },
];

const normalized = normalizeAchievementRows({
  rows: serverRows,
  unlocks: [],
  items: {},
  cards: {},
  meta: { unlocked: [] },
  authenticated: true,
});
assert.equal(normalized.length, 3);
assert.deepEqual(filterAndSortAchievements(normalized).map((entry) => entry.achievementId), ["a-done", "a-locked", "a-secret"]);
assert.deepEqual(filterAndSortAchievements(normalized, "unlocked").map((entry) => entry.achievementId), ["a-done"]);
assert.deepEqual(filterAndSortAchievements(normalized, "locked").map((entry) => entry.achievementId), ["a-locked", "a-secret"]);
assert.deepEqual(filterAndSortAchievements(normalized, "rare").map((entry) => entry.achievementId), ["a-locked", "a-secret"]);

const lockedMarkup = achievementCardHtml(normalized[1]);
assert.match(lockedMarkup, /<h3>\?\?\?<\/h3>/);
assert.doesNotMatch(lockedMarkup, /숨겨질 이름|숨겨질 설명/);
assert.match(lockedMarkup, /공개되는 카드 보상/);
assert.match(lockedMarkup, /달성률 0%/);
assert.match(achievementCardHtml(normalized[2]), /보상 \?\?\?/);
const completedMarkup = achievementCardHtml(normalized[0]);
assert.match(completedMarkup, /긴 이름을 가진 달성 도전과제 테스트/);
assert.match(completedMarkup, /달성 완료/);
assert.match(completedMarkup, /달성률 100%/);
assert.match(completedMarkup, /<time/);

const guestRows = normalizeAchievementRows({
  rows: serverRows,
  unlocks: [{ id: "a-locked", name: "로컬 이름", goal: "로컬 조건", type: "card", card: "local-card" }],
  items: {},
  cards: { "local-card": { name: "로컬 보상" } },
  meta: { unlocked: ["a-locked"] },
  authenticated: false,
});
assert.equal(guestRows.find((entry) => entry.achievementId === "a-locked").unlocked, true, "guest completion comes from local meta");
assert.equal(guestRows.find((entry) => entry.achievementId === "a-locked").unlockedAt, null);

{
  let calls = 0;
  const rows = await fetchAchievementSummary({
    async rpc(name) {
      calls += 1;
      assert.equal(name, "get_harmony_achievement_summary");
      return { data: serverRows, error: null };
    },
  });
  assert.equal(calls, 1);
  assert.equal(rows.length, 3);
}

function classList() {
  const values = new Set();
  return { toggle(name, force) { if (force) values.add(name); else values.delete(name); }, contains(name) { return values.has(name); } };
}

{
  const filterButtons = ["all", "unlocked", "locked", "rare"].map((value) => ({
      dataset: { achievementFilter: value },
      classList: classList(),
      setAttribute() {},
    })),
    elements = new Map([
      ["header-profile", { textContent: "" }],
      ["achievement-summary", { innerHTML: "" }],
      ["achievement-grid", { innerHTML: "" }],
      ["achievement-status", { textContent: "", dataset: {} }],
      ["achievement-filters", { querySelectorAll: () => filterButtons }],
      ["achievements", { showModalCalls: 0, showModal() { this.showModalCalls += 1; } }],
    ]);
  let requests = 0;
  const ui = createAchievementUi({
    unlocks: UNLOCKS,
    items: ITEMS,
    cards: CARDS,
    getMeta: () => ({ unlocked: [UNLOCKS.find((entry) => !entry.legacy).id] }),
    runtime: { user: { email: "tester@example.test", user_metadata: {} }, profile: { display_name: "테스터" } },
    fetchSummary: async () => { requests += 1; return serverRows; },
    getElement: (id) => elements.get(id) || null,
  });
  await ui.open();
  await ui.open();
  assert.equal(requests, 1, "opening the modal must use one cached summary request, not N+1 calls");
  assert.equal(elements.get("achievements").showModalCalls, 2);
  assert.equal(elements.get("header-profile").textContent, "프로필 · 테스터님 환영합니다");
  assert.match(elements.get("achievement-summary").innerHTML, /1 \/ 3/);
  assert.equal((elements.get("achievement-grid").innerHTML.match(/achievement-card /g) || []).length, 3);
  ui.handleClick({ target: { closest: () => filterButtons[2] } });
  assert.equal((elements.get("achievement-grid").innerHTML.match(/achievement-card /g) || []).length, 2);
}

{
  const fallback = normalizeAchievementRows({ rows: [], unlocks: UNLOCKS, items: ITEMS, cards: CARDS, meta: { unlocked: [] } });
  assert.equal(fallback.length, 20);
  assert.ok(fallback.every((entry) => entry.clearRate === null));
  assert.ok(fallback.some((entry) => entry.reward.length === 2), "multi-reward achievements should keep every canonical reward");
}

const [mainSource, indexSource, cssSource, migrationSource] = await Promise.all([
  readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8"),
  readFile(new URL("../games/harmony/index.html", import.meta.url), "utf8"),
  readFile(new URL("../games/harmony/achievement-ui.css", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260919165908_create_harmony_achievement_catalog.sql", import.meta.url), "utf8"),
]);
for (const marker of ["achievements-toggle", "achievement-summary", "achievement-filters", "achievement-grid"])
  assert.match(indexSource, new RegExp(marker));
assert.match(mainSource, /createAchievementUi/);
assert.match(cssSource, /overflow-y:\s*auto/);
assert.match(cssSource, /@media \(max-width: 620px\)/);
assert.match(migrationSource, /get_harmony_achievement_summary/);
assert.match(migrationSource, /security invoker/i);
assert.match(migrationSource, /harmony_user_achievements_select_own/);
assert.doesNotMatch(mainSource, /function unlock\(/, "achievement presentation must not replace unlock logic");

console.log("PASS Harmony achievement archive: guest/member state, spoiler locks, rewards, rates, rarity, filters, sorting, responsive scroll, and one-request API.");
