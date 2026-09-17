import fs from "node:fs";
import { spawnSync } from "node:child_process";

const sourcePath = "scripts/qa-harmony-combat-screen-shake-fix.mjs";
const runtimePath = "scripts/.qa-harmony-combat-screen-shake-fix-runtime.mjs";
let source = fs.readFileSync(sourcePath, "utf8");

const before = "const card = page.locator(CARD_SELECTOR, { hasText: ATTACK.name }).first();";
const after = "const card = page.locator(CARD_SELECTOR).first();";
if (!source.includes(before)) throw new Error("mobile card selector patch target missing");
source = source.replace(before, after);

fs.writeFileSync(runtimePath, source);
try {
  const result = spawnSync(process.execPath, [runtimePath], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(runtimePath, { force: true });
}
