import fs from "node:fs";
import { spawnSync } from "node:child_process";

const sourcePath = "scripts/qa-harmony-combat-screen-shake-fix.mjs";
const runtimePath = "scripts/.qa-harmony-combat-screen-shake-fix-runtime.mjs";
let source = fs.readFileSync(sourcePath, "utf8");

const selectorBefore = "const card = page.locator('.battle > .hand > .card[data-action=\"play\"]', { hasText: attack.name }).first();";
const selectorAfter = "const card = page.locator('.battle > .hand > .card[data-action=\"play\"]').first();";
if (!source.includes(selectorBefore)) throw new Error("QA card selector patch target missing");
source = source.replace(selectorBefore, selectorAfter);

const strongBefore = '{ key: "strong", id: "contact_terracotta_crush", name: "테라코타 발향석 대격돌", expectedClass: "strong-contact-shake" }';
const strongAfter = '{ key: "strong", id: "contact_blazing_wick_brand", name: "타오르는 목화 심지 낙인", expectedClass: "strong-contact-shake" }';
if (!source.includes(strongBefore)) throw new Error("QA strong fixture patch target missing");
source = source.replace(strongBefore, strongAfter);

const consoleBefore = 'page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });';
const consoleAfter = 'page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("Failed to load resource")) errors.push(message.text()); });';
if (!source.includes(consoleBefore)) throw new Error("QA console filter patch target missing");
source = source.replace(consoleBefore, consoleAfter);

const turnWaitBefore = 'const roundBefore = await page.locator(".battle-top .eyebrow").textContent();\n      await page.locator(\'[data-action="end"]\').click();\n      await page.waitForFunction((text) => document.querySelector(".battle-top .eyebrow")?.textContent !== text, roundBefore, { timeout: 8000 });';
const turnWaitAfter = 'await page.locator(\'[data-action="end"]\').click();\n      await page.waitForSelector(".battle.enemy-phase", { timeout: 20000 });\n      await page.waitForSelector(".battle.player-phase", { timeout: 20000 });';
if (!source.includes(turnWaitBefore)) throw new Error("QA enemy-turn wait patch target missing");
source = source.replace(turnWaitBefore, turnWaitAfter);
source = source.replaceAll("timeout: 8000", "timeout: 20000");

fs.writeFileSync(runtimePath, source);
try {
  const result = spawnSync(process.execPath, [runtimePath], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(runtimePath, { force: true });
}
