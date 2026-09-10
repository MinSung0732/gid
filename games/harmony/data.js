import {
  BETA_CARDS,
  BETA_ITEMS,
  BETA_KINDS,
  BETA_RARITIES,
  BETA_STARTING_DECK,
  BETA_UNLOCKS,
} from "./beta-content.js";
import { CONTACT_ATTACK_CARDS } from "./contact-cards.js";
import { NON_CONTACT_ATTACK_CARDS } from "./non-contact-cards.js";
import { BURST_CARDS } from "./burst-cards.js";
import { GUARD_CARDS } from "./guard-cards.js";
import { ABSORB_CARDS } from "./absorb-cards.js";
import { CONTACT_TIER2_CARDS } from "./contact-tier2-cards.js";
import { CONTACT_TIER3_CARDS } from "./contact-tier3-cards.js";
import { CONTACT_TIER4_CARDS } from "./contact-tier4-cards.js";
import { NONCONTACT_TIER2_CARDS } from "./noncontact-tier2-cards.js";
import { NONCONTACT_TIER3_CARDS } from "./noncontact-tier3-cards.js";
import { NONCONTACT_TIER4_CARDS } from "./noncontact-tier4-cards.js";
import { GUARD_TIER2_CARDS } from "./guard-tier2-cards.js";
import { GUARD_TIER3_CARDS } from "./guard-tier3-cards.js";
import { GUARD_TIER4_CARDS } from "./guard-tier4-cards.js";
import { ABSORB_TIER2_CARDS } from "./absorb-tier2-cards.js";
import { ABSORB_TIER3_CARDS } from "./absorb-tier3-cards.js";
import { ABSORB_TIER4_CARDS } from "./absorb-tier4-cards.js";
import { ATTACK_STAT_ITEMS } from "./attack-stat-items.js";
import { STAT_AND_CURSE_ITEMS } from "./stat-curse-items.js";
import { BENEFICIAL_TRAITS } from "./beneficial-traits.js";
import { CURSE_TRAITS } from "./curse-traits.js";
import { OFFICIAL_RELICS } from "./official-relics.js";
import { EARLY_MONSTERS } from "./monsters.js";
import { ACT1_BOSSES, ACT1_ELITES } from "./act1-monsters.js";
import { ACT2_BOSSES, ACT2_ELITES, ACT2_MONSTERS } from "./act2-monsters.js";
import { ACT3_BOSSES, ACT3_ELITES, ACT3_MONSTERS } from "./act3-monsters.js";

export { EARLY_MONSTERS } from "./monsters.js";
export { ACT1_BOSSES, ACT1_ELITES } from "./act1-monsters.js";
export { ACT2_BOSSES, ACT2_ELITES, ACT2_MONSTERS } from "./act2-monsters.js";
export { ACT3_BOSSES, ACT3_ELITES, ACT3_MONSTERS } from "./act3-monsters.js";

