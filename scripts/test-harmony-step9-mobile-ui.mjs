import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync("games/harmony/index.html", "utf8"),
  mobileJs = fs.readFileSync("games/harmony/mobile-battle-ui.js", "utf8"),
  mobileCss = fs.readFileSync("games/harmony/mobile-battle-ui.css", "utf8");

assert.match(index, /\.\/mobile-battle-ui\.css\?v=[^\"]+/, "Step 9 mobile stylesheet is loaded");
assert.match(index, /\.\/mobile-battle-ui\.js\?v=[^\"]+/, "Step 9 mobile controller is loaded");
assert.ok(
  index.indexOf("mobile-battle-ui.css") > index.indexOf("card-hand-ui.css"),
  "Mobile composition CSS loads after frozen PC battle/card styles",
);
assert.ok(
  index.indexOf('mobile-battle-ui.js?v=') < index.indexOf('bootstrap.js?v='),
  "Mobile frame wrapper loads before bootstrap imports main.js",
);

assert.ok(mobileJs.includes('import { analyzeBuild } from "./pc-frame-ui.js'), "Mobile drawer reuses PC Build Core analysis source");
assert.ok(mobileJs.includes("window.HarmonyPcFrame = Object.freeze"), "Mobile controller composes through the existing frame hook");
assert.ok(mobileJs.includes('querySelector(":scope > .player-stats")'), "Mobile drawer moves the existing Player Stats node");
assert.ok(mobileJs.includes('querySelector(":scope > .acquired-panel")'), "Mobile drawer moves the existing Build/Traits/Relics node");
assert.ok(mobileJs.includes('data-mobile-open="deck"'), "Mobile menu exposes Deck / Run Summary");
assert.ok(mobileJs.includes('data-mobile-open="log"'), "Mobile menu exposes Battle Log");
assert.ok(mobileJs.includes('data-mobile-open="codex"'), "Mobile menu exposes Codex");
assert.ok(mobileJs.includes('data-mobile-open="settings"'), "Mobile menu exposes Settings");
assert.ok(mobileJs.includes("mobileBattleMedia.addEventListener(\"change\""), "Breakpoint changes use matchMedia events, not polling");

for (const forbidden of ["MutationObserver", "setInterval(", "requestAnimationFrame(", "mobile-hotfix.css", "mobile-final-fix.css"])
  assert.ok(!mobileJs.includes(forbidden), `Step 9 controller must not use ${forbidden}`);
for (const forbiddenMarkup of ['<section class="battle', 'class="battle-arena"', 'class="enemies-field"'])
  assert.ok(!mobileJs.includes(forbiddenMarkup), `Step 9 must not duplicate Battle markup: ${forbiddenMarkup}`);

assert.ok(mobileCss.includes("(max-width: 900px), (max-width: 932px) and (max-height: 600px)"), "Mobile breakpoint includes portrait and short 932px landscape");
assert.ok(mobileCss.includes("100dvh"), "Mobile battle is bounded to dynamic viewport height");
assert.match(mobileCss, /html\.mobile-battle-active,[\s\S]*body\.mobile-battle-active[\s\S]*overflow:\s*hidden\s*!important/, "Document/body scrolling is locked only for active mobile battle");
assert.match(mobileCss, /\.hand\s*\{[\s\S]*overflow-x:\s*auto\s*!important/, "Hand retains horizontal scrolling");
assert.ok(mobileCss.includes("orientation: portrait"), "Portrait has an explicit composition");
assert.ok(mobileCss.includes("orientation: landscape"), "Landscape has an explicit composition");
assert.ok(mobileCss.includes("grid-template-columns: minmax(0, .96fr) minmax(0, 1.04fr)"), "Landscape uses side-by-side Enemy and Player Action areas");
assert.ok(mobileCss.includes(".enemies-field.enemies-3"), "Three-enemy mobile layout is explicitly supported");
assert.ok(mobileCss.includes("touch-action: pan-x"), "Hand is touch-swipe optimized");
assert.ok(mobileCss.includes("prefers-reduced-motion: reduce"), "Mobile drawer honors reduced motion");

console.log("PASS Harmony Step 9 static mobile contracts: reused battle DOM, portrait/landscape composition, drawer reuse, touch, and no polling observers.");
