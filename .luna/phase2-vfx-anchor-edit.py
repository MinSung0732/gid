from pathlib import Path

path = Path("games/harmony/main.js")
text = path.read_text(encoding="utf-8")

import_block = '''import {
  shareHarmonyImage,
  shareHarmonyKakao,
  shareHarmonyLink,
} from "./share.js";
'''
new_import = '''import {
  getPlayerHealthAnchor,
  getPlayerImpactPoint,
} from "./player-vfx-anchor.js";
'''

if new_import in text:
    raise SystemExit("player VFX anchor import already exists")
if text.count(import_block) != 1:
    raise SystemExit("share import anchor did not match exactly once")
text = text.replace(import_block, import_block + new_import, 1)

start_marker = "function getPlayerHealthAnchor() {"
end_marker = "function showPlayerDamage("
start = text.find(start_marker)
if start == -1:
    raise SystemExit("getPlayerHealthAnchor implementation not found")
end = text.find(end_marker, start)
if end == -1:
    raise SystemExit("showPlayerDamage boundary not found")
removed = text[start:end]
if "function getPlayerImpactPoint()" not in removed:
    raise SystemExit("getPlayerImpactPoint was not inside the extraction block")
if removed.count("function ") != 2:
    raise SystemExit("unexpected functions inside player VFX extraction block")

text = text[:start] + text[end:]
if start_marker in text or "function getPlayerImpactPoint()" in text:
    raise SystemExit("player VFX anchor implementations still remain in main.js")

path.write_text(text, encoding="utf-8")
