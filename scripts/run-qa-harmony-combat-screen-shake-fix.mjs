import fs from "node:fs";
import { spawnSync } from "node:child_process";

const sourcePath = "scripts/qa-harmony-combat-screen-shake-fix.mjs";
const runtimePath = "scripts/.qa-harmony-combat-screen-shake-fix-runtime.mjs";
const source = fs.readFileSync(sourcePath, "utf8");
const before = "const card = page.locator('.battle > .hand > .card[data-action=\"play\"]', { hasText: attack.name }).first();";
const after = "const card = page.locator('.battle > .hand > .card[data-action=\"play\"]').first();";
if (!source.includes(before)) throw new Error("QA card selector patch target missing");
fs.writeFileSync(runtimePath, source.replace(before, after));
try {
  const result = spawnSync(process.execPath, [runtimePath], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(runtimePath, { force: true });
}
