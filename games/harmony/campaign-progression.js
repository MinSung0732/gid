export const CAMPAIGN_LOOPS = Object.freeze({
  ACT1: 0,
  ACT2: 1,
  ACT3: 2,
  ACT4: 3,
  ACT5: 4,
  ACT6: 5,
  ACT7: 6,
  ABYSS_START: 7,
});

export const ACT7_ROUTES = Object.freeze({
  FLESH: "7-1",
  HEAT: "7-2",
  RESONANCE: "7-3",
});

const START_LOOP_KEY = "harmony_campaign_start_loop";
const START_ROUTE_KEY = "harmony_campaign_start_route";

export const ACT_INFO = Object.freeze({
  0: Object.freeze({ act: 1, key: "act1", name: "버려진 공방" }),
  1: Object.freeze({ act: 2, key: "act2", name: "농축 증류실" }),
  2: Object.freeze({ act: 3, key: "act3", name: "공명의 심연" }),
  3: Object.freeze({ act: 4, key: "act4", name: "변질된 조향실" }),
  4: Object.freeze({ act: 5, key: "act5", name: "살아 움직이는 조향 생태계" }),
  5: Object.freeze({ act: 6, key: "act6", name: "붕괴 직전의 대연금 시설" }),
});

export const ACT7_INFO = Object.freeze({
  "7-1": Object.freeze({ act: 7, key: "act7-1", name: "육체화된 향" }),
  "7-2": Object.freeze({ act: 7, key: "act7-2", name: "초고온 향류" }),
  "7-3": Object.freeze({ act: 7, key: "act7-3", name: "공명 의식" }),
});

export function act7RouteFor(run) {
  return ACT7_INFO[run?.act7Route] ? run.act7Route : ACT7_ROUTES.RESONANCE;
}

export function campaignActInfo(loop, run = null) {
  const value = Math.max(0, Math.floor(Number(loop) || 0));
  if (ACT_INFO[value]) return { ...ACT_INFO[value] };
  if (value === CAMPAIGN_LOOPS.ACT7) return { ...ACT7_INFO[act7RouteFor(run)] };
  const depth = Math.max(1, value - CAMPAIGN_LOOPS.ABYSS_START + 1);
  return {
    act: 8,
    key: "abyss",
    name: `심연 ${depth}`,
    abyssDepth: depth,
  };
}

export function isLateCampaignRun(run) {
  const loop = Math.floor(Number(run?.loop));
  return loop >= CAMPAIGN_LOOPS.ACT4 && loop <= CAMPAIGN_LOOPS.ACT7;
}

export function isAbyssRun(run) {
  return Math.floor(Number(run?.loop)) >= CAMPAIGN_LOOPS.ABYSS_START;
}

export function abyssDepth(run) {
  return isAbyssRun(run)
    ? Math.max(1, Math.floor(Number(run.loop)) - CAMPAIGN_LOOPS.ABYSS_START + 1)
    : 0;
}

export function legacyCoreLoop(run) {
  return isLateCampaignRun(run) ? CAMPAIGN_LOOPS.ACT3 : Math.max(0, Math.floor(Number(run?.loop) || 0));
}

function normalizedCampaignClears(meta = {}) {
  const clears = [...new Set((Array.isArray(meta.campaignClears) ? meta.campaignClears : [])
    .filter((key) => typeof key === "string" && key.length))];

  // Legacy saves only knew 1~3막 + 무한 심연. Restore only the 3막 clear so
  // those players can unlock the new campaign normally from a fresh Act 1 run.
  if (!clears.length && Math.max(0, Math.floor(Number(meta.highestLoop) || 0)) >= CAMPAIGN_LOOPS.ACT3)
    clears.push("act3");

  return [...new Set(clears)];
}

export function campaignClearKey(run) {
  const loop = Math.max(0, Math.floor(Number(run?.loop) || 0));
  if (loop === CAMPAIGN_LOOPS.ACT1) return "act1";
  if (loop === CAMPAIGN_LOOPS.ACT2) return "act2";
  if (loop === CAMPAIGN_LOOPS.ACT3) return "act3";
  if (loop === CAMPAIGN_LOOPS.ACT4) return "act4";
  if (loop === CAMPAIGN_LOOPS.ACT5) return "act5";
  if (loop === CAMPAIGN_LOOPS.ACT6) return "act6";
  if (loop === CAMPAIGN_LOOPS.ACT7) return `act7:${act7RouteFor(run)}`;
  return null;
}

export function hasCampaignClear(meta = {}, key) {
  return normalizedCampaignClears(meta).includes(key);
}

export function progression(meta = {}) {
  const clears = normalizedCampaignClears(meta),
    has = (key) => clears.includes(key),
    anyAct7 = clears.some((key) => key.startsWith("act7:"));
  return {
    act4: has("act3"),
    act5: has("act4"),
    act6: has("act4"),
    act7: has("act6"),
    abyss: anyAct7,
    clearedAct7Routes: Object.keys(ACT7_INFO).filter((route) => has(`act7:${route}`)),
  };
}

