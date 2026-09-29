import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import {
  LAB_REMOVE_BASE_PRICE,
  labRemovePrice,
  shopQuote,
} from "../games/harmony/economy-pricing.js";

function runWith(...inventory) {
  const run = E.newRun(12345, null, E.freshMeta());
  run.inventory = inventory;
  return run;
}

{
  const run = runWith();
  assert.equal(shopQuote(run, 100, "augment").price, 100, "base shop price");
  assert.equal(shopQuote(run, 25, "potion").price, 25, "base potion price");
  assert.equal(labRemovePrice(run), LAB_REMOVE_BASE_PRICE, "base lab price");
}

{
  const run = runWith("relic_brass_pocket_balance");
  assert.equal(shopQuote(run, 100, "card").price, 95, "card-only flat discount");
  assert.equal(shopQuote(run, 100, "augment").price, 100, "card discount does not affect augments");
}

{
  const run = runWith("relic_merchants_diplomatic_seal");
  assert.equal(shopQuote(run, 100, "augment").price, 70, "30% all-shop discount");
  assert.equal(shopQuote(run, 25, "potion").price, 18, "shop percentage discount rounds exactly like engine");
}

{
  const run = runWith("relic_merchants_diplomatic_seal", "relic_brass_pocket_balance");
  assert.equal(shopQuote(run, 100, "card").price, 65, "percentage discount then card flat discount");
}

{
  const run = runWith("curse_extortionate_merchant_tax");
  assert.equal(shopQuote(run, 100, "augment").price, 200, "+100% merchant tax");
}

{
  const run = runWith("curse_extortionate_merchant_tax", "curse_extortionate_merchant_tax");
  assert.equal(shopQuote(run, 100, "augment").price, 300, "stacked merchant tax");
}

{
  const run = runWith("curse_trait_greed_bankruptcy", "relic_merchants_diplomatic_seal");
  assert.equal(shopQuote(run, 100, "augment").price, 210, "triple price then 30% shop discount");
}

{
  const run = runWith("relic_faded_recipe_scrap");
  assert.equal(labRemovePrice(run), 15, "lab relic discount is reflected in effective price");
}

{
  const meta = E.freshMeta(),
    run = E.newRun(24680, null, meta),
    before = run.shopRerolls;
  assert.equal(
    E.addInventoryItem(run, "relic_dusty_sample_case", meta),
    true,
    "shop reroll relic should be acquirable",
  );
  assert.equal(
    run.shopRerolls,
    before + 1,
    "newly acquired shop reroll relic grants its reroll charge immediately",
  );
}

{
  const meta = E.freshMeta(),
    run = E.newRun(13579, null, meta);
  run.inventory.push("relic_dusty_sample_case");
  run.shopRerolls = 0;
  delete run.shopRerollRelicBackfillV1;
  E.shopOffers(run, meta);
  assert.equal(
    run.shopRerolls,
    1,
    "legacy save with reroll relic receives the previously missing charge",
  );
  E.shopOffers(run, meta);
  assert.equal(
    run.shopRerolls,
    1,
    "legacy reroll backfill is applied only once",
  );
  run.phase = "shop";
  assert.equal(E.shop(run, "reroll", null, meta), true, "free shop reroll is usable");
  assert.equal(run.shopRerolls, 0, "using the free shop reroll consumes one charge");
}

console.log("Harmony economy pricing tests passed");
