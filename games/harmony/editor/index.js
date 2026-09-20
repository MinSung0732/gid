import { CAMPAIGN_BALANCE } from "./campaign.js";
import { COMBAT_BALANCE } from "./combat.js";
import { DECK_BALANCE } from "./deck.js";
import { ECONOMY_BALANCE } from "./economy.js";
import { PLAYER_BALANCE } from "./player.js";
import { REWARD_BALANCE } from "./rewards.js";

export {
  CAMPAIGN_BALANCE,
  COMBAT_BALANCE,
  DECK_BALANCE,
  ECONOMY_BALANCE,
  PLAYER_BALANCE,
  REWARD_BALANCE,
};

export const BALANCE = Object.freeze({
  campaign: CAMPAIGN_BALANCE,
  combat: COMBAT_BALANCE,
  deck: DECK_BALANCE,
  economy: ECONOMY_BALANCE,
  player: PLAYER_BALANCE,
  rewards: REWARD_BALANCE,
});

const positiveInteger = (value) => Number.isInteger(value) && value > 0;
const nonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;
const rate = (value) => Number.isFinite(value) && value >= 0 && value <= 1;

export function validateBalanceConfig(balance = BALANCE) {
  const errors = [],
    deck = balance.deck || {},
    player = balance.player || {},
    economy = balance.economy || {},
    campaign = balance.campaign || {},
    combat = balance.combat || {},
    fallback = balance.rewards?.fallbackGold || {},
    perks = campaign.codexPerks || {};

  for (const [label, value] of [
    ["deck.startingSize", deck.startingSize],
    ["deck.baseLimit", deck.baseLimit],
    ["deck.minimumSize", deck.minimumSize],
    ["player.startingMaxHp", player.startingMaxHp],
    ["player.baseApLimit", player.baseApLimit],
    ["player.baseTurnAp", player.baseTurnAp],
    ["player.baseHandLimit", player.baseHandLimit],
    ["player.firstTurnDraw", player.firstTurnDraw],
    ["player.turnDraw", player.turnDraw],
    ["player.basePotionLimit", player.basePotionLimit],
    ["player.potionHeal", player.potionHeal],
    ["combat.maxEnemyCount", combat.maxEnemyCount],
  ]) if (!positiveInteger(value)) errors.push(`${label} must be a positive integer`);

  for (const [label, value] of [
    ["player.startingPotions", player.startingPotions],
    ["player.impurityHandReserve", player.impurityHandReserve],
    ["player.impurityOverflowDamage", player.impurityOverflowDamage],
    ["economy.potionBasePrice", economy.potionBasePrice],
    ["economy.labRemoveBasePrice", economy.labRemoveBasePrice],
    ["campaign.codexPerks.startingGoldBonus", perks.startingGoldBonus],
    ["campaign.codexPerks.startingPotionBonus", perks.startingPotionBonus],
    ["campaign.codexPerks.shopRerollBonus", perks.shopRerollBonus],
    ["campaign.codexPerks.firstTurnApBonus", perks.firstTurnApBonus],
    ...Object.entries(fallback).map(([key, value]) => [`rewards.fallbackGold.${key}`, value]),
  ]) if (!nonNegativeInteger(value)) errors.push(`${label} must be a non-negative integer`);

  const perkRates = [
    perks.startingGoldRate,
    perks.startingPotionRate,
    perks.shopRerollRate,
    perks.firstTurnApRate,
    perks.fullCollectionRate,
  ];
  if (!perkRates.every(rate)) errors.push("campaign.codexPerks rates must be between 0 and 1");
  if (perkRates.some((value, index) => index > 0 && value < perkRates[index - 1]))
    errors.push("campaign.codexPerks rates must be ascending");
  if (deck.minimumSize > deck.startingSize)
    errors.push("deck.minimumSize cannot exceed deck.startingSize");
  if (deck.startingSize > deck.baseLimit)
    errors.push("deck.startingSize cannot exceed deck.baseLimit");
  if (player.baseTurnAp > player.baseApLimit)
    errors.push("player.baseTurnAp cannot exceed player.baseApLimit");
  if (player.firstTurnDraw > player.baseHandLimit || player.turnDraw > player.baseHandLimit)
    errors.push("base draw counts cannot exceed player.baseHandLimit");
  if (combat.maxEnemyCount > 3)
    errors.push("combat.maxEnemyCount cannot exceed 3 until the enemy UI supports more slots");
  if (player.startingPotions + perks.startingPotionBonus > player.basePotionLimit)
    errors.push("starting potions plus the Codex bonus cannot exceed player.basePotionLimit");
  if (fallback.statMin > fallback.statMax)
    errors.push("rewards.fallbackGold.statMin cannot exceed statMax");
  if (errors.length) throw new RangeError(`Invalid Harmony balance config:\n- ${errors.join("\n- ")}`);
  return true;
}

validateBalanceConfig();
