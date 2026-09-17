import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pcRouteViewModel } from "../games/harmony/pc-route-ui.js";

const css = await readFile(new URL("../games/harmony/pc-frame-ui.css", import.meta.url), "utf8");
const routeCss = await readFile(new URL("../games/harmony/pc-route-ui.css", import.meta.url), "utf8");
const html = await readFile(new URL("../games/harmony/index.html", import.meta.url), "utf8");
const bootstrap = await readFile(new URL("../games/harmony/bootstrap.js", import.meta.url), "utf8");
const frame = await readFile(new URL("../games/harmony/pc-frame-ui.js", import.meta.url), "utf8");

assert.match(css, /body\s*\{[^}]*justify-content:\s*center;/s);
assert.match(css, /main\s*\{[^}]*height:\s*calc\(100dvh - 48px\);[^}]*max-height:\s*calc\(900px - 48px\);[^}]*margin:\s*0 auto;/s);
assert.match(css, /#app:has\(> \.play-layout\)\s*\{[^}]*grid-template-rows:\s*58px 28px minmax\(0, 1fr\);/s);
assert.match(css, /@media \(min-width:\s*901px\) and \(max-height:\s*800px\)[\s\S]*?#app:has\(> \.play-layout\)\s*\{[^}]*grid-template-rows:\s*52px 24px minmax\(0, 1fr\);/);
assert.match(routeCss, /\.pc-route-popover\s*\{[^}]*position:\s*absolute;/s);
assert.match(routeCss, /prefers-reduced-motion:\s*reduce/);
assert.match(html, /pc-frame-ui\.css\?v=20260916-1/);
assert.match(html, /pc-route-ui\.css\?v=20260917-1/);
assert.match(bootstrap, /pc-frame-ui\.js\?v=20260917-2/);
assert.match(frame, /renderPcRoute\(route, run, E\)/);

const route = ["combat", "treasure", "shop", "elite", "treasure", "combat", "shop", "combat", "treasure", "elite", "combat", "boss"];
const run = {
  node: 3,
  route,
  currentSubRoom: "elite",
  resolvedRooms: ["battle", "gather", "rest", "elite", null, null, null, null, null, null, null, null],
};
const model = pcRouteViewModel(run, { routeFor: () => route });
assert.equal(model.room, 4);
assert.equal(model.nodes.length, 12);
assert.equal(model.nodes[0].kind, "battle");
assert.equal(model.nodes[1].kind, "gather");
assert.equal(model.nodes[2].kind, "rest");
assert.equal(model.nodes[3].state, "current");
assert.notEqual(model.nodes[3].icon, "?");
assert.equal(model.nodes[4].state, "next");
assert.notEqual(model.nodes[4].icon, "?");
assert.equal(model.nodes[5].icon, "?");
assert.equal(model.nodes[11].kind, "boss");
assert.notEqual(model.nodes[11].icon, "?");

console.log("PASS Harmony PC frame + dungeon route: fixed battle rows, compact route, anchored overlay, progressive reveal, and boss telegraph.");
