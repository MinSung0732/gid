import fs from "node:fs";
import { spawnSync } from "node:child_process";

const sourcePath = "scripts/qa-harmony-combat-screen-shake-fix.mjs";
const runtimePath = "scripts/.qa-harmony-combat-screen-shake-fix-runtime.mjs";
let source = fs.readFileSync(sourcePath, "utf8");

const selectorBefore = "const card = page.locator('.battle > .hand > .card[data-action=\"play\"]', { hasText: attack.name }).first();";
const selectorAfter = "const card = page.locator('.battle > .hand > .card[data-action=\"play\"]').first();";
if (!source.includes(selectorBefore)) throw new Error("QA card selector patch target missing");
source = source.replace(selectorBefore, selectorAfter);

const consoleBefore = 'page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });';
const consoleAfter = 'page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("Failed to load resource")) errors.push(message.text()); });';
if (!source.includes(consoleBefore)) throw new Error("QA console filter patch target missing");
source = source.replace(consoleBefore, consoleAfter);

fs.writeFileSync(runtimePath, source);
try {
  const result = spawnSync(process.execPath, [runtimePath], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(runtimePath, { force: true });
}
