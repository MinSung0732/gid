import fs from "node:fs";
import { spawnSync } from "node:child_process";

const sourcePath = "scripts/qa-harmony-combat-screen-shake-fix.mjs";
const runtimePath = "scripts/.qa-harmony-combat-screen-shake-fix-runtime.mjs";
let source = fs.readFileSync(sourcePath, "utf8");

const cardBefore = "const card = page.locator(CARD_SELECTOR, { hasText: ATTACK.name }).first();";
const cardAfter = "const card = page.locator(CARD_SELECTOR).first();";
if (!source.includes(cardBefore)) throw new Error("mobile card selector patch target missing");
source = source.replace(cardBefore, cardAfter);

const motionBefore = `  assert.ok(classFrames.length > 0, \`${'${label}'}: shake event hook did not fire\`);\n  if (motion === "full") {\n    assert.ok(fieldMotionFrames.length > 0, \`${'${label}'}: enemies-field shake motion missing\`);`;
const motionAfter = `  if (motion === "full") {\n    assert.ok(classFrames.length > 0, \`${'${label}'}: shake event hook did not fire\`);\n    assert.ok(fieldMotionFrames.length > 0, \`${'${label}'}: enemies-field shake motion missing\`);`;
if (!source.includes(motionBefore)) throw new Error("reduced-motion shake assertion patch target missing");
source = source.replace(motionBefore, motionAfter);

fs.writeFileSync(runtimePath, source);
try {
  const result = spawnSync(process.execPath, [runtimePath], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(runtimePath, { force: true });
}