// Harmony is a roguelike run: unlocks extend how far a run may continue, never
// where a new run begins. Keep this compatibility function so stale callers or
// old sessionStorage values cannot jump directly into a later Act.
export function startLoopUnlocked(loop) {
  return Math.max(0, Math.floor(Number(loop) || 0)) === CAMPAIGN_LOOPS.ACT1;
}

export function requestCampaignStart() {
  clearRequestedCampaignStart();
  return false;
}

export function clearRequestedCampaignStart() {
  try {
    sessionStorage.removeItem(START_LOOP_KEY);
    sessionStorage.removeItem(START_ROUTE_KEY);
  } catch {}
}

export function consumeRequestedCampaignStart() {
  clearRequestedCampaignStart();
  return { loop: CAMPAIGN_LOOPS.ACT1, route: null };
}

export function emptyAct6RouteStats() {
  return {
    flesh: 0,
    heat: 0,
    resonance: 0,
    lastSignal: null,
    cards: 0,
    harmonies: 0,
  };
}

export function scoreAct6Card(stats, card, harmonyDelta = 0) {
  const next = stats && typeof stats === "object" ? stats : emptyAct6RouteStats();
  if (!card || typeof card !== "object") return next;
  next.cards = Math.max(0, Number(next.cards) || 0) + 1;
  const isAttack = Boolean(card.attack || card.burst || card.weight),
    pattern = card.attackPattern || (isAttack ? "contact" : null);
  if (isAttack && pattern === "contact") {
    next.flesh = (Number(next.flesh) || 0) + 2;
    next.lastSignal = "flesh";
  }
  if (isAttack && pattern === "nonContact") {
    next.heat = (Number(next.heat) || 0) + 2;
    next.lastSignal = "heat";
  }
  if (card.applyEnemy?.burning || card.onHitApplyEnemy?.burning || card.weakOnHit) {
    next.heat = (Number(next.heat) || 0) + 1;
    next.lastSignal = "heat";
  }
  if (!isAttack && card.note) {
    next.resonance = (Number(next.resonance) || 0) + 1;
    next.lastSignal = "resonance";
  }
  if (harmonyDelta > 0) {
    next.harmonies = (Number(next.harmonies) || 0) + harmonyDelta;
    next.resonance = (Number(next.resonance) || 0) + harmonyDelta * 3;
    next.lastSignal = "resonance";
  }
  return next;
}

export function resolveAct7Route(stats = {}) {
  const entries = [
    ["flesh", Number(stats.flesh) || 0, ACT7_ROUTES.FLESH],
    ["heat", Number(stats.heat) || 0, ACT7_ROUTES.HEAT],
    ["resonance", Number(stats.resonance) || 0, ACT7_ROUTES.RESONANCE],
  ];
  const best = Math.max(...entries.map(([, value]) => value));
  if (best <= 0) return ACT7_ROUTES.RESONANCE;
  const tied = entries.filter(([, value]) => value === best);
  const recent = tied.find(([key]) => key === stats.lastSignal);
  return (recent || tied[0])[2];
}

export function clearMilestone(run, meta = {}) {
  const key = campaignClearKey(run),
    clears = normalizedCampaignClears(meta),
    firstClear = key && !clears.includes(key);
  if (!firstClear) return null;
  if (key === "act3")
    return { key: "act4", title: "4막 해금", detail: "변질된 조향실이 열렸습니다.", forceHome: true };
  if (key === "act4")
    return { key: "act5-6", title: "5막 · 6막 해금", detail: "살아 움직이는 조향 생태계와 대연금 시설이 열렸습니다.", forceHome: true };
  if (key === "act6")
    return { key: "act7", title: "7막 분기 해금", detail: "7-1 · 7-2 · 7-3 경로가 열렸습니다.", forceHome: true };
  if (key.startsWith("act7:") && !clears.some((clear) => clear.startsWith("act7:")))
    return { key: "abyss", title: "심연 해금", detail: "7막 너머의 심연에 도전할 수 있습니다.", forceHome: true };
  return null;
}

export function markClearProgress(run, meta, milestone = clearMilestone(run, meta)) {
  if (!run || !meta) return milestone;
  const clearKey = campaignClearKey(run);
  meta.campaignClears = normalizedCampaignClears(meta);
  if (clearKey && !meta.campaignClears.includes(clearKey)) meta.campaignClears.push(clearKey);
  meta.highestLoop = Math.max(
    Math.max(0, Math.floor(Number(meta.highestLoop) || 0)),
    Math.max(0, Math.floor(Number(run.loop) || 0)),
  );
  if (milestone) {
    run._campaignFeedback = {
      ...milestone,
      loop: run.loop,
      route: run.act7Route || null,
    };
  }
  return milestone;
}

export function nextLoopTarget(run) {
  const loop = Math.max(0, Math.floor(Number(run?.loop) || 0));
  if (loop === CAMPAIGN_LOOPS.ACT6)
    return {
      loop: CAMPAIGN_LOOPS.ACT7,
      route: resolveAct7Route(run.act6RouteStats),
    };
  if (loop === CAMPAIGN_LOOPS.ACT7)
    return { loop: CAMPAIGN_LOOPS.ABYSS_START, route: null };
  return { loop: loop + 1, route: null };
}
