import { ITEMS, LEGACY_BETA_ITEMS } from "../games/harmony/data.js";

// Some beta-era item IDs were intentionally promoted back into the live pool as
// synergy components. The legacy behavior suite should inject only archived IDs
// so it does not overwrite the current live definitions before running tests.
for (const id of Object.keys(LEGACY_BETA_ITEMS)) {
  if (ITEMS[id]) delete LEGACY_BETA_ITEMS[id];
}

await import("./test-harmony.mjs");