export const RARITIES = BETA_RARITIES;
export const KINDS = { ...BETA_KINDS, curse: "저주" };
const RESOURCE_EFFECTS = new Set([
  "deckSize", "handSize", "apCap", "turnBaseAp", "draw",
]);
const normalizeItem = (source) => {
  const item = { ...source };
  if (item.effect === "ap") item.effect = "turnBaseAp";
  if (RESOURCE_EFFECTS.has(item.effect)) item.kind = "relic";
  if (["openingShield", "goldBonus"].includes(item.effect)) item.kind = "stat";
  if (item.kind === "trait") item.family ||= item.effect;
  if (item.kind === "relic") item.maxOwned = 1;
  if (source.effect === "ap")
    item.description = item.description.replace("최대 AP", "턴 시작 AP");
  return item;
};
export const ENABLE_LEGACY_BETA_AUGMENTS = false;
export const LEGACY_BETA_ITEMS = Object.fromEntries(
  Object.entries(BETA_ITEMS)
    .map(([id, item]) => [id, normalizeItem(item)])
    .filter(([, item]) => item.kind !== "relic" || item.tier >= 2),
);
export const ITEMS = {
  ...ATTACK_STAT_ITEMS,
  ...STAT_AND_CURSE_ITEMS,
  ...BENEFICIAL_TRAITS,
  ...CURSE_TRAITS,
  ...OFFICIAL_RELICS,
  ...(ENABLE_LEGACY_BETA_AUGMENTS ? LEGACY_BETA_ITEMS : {}),
  relic_golden_pipette: {
    id: "relic_golden_pipette", room: "boss", kind: "relic", name: "황금빛 정제 피펫",
    tier: 3, effect: "purifyImpurity", value: 6, maxOwned: 1, passive: true, signatureOnly: true, image: null,
    description: "손패에 들어온 불순물을 즉시 소멸시키고 AP +1 · 흡수 +6",
  },
  relic_dew_of_eternity: {
    id: "relic_dew_of_eternity", room: "boss", kind: "relic", name: "영원한 이슬 받침",
    tier: 3, effect: "eternalDew", value: 4, maxOwned: 1, passive: true, signatureOnly: true, image: null,
    description: "턴 시작 시 체력 +4 · 초과 회복량의 150%를 방어막으로 전환",
  },
  relic_primordial_pipette: { id: "relic_primordial_pipette", room: "boss", kind: "relic", name: "원초의 피펫", tier: 3, effect: "primordial", value: 1, maxOwned: 1, passive: true, signatureOnly: true, image: null, description: "원초의 조향이 깃든 시그니처 유물" },
  relic_essence_heart: { id: "relic_essence_heart", room: "boss", kind: "relic", name: "에센스 심장", tier: 3, effect: "essenceHeart", value: 1, maxOwned: 1, passive: true, signatureOnly: true, image: null, description: "심연의 생명력이 응축된 시그니처 유물" },
  relic_harmony_orb: { id: "relic_harmony_orb", room: "boss", kind: "relic", name: "조화의 구체", tier: 3, effect: "harmonyOrb", value: 1, maxOwned: 1, passive: true, signatureOnly: true, image: null, description: "절대 조화를 담은 시그니처 유물" },
};
export const TEST_ITEMS = { ...ITEMS };
export const ENABLE_LEGACY_BETA_CARDS = false;
export const LEGACY_BETA_CARDS = BETA_CARDS;
const CARD_TIERS = {
  contact_glass_dropper_strike: 1, contact_direct_oil_dab: 1,
  contact_shattered_ampoule: 1, contact_beveled_scent_strip: 1,
  contact_woody_pestle_smash: 2, contact_coating_slam: 1, contact_fierce_rub: 1,
  contact_grind_refine: 2, contact_censer_shove: 1, contact_perfumers_touch: 2,
  noncontact_fine_mist_spray: 1, noncontact_citrus_haze: 1,
  noncontact_aromatic_smudge: 1, noncontact_alcohol_flash: 2,
  noncontact_spatial_resonance_wave: 2, noncontact_distillate_jet: 1,
  noncontact_amber_afterglow: 2, noncontact_essential_diffuse: 2,
  noncontact_scent_shockwave: 1, noncontact_atelier_draught: 1,
};
const COPY_LIMITS = { 1: 4, 2: 2, 3: 2, 4: 1 };
const UPGRADE_LIMITS = { 1: 3, 2: 2, 3: 2, 4: 1 };
const BETA_ONLY_CARD_IDS = new Set(["burst_scent_premonition"]);
const normalizeCard = (id, source) => {
  const tier = source.tier || CARD_TIERS[id] || 1;
  return { ...source, id, tier, maxCopies: source.maxCopies || COPY_LIMITS[tier], maxUpgrade: source.maxUpgrade || UPGRADE_LIMITS[tier] };
};
export const OFFICIAL_CARDS = Object.fromEntries(
  Object.entries({ ...CONTACT_ATTACK_CARDS, ...NON_CONTACT_ATTACK_CARDS, ...BURST_CARDS, ...ABSORB_CARDS, ...GUARD_CARDS, ...CONTACT_TIER2_CARDS, ...CONTACT_TIER3_CARDS, ...CONTACT_TIER4_CARDS, ...NONCONTACT_TIER2_CARDS, ...NONCONTACT_TIER3_CARDS, ...NONCONTACT_TIER4_CARDS, ...GUARD_TIER2_CARDS, ...GUARD_TIER3_CARDS, ...GUARD_TIER4_CARDS, ...ABSORB_TIER2_CARDS, ...ABSORB_TIER3_CARDS, ...ABSORB_TIER4_CARDS })
    .filter(([id]) => !BETA_ONLY_CARD_IDS.has(id))
    .map(([id, card]) => [id, normalizeCard(id, card)]),
);
for (const id of Object.keys(CONTACT_ATTACK_CARDS)) CONTACT_ATTACK_CARDS[id] = OFFICIAL_CARDS[id];
for (const id of Object.keys(NON_CONTACT_ATTACK_CARDS)) NON_CONTACT_ATTACK_CARDS[id] = OFFICIAL_CARDS[id];
// 불순물은 보상 풀에 들어가지 않는 내부 상태 카드다.
export const SYSTEM_CARDS = {
  impurity: normalizeCard("impurity", BETA_CARDS.impurity),
};
export const CARDS = { ...OFFICIAL_CARDS, ...SYSTEM_CARDS };
// 이전 저장 파일은 불러올 수 있지만, 이 호환 정의들은 열거/보상/시작 덱에서 제외된다.
Object.defineProperties(CARDS, Object.fromEntries(
  Object.entries(BETA_CARDS)
    .filter(([id]) => !(id in CARDS))
    .map(([id, card]) => [id, { value: normalizeCard(id, card), enumerable: false }]),
));
export const STARTING_DECK = [
  "contact_glass_dropper_strike", "contact_glass_dropper_strike",
  "noncontact_fine_mist_spray", "noncontact_citrus_haze",
  "burst_precision_pipetting", "burst_precision_pipetting",
  "burst_oil_resin_coat", "burst_oil_resin_coat",
  "contact_shattered_ampoule", "contact_beveled_scent_strip",
];
export const RECOMMENDED_STARTING_DECK = [
  "contact_glass_dropper_strike", "contact_glass_dropper_strike",
  "noncontact_fine_mist_spray", "noncontact_fine_mist_spray",
  "noncontact_citrus_haze", "noncontact_citrus_haze",
  "burst_precision_pipetting", "burst_precision_pipetting",
  "contact_direct_oil_dab", "contact_beveled_scent_strip",
];
export function getTier1Cards() {
  return Object.values(CARDS).filter((card) => card.id !== "impurity" && card.tier === 1);
}
export const UNLOCKS = [
  ...BETA_UNLOCKS,
  { id: "boss_corrupted_perfumer", name: "부패한 조향 마스터", goal: "특수 조건으로 보스 풀에 해금" },
  { id: "boss_primeval_lily", name: "태초의 백합수", goal: "특수 조건으로 보스 풀에 해금" },
  { id: "boss_golden_perfumer", name: "원초의 조향사", goal: "특수 조건으로 3막 보스 풀에 해금" },
  { id: "boss_abyssal_lily", name: "심연의 거대 백합", goal: "특수 조건으로 3막 보스 풀에 해금" },
  { id: "boss_lord_of_harmony", name: "절대 조화의 군주", goal: "특수 조건으로 3막 보스 풀에 해금" },
];
export const ROOM_NAMES = {
  combat: "전투",
  treasure: "보물",
  shop: "상점",
  boss: "보스",
  battle: "전투",
  elite: "엘리트",
  gather: "채집방",
  golden: "황금방",
  boss: "보스방",
  rest: "휴식처",
  shop: "아틀리에",
  mystery: "밀폐된 시약장",
  greenhouse: "이슬 맺힌 온실",
  curse_pit: "침전된 폐기장",
  lab: "증류 배합대",
};
export const ROOM_CATEGORIES = {
  combat: { name: "전투", symbol: "⚔️" },
  elite: { name: "엘리트", symbol: "👹" },
  treasure: { name: "보물", symbol: "🗝️" },
  shop: { name: "상점", symbol: "🛍️" },
  boss: { name: "보스", symbol: "☠️" },
};
export const CATEGORY_ROOM_WEIGHTS = {
  combat: [{ room: "battle", weight: 80 }, { room: "elite", weight: 20 }],
  treasure: [
    { room: "gather", weight: 35 }, { room: "mystery", weight: 25 },
    { room: "greenhouse", weight: 18 }, { room: "golden", weight: 10 },
    { room: "curse_pit", weight: 7 }, { room: "lab", weight: 5 },
  ],
  shop: [{ room: "shop", weight: 60 }, { room: "rest", weight: 40 }],
  boss: [{ room: "boss", weight: 100 }],
};
// image에 추후 파일 경로를 넣으면 기호 대신 몬스터 이미지가 렌더링됩니다.
export const ENEMIES = {
  ...EARLY_MONSTERS,
  ...ACT2_MONSTERS,
  ...ACT3_MONSTERS,
  ...ACT1_ELITES,
  ...ACT1_BOSSES,
  ...ACT2_ELITES,
  ...ACT2_BOSSES,
  ...ACT3_ELITES,
  ...ACT3_BOSSES,
  normal: { name: "흩어진 잡향", symbol: "❋", image: null },
  elite: { name: "응축된 불순물", symbol: "✦", image: null },
  boss1: { name: "흐트러진 원료", symbol: "♛", image: null },
  boss2: { name: "뒤엉킨 잔향", symbol: "♛", image: null },
  boss3: { name: "공간의 불협화음", symbol: "♛", image: null },
};
export const ROUTE = [
  "combat",
  "treasure",
  "combat",
  "boss",
  "treasure",
  "shop",
  "combat",
  "boss",
  "treasure",
  "shop",
  "combat",
  "boss",
];
export const ROUTE_CATEGORIES = ROUTE;
// 방별 등장 확률과 기본 보상은 게임 규칙이므로 베타 콘텐츠와 분리합니다.
export const TABLES = {
  gather: { kinds: [45, 35, 20], tiers: [60, 27, 10, 3], heal: 5, gold: 15 },
  golden: { kinds: [25, 40, 35], tiers: [15, 45, 30, 10], heal: 5, gold: 20 },
  boss: { kinds: [30, 30, 40], tiers: [10, 35, 40, 15], heal: 12, gold: 35 },
};
