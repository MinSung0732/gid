// Enemy impurity injection policy.
//
// Monster intents may override the default without changing engine code:
//   impurityInjection: {
//     destination: "draw" | "hand" | "discard",
//     placement: "random" | "top" | "bottom", // draw/fallback draw only
//     respectHandLimit: true | false,            // hand only
//     handOverflowDestination: "draw" | "discard",
//   }
//
// Default monster pollution goes into a random position of the draw pile.
// draw.pop() is the next card, so "top" means push() and "bottom" means unshift().

export const IMPURITY_DESTINATIONS = Object.freeze({
  DRAW: "draw",
  HAND: "hand",
  DISCARD: "discard",
});

export const IMPURITY_PLACEMENTS = Object.freeze({
  RANDOM: "random",
  TOP: "top",
  BOTTOM: "bottom",
});

export const DEFAULT_IMPURITY_INJECTION = Object.freeze({
  destination: IMPURITY_DESTINATIONS.DRAW,
  placement: IMPURITY_PLACEMENTS.RANDOM,
  respectHandLimit: true,
  handOverflowDestination: IMPURITY_DESTINATIONS.DRAW,
});

function validDestination(value, fallback = IMPURITY_DESTINATIONS.DRAW) {
  return Object.values(IMPURITY_DESTINATIONS).includes(value) ? value : fallback;
}

function validPlacement(value) {
  return Object.values(IMPURITY_PLACEMENTS).includes(value)
    ? value
    : IMPURITY_PLACEMENTS.RANDOM;
}

export function impurityInjectionConfig(intent = {}) {
  const source = intent?.impurityInjection || {};
  return {
    destination: validDestination(
      source.destination ?? intent.impurityDestination ?? intent.polluteDestination,
    ),
    placement: validPlacement(
      source.placement ?? intent.impurityPlacement ?? intent.pollutePlacement,
    ),
    respectHandLimit: source.respectHandLimit !== false,
    handOverflowDestination: validDestination(
      source.handOverflowDestination,
      IMPURITY_DESTINATIONS.DRAW,
    ),
  };
}

export function extractRecentImpurities(discard, amount) {
  const wanted = Math.max(0, Math.floor(Number(amount) || 0)),
    cards = [];
  if (!Array.isArray(discard) || !wanted) return cards;

  // engine-core appends pollution cards to discard. Remove only the newest
  // impurity cards so unrelated cards already in the graveyard are untouched.
  for (let index = discard.length - 1; index >= 0 && cards.length < wanted; index--) {
    if (discard[index]?.id !== "impurity") continue;
    cards.unshift(...discard.splice(index, 1));
  }
  return cards;
}

function randomIndex(length, random) {
  const roll = Math.max(0, Math.min(0.999999999999, Number(random?.()) || 0));
  return Math.floor(roll * (length + 1));
}

function insertIntoDraw(draw, card, placement, random) {
  if (placement === IMPURITY_PLACEMENTS.TOP) {
    draw.push(card);
    return;
  }
  if (placement === IMPURITY_PLACEMENTS.BOTTOM) {
    draw.unshift(card);
    return;
  }
  draw.splice(randomIndex(draw.length, random), 0, card);
}

function addCount(counts, destination) {
  counts[destination] = (counts[destination] || 0) + 1;
}

export function placeImpurities(
  battle,
  cards,
  config = DEFAULT_IMPURITY_INJECTION,
  { random = Math.random, canAddToHand = () => true } = {},
) {
  const result = {
    total: 0,
    destinations: { draw: 0, hand: 0, discard: 0 },
    primaryDestination: null,
  };
  if (!battle || !Array.isArray(cards) || !cards.length) return result;

  battle.draw ??= [];
  battle.hand ??= [];
  battle.discard ??= [];

  const normalized = {
    ...DEFAULT_IMPURITY_INJECTION,
    ...config,
    destination: validDestination(config.destination),
    placement: validPlacement(config.placement),
    handOverflowDestination: validDestination(
      config.handOverflowDestination,
      IMPURITY_DESTINATIONS.DRAW,
    ),
  };

  const placeOutsideHand = (card, destination) => {
    if (destination === IMPURITY_DESTINATIONS.DISCARD) {
      battle.discard.push(card);
      addCount(result.destinations, IMPURITY_DESTINATIONS.DISCARD);
      return;
    }
    insertIntoDraw(battle.draw, card, normalized.placement, random);
    addCount(result.destinations, IMPURITY_DESTINATIONS.DRAW);
  };

  for (const card of cards) {
    if (normalized.destination === IMPURITY_DESTINATIONS.HAND) {
      const allowed = !normalized.respectHandLimit || canAddToHand();
      if (allowed) {
        battle.hand.push(card);
        addCount(result.destinations, IMPURITY_DESTINATIONS.HAND);
      } else {
        placeOutsideHand(card, normalized.handOverflowDestination);
      }
    } else {
      placeOutsideHand(card, normalized.destination);
    }
    result.total++;
  }

  const used = Object.entries(result.destinations).filter(([, count]) => count > 0);
  result.primaryDestination = used.length === 1 ? used[0][0] : used.length ? "mixed" : null;
  return result;
}
