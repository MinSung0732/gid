export const facilities = [
  {
    id: "drop",
    name: "향기 한 방울",
    desc: "맑은 향을 천천히 모아요",
    base: 15,
    rate: 0.2,
    max: 1000,
    icon: "💧",
  },
  {
    id: "pink",
    name: "핑크 크리스탈",
    desc: "포근한 향을 머금어요",
    base: 100,
    rate: 1,
    max: 300,
    asset: "object-2048/4.png",
  },
  {
    id: "green",
    name: "그린 크리스탈",
    desc: "싱그러운 향을 채워요",
    base: 500,
    rate: 5,
    max: 200,
    asset: "object-2048/8.png",
  },
  {
    id: "volcanic",
    name: "볼케닉 스톤",
    desc: "깊은 향을 오래 간직해요",
    base: 2500,
    rate: 20,
    max: 150,
    asset: "object-2048/32.png",
  },
  {
    id: "blend",
    name: "향기 조합대",
    desc: "서로 다른 결을 조율해요",
    base: 12000,
    rate: 75,
    max: 100,
    asset: "scent-workshop/icon-blend.png",
  },
  {
    id: "aging",
    name: "향기 숙성실",
    desc: "조화된 향을 깊고 은은하게 숙성해요",
    base: 45000,
    rate: 180,
    max: 75,
    asset: "scent-workshop/icon-aging.png",
  },
  {
    id: "display",
    name: "오브제 진열장",
    desc: "완성된 오브제로 공간에 향을 채워요",
    base: 150000,
    rate: 450,
    max: 50,
    asset: "scent-workshop/icon-display.png",
  },
  {
    id: "studio",
    name: "결이든 공방",
    desc: "모든 향기 생산과 결이의 손길을 강화해요",
    base: 5000000,
    growth: 1.28,
    rate: 1200,
    max: 30,
    asset: "scent-workshop/icon-studio.png",
  },
];
export const cost = (item, count) => {
  const owned = Math.max(0, Number(count) || 0);
  if (item.growth) return Math.ceil(item.base * Math.pow(item.growth, owned));
  return Math.ceil(item.base * Math.pow((owned + 10) / 10, 2.3));
};
export const studioMultiplier = (owned) => {
  const level = Math.min(30, Math.max(0, Number(owned.studio) || 0));
  return 1 + level * 0.08 + (level >= 30 ? 1 : 0);
};
export const clickMultiplier = (owned) =>
  1 +
  Math.floor(Math.min(30, Math.max(0, Number(owned.studio) || 0)) / 5) * 0.25;
export const perSecond = (owned) => {
  const base = facilities.reduce(
    (sum, item) => sum + (owned[item.id] || 0) * item.rate,
    0,
  );
  return base * studioMultiplier(owned);
};
export const freshState = () => ({
  scent: 0,
  total: 0,
  clicks: 0,
  clickPower: 1,
  masterCelebrated: false,
  owned: Object.fromEntries(facilities.map((item) => [item.id, 0])),
  lastSeen: Date.now(),
});
export function offlineGain(state, now = Date.now()) {
  const seconds = Math.min(
    14400,
    Math.max(0, (now - (state.lastSeen || now)) / 1000),
  );
  return perSecond(state.owned) * seconds;
}
export const compact = (value) => {
  if (!Number.isFinite(value)) return "∞";
  if (value < 1000) return Math.floor(value).toLocaleString("ko-KR");
  const units = [
      "",
      "k",
      "M",
      "B",
      "T",
      "Qa",
      "Qi",
      "Sx",
      "Sp",
      "Oc",
      "No",
      "Dc",
    ],
    unitIndex = Math.floor(Math.log10(Math.abs(value)) / 3);
  if (unitIndex >= units.length)
    return value.toExponential(2).replace("e+", "e");
  const scaled = value / Math.pow(1000, unitIndex),
    digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  return `${Number(scaled.toFixed(digits))}${units[unitIndex]}`;
};
