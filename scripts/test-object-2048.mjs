import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import {
  emptyBoard,
  addRandom,
  newGame,
  move,
  canMove,
  highestTile,
  tileInfo,
} from "../games/object-2048/data.js";
import {
  PUBLIC_OBJECT_PAGE,
  PUBLIC_GAMES_PAGE,
  objectShareText,
} from "../games/object-2048/share.js";
assert.equal(Object.keys(tileInfo).length, 11);
assert.deepEqual(newGame(() => 0).filter(Boolean), [2, 2]);
assert.equal(addRandom(emptyBoard(), () => 0.95).filter(Boolean)[0], 4);
let board = [2, 2, 4, 4, ...Array(12).fill(0)],
  result = move(board, "left");
assert.deepEqual(result.board.slice(0, 4), [4, 8, 0, 0]);
assert.equal(result.score, 12);
assert.equal(result.merged.length, 2);
assert.deepEqual(result.transitions, [
  { from: [0, 1], to: 0 },
  { from: [2, 3], to: 1 },
]);
result = move([2, 2, 2, 2, ...Array(12).fill(0)], "left");
assert.deepEqual(result.board.slice(0, 4), [4, 4, 0, 0]);
result = move([4, 4, 8, 0, ...Array(12).fill(0)], "right");
assert.deepEqual(result.board.slice(0, 4), [0, 0, 8, 8]);
assert.deepEqual(result.transitions, [
  { from: [2], to: 3 },
  { from: [1, 0], to: 2 },
]);
assert.equal(move([2, 4, 8, 16, ...Array(12).fill(0)], "left").moved, false);
assert.equal(highestTile([2, 64, 8]), 64);
assert.equal(canMove([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2]), false);
assert.equal(canMove([2, 2, ...Array(14).fill(4)]), true);
await Promise.all(
  Object.keys(tileInfo).map((value) =>
    access(
      new URL(`../public/assets/object-2048/${value}.png`, import.meta.url),
    ),
  ),
);
const css = await readFile(
    new URL("../games/object-2048/styles.css", import.meta.url),
    "utf8",
  ),
  effects = await readFile(
    new URL("../games/object-2048/effects.css", import.meta.url),
    "utf8",
  ),
  html = await readFile(
    new URL("../games/object-2048/index.html", import.meta.url),
    "utf8",
  ),
  main = await readFile(
    new URL("../games/object-2048/main.js", import.meta.url),
    "utf8",
  ),
  preview = await readFile(
    new URL("../public/mobile-preview.js", import.meta.url),
    "utf8",
  );
assert.match(css, /100dvh/);
assert.match(css, /overflow:hidden/);
assert.match(css, /touch-action:none/);
assert.match(html, /\[hidden\]\{display:none!important\}/);
assert.match(html, /user-select:none/);
assert.match(html, /\.cell\{overflow:visible\}/);
assert.match(html, /@keyframes mergeBubble/);
assert.match(html, /@keyframes scentBubble/);
assert.match(html, /public\/mobile-preview\.js/);
assert.match(main, /dragstart/);
assert.match(main, /selectstart/);
assert.match(main, /classList\.add\(["']sliding["']\)/);
assert.match(main, /translate3d/);
assert.match(preview, /localHosts\.has\(window\.location\.hostname\)/);
assert.match(preview, /!params\.has\('mobilePreview'\)/);
assert.match(effects, /@keyframes gold-wave/);
assert.match(effects, /@keyframes aroma-burst/);
assert.match(main, /function fanfare\(\)/);
assert.match(main, /top\s*>=\s*2048\s*&&\s*!celebrated/);
assert.match(
  main,
  /await celebrate\(\);\s*if \(winningSession !== gameSession\) return;\s*showVictory\(\)/,
);
assert.match(main, /if \(celebrated\) \{\s*showVictory\(\)/);
assert.match(main, /celebrated\s*=\s*Boolean\(saved\.celebrated\)/);
const shareCss = await readFile(
    new URL("../games/object-2048/share.css", import.meta.url),
    "utf8",
  ),
  share = await readFile(
    new URL("../games/object-2048/share.js", import.meta.url),
    "utf8",
  );
assert.equal(new URL(PUBLIC_OBJECT_PAGE).pathname, "/gid/games/object-2048/");
assert.equal(new URL(PUBLIC_GAMES_PAGE).pathname, "/gid/games/");
assert.match(objectShareText({ score: 1416, tile: 128 }), /1,416/);
assert.match(objectShareText({ score: 1416, tile: 128 }), /128/);
assert.match(
  share,
  /mobileWebUrl:\s*PUBLIC_GAMES_PAGE,\s*webUrl:\s*PUBLIC_GAMES_PAGE/,
);
assert.match(share, /Kakao/);
assert.doesNotMatch(share, /navigator\.share/);
assert.match(share, /anchor\.download/);
assert.match(share, /clipboard\.writeText/);
assert.match(shareCss, /result-share/);
assert.match(main, /sound\s*=\s*true/);
assert.match(main, /kakao-result-share/);
assert.match(main, /image-result-share/);
assert.match(main, /link-result-share/);
assert.match(main, /function syncGameOver\(\)/);
assert.match(main, /addEventListener\("pageshow"/);
assert.doesNotMatch(
  main,
  /best = Math\.max\(best, score\);\s*usedUndo = false/,
);
assert.match(main, /usedUndo = true;\s*\$\("overlay"\)\.hidden = true/);
assert.match(main, /if \(over\) \{\s*\$\("undo"\)\.disabled = true/);
assert.match(main, /!previous \|\| usedUndo \|\| !canMove\(board\)/);
console.log("PASS: object 2048 movement, effects, and result sharing.");
