import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["scripts/qa-harmony-combat-screen-shake-fix.mjs"], {
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;
