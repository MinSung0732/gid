import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const css = await readFile(new URL("../games/harmony/styles.css", import.meta.url), "utf8");
const html = await readFile(new URL("../games/harmony/index.html", import.meta.url), "utf8");
assert.doesNotMatch(main, /requireHarmonyAccess|access\.js/);
assert.doesNotMatch(css, /access-(?:gate|locked|panel|form|error)/);
await assert.rejects(access(new URL("../games/harmony/access.js", import.meta.url)));
assert.match(css, /\.hand \.card \{\s*height:270px; min-height:270px; max-height:270px; align-self:flex-end;/);
assert.match(css, /26px minmax\(90px, 1fr\) 34px 32px auto/);
assert.match(html, /main\.js\?v=20260910-4/);

console.log("PASS Harmony public layout: password gate removed and desktop hand cards use a fixed responsive height.");
