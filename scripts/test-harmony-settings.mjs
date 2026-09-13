import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../games/harmony/index.html", import.meta.url), "utf8");
const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const settings = await readFile(new URL("../games/harmony/settings-ui.js", import.meta.url), "utf8");
const sound = await readFile(new URL("../games/harmony/sound.js", import.meta.url), "utf8");
const css = await readFile(new URL("../games/harmony/settings-ui.css", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

const header = html.match(/<header>[\s\S]*?<\/header>/)?.[0] || "";
assert.match(header, /id="settings-toggle"/);
assert.ok(
  header.indexOf('id="settings-toggle"') > header.indexOf('id="tools-toggle"'),
  "settings button stays at the right edge of the header actions",
);
assert.doesNotMatch(header, /sfx-volume|sfx-toggle/);
assert.match(html, /data-settings-tab="gameplay"/);
assert.match(html, /data-settings-tab="sound"/);
assert.match(html, /data-settings-tab="other"/);
assert.match(html, /id="combat-fx-enabled"[^>]*checked/);
assert.match(html, /id="sfx-enabled"[^>]*checked/);
assert.match(html, /id="bgm-enabled"[^>]*checked/);
assert.match(html, /https:\/\/smartstore\.naver\.com\/k_id\/products\/13729418021/);
assert.match(html, new RegExp(`v${packageJson.version.replaceAll(".", "\\.")}`));
assert.match(html, /settings-ui\.css\?v=20260913-1/);
assert.match(html, /settings-ui\.js\?v=20260913-1/);
assert.match(settings, /HarmonySuperFxTuning\?\.setEnabled/);
assert.match(settings, /storedValue\(BGM_STORAGE_KEY\) !== "false"/);
assert.match(settings, /SFX\.setMuted/);
assert.match(sound, /setMuted\(muted\)/);
assert.match(main, /function combatEffectsEnabled\(\)/);
assert.match(main, /if \(!combatEffectsEnabled\(\)\) \{\s*onImpact\?\.\(\);\s*return;/);
assert.match(css, /\.settings-tabs/);
assert.match(css, /\.settings-product-link/);

console.log("PASS Harmony settings: gameplay, sound and other tabs are wired with persistent defaults.");
