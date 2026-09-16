import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(
  new URL("../games/harmony/pc-frame-ui.css", import.meta.url),
  "utf8",
);
const html = await readFile(
  new URL("../games/harmony/index.html", import.meta.url),
  "utf8",
);

assert.match(css, /body\s*\{[^}]*justify-content:\s*center;/s);
assert.match(
  css,
  /main\s*\{[^}]*height:\s*calc\(100dvh - 48px\);[^}]*max-height:\s*calc\(900px - 48px\);[^}]*margin:\s*0 auto;/s,
);
assert.match(
  css,
  /@media \(min-width:\s*901px\) and \(max-height:\s*800px\)[\s\S]*?main\s*\{[^}]*height:\s*calc\(100dvh - 42px\);/,
);
assert.match(html, /pc-frame-ui\.css\?v=20260916-1/);

console.log(
  "PASS Harmony PC frame: desktop stage is capped at the 1440x900 baseline and compact height remains viewport-bound.",
);
