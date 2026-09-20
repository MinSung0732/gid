import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../games/harmony/styles.css", import.meta.url), "utf8");

assert.match(main, /const hasActiveRun = Boolean\(run && !run\.finished\)/);
assert.match(
  main,
  /hasActiveRun[\s\S]*?<button class="primary lobby-action-primary" data-action="resume">이전 여정 이어하기 →<\/button>/,
  "active run should promote resume to the primary CTA",
);
assert.match(
  main,
  /newAction = \x60<button class="\$\{hasActiveRun \? "lobby-action-secondary" : "primary lobby-action-primary"\}" data-action="new">/,
  "new journey should be primary only without an active run",
);
assert.match(
  main,
  /class="local-test-entry lobby-action-tertiary" data-action="test-new"/,
  "LOCAL Card Lab should stay a tertiary launcher action",
);
assert.ok(
  main.includes("${resumeAction}${newAction}${localAction}"),
  "CTA render order should be resume → new → LOCAL",
);
assert.match(main, /class="lobby-record-panel" aria-labelledby="lobby-record-heading"/);
assert.match(main, /class="lobby-record-heading"/);
assert.match(main, /id="lobby-record-heading">YOUR HARMONY RECORD<\/span>/);
assert.match(main, /class="lobby-record-grid"/);
assert.equal(
  (main.match(/class="lobby-record-stat/g) || []).length,
  3,
  "Lobby record should render exactly three stats",
);
assert.match(main, /class="lobby-record-stat featured"[^>]*aria-label="최고 점수 \$\{number\(meta\.highScore\)\}점"/);
for (const label of ["완료한 여정", "최고 점수", "최고 도달"])
  assert.ok(main.includes(label), "missing lobby stat: " + label);
for (const english of ["JOURNEYS", "BEST SCORE", "DEEPEST RUN"])
  assert.ok(main.includes(english), "missing lobby stat caption: " + english);
for (const icon of ["◇", "✦", "♢"])
  assert.ok(main.includes(`aria-hidden="true">${icon}</span>`), "record icon should be decorative: " + icon);
assert.ok(main.includes("${number(meta.totalRuns)}"), "totalRuns must keep number(...) formatting");
assert.ok(main.includes("${number(meta.highScore)}"), "highScore must keep number(...) formatting");
assert.ok(main.includes("${number(meta.highestLoop)}막"), "highestLoop must keep number(...) source with a presentation suffix");
for (const feature of ["01 · CARD", "02 · CHANCE", "03 · DISCOVERY"])
  assert.ok(main.includes(feature), "missing lobby feature label: " + feature);
assert.match(main, /src="\.\.\/\.\.\/public\/assets\/object-2048\/2048\.png"/);
assert.match(main, /lobby-art-note-top[^>]*aria-hidden="true"/);
assert.match(main, /lobby-art-note-middle[^>]*aria-hidden="true"/);
assert.match(main, /lobby-art-note-base[^>]*aria-hidden="true"/);

assert.match(styles, /main:has\(#app > \.lobby-hero\) \{\s*max-width:\s*1260px;/);
assert.match(styles, /\.lobby-hero \{[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.28fr\) minmax\(300px, \.92fr\);/);
assert.match(styles, /\.lobby-actions \.lobby-action-primary \{[\s\S]*?grid-column:\s*1 \/ -1;/);
assert.match(styles, /\.local-test-entry\.lobby-action-tertiary \{[\s\S]*?box-shadow:\s*none;/);
assert.match(styles, /\.lobby-record-panel \{[\s\S]*?min-height:\s*118px;/);
assert.match(styles, /\.lobby-record-panel \{[\s\S]*?border:\s*1px solid #f8e29a2f;/);
assert.match(styles, /\.lobby-record-grid \{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/);
assert.match(styles, /\.lobby-record-stat \+ \.lobby-record-stat::before \{[\s\S]*?background:\s*#ffffff14;/);
assert.match(styles, /\.lobby-record-value \{[\s\S]*?font-size:\s*clamp\(22px, 2\.25vw, 28px\);[\s\S]*?font-variant-numeric:\s*tabular-nums;/);
assert.match(styles, /\.lobby-record-stat\.featured \.lobby-record-value \{[\s\S]*?font-size:\s*clamp\(24px, 2\.4vw, 30px\);/);
assert.match(styles, /@media \(max-width:\s*520px\)[\s\S]*?\.lobby-record-grid \{[\s\S]*?grid-template-columns:\s*1fr;/);
assert.match(styles, /\.lobby-features article \{[\s\S]*?min-height:\s*112px;/);
assert.match(styles, /\.lobby-features article:hover \{[\s\S]*?translateY\(-2px\)/);
assert.match(styles, /@media \(max-width:\s*700px\)[\s\S]*?\.lobby-hero \{[\s\S]*?grid-template-columns:\s*1fr;/);
assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.lobby-actions > button/);

const lobbySource = main.slice(main.indexOf("function lobby()"), main.indexOf("function hud()"));
assert.doesNotMatch(lobbySource, /Math\.|reduce\(|highestLoop\s*[+\-*/]/, "record panel must not add meta calculation logic");
for (const forbidden of ["E.newRun(", "persistenceRuntime.save(", "openHarmonyConfirm("])
  assert.equal(
    lobbySource.includes(forbidden),
    false,
    "lobby presentation must not introduce runtime logic: " + forbidden,
  );

console.log("PASS Harmony lobby launcher presentation contracts.");
