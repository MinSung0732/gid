import {
  newGame,
  addRandom,
  move,
  canMove,
  highestTile,
  tileInfo,
} from "./data.js";
import {
  shareObjectKakao,
  shareObjectImage,
  shareObjectLink,
} from "./share.js";
const effects = document.createElement("link");
effects.rel = "stylesheet";
effects.href = "./effects.css";
document.head.append(effects);
const shareStyles = document.createElement("link");
shareStyles.rel = "stylesheet";
shareStyles.href = "./share.css";
document.head.append(shareStyles);
const $ = (id) => document.getElementById(id),
  key = "gyeolideun-object-2048-v1",
  read = (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  write = (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {}
  };
let board,
  score = 0,
  best = Number(read(`${key}-best`)) || 0,
  previous = null,
  usedUndo = false,
  sound = true,
  audio,
  moving = false,
  celebrated = false,
  gameSession = 0;
const cells = Array.from({ length: 16 }, () => {
  const cell = document.createElement("div");
  cell.className = "cell";
  $("board").append(cell);
  return cell;
});
const celebration = document.createElement("div");
celebration.id = "celebration";
celebration.className = "celebration";
celebration.hidden = true;
$("board").after(celebration);
const shareActions = document.createElement("div");
shareActions.className = "result-share";
shareActions.innerHTML =
  '<button id="kakao-result-share" type="button">카카오톡</button><button id="image-result-share" type="button">이미지 저장</button><button id="link-result-share" type="button">링크 복사</button>';
const shareStatus = document.createElement("p");
shareStatus.id = "share-status";
shareStatus.className = "share-status";
shareStatus.setAttribute("role", "status");
$("retry").before(shareActions);
$("retry").after(shareStatus);
const talk = {
  4: "분홍빛 향기가 피어났어요.",
  8: "싱그러운 크리스탈이에요.",
  16: "맑은 빛이 더해졌어요.",
  32: "볼케닉 스톤을 발견했어요!",
  64: "향기가 풍성해지고 있어요.",
  128: "차분한 향이 머물러요.",
  256: "첫 번째 오브제를 완성했어요!",
  512: "크리스탈 오브제가 빛나요.",
  1024: "볼케닉 오브제 완성!",
  2048: "결이든 시그니처 세트를 완성했어요!",
};
function tone(value) {
  if (!sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.frequency.value = 380 + Math.log2(value) * 38;
    g.gain.setValueAtTime(0.04, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.22);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.23);
  } catch {}
}
function fanfare() {
  if (!sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
    [523, 659, 784, 1047].forEach((frequency, index) => {
      const o = audio.createOscillator(),
        g = audio.createGain(),
        start = audio.currentTime + index * 0.13;
      o.type = "triangle";
      o.frequency.value = frequency;
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(0.065, start + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.42);
      o.connect(g);
      g.connect(audio.destination);
      o.start(start);
      o.stop(start + 0.45);
    });
    [1319, 1976].forEach((frequency, index) => {
      const o = audio.createOscillator(),
        g = audio.createGain(),
        start = audio.currentTime + 0.55;
      o.type = "sine";
      o.frequency.value = frequency;
      g.gain.setValueAtTime(0.035 / (index + 1), start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 1.15);
      o.connect(g);
      g.connect(audio.destination);
      o.start(start);
      o.stop(start + 1.2);
    });
  } catch {}
}
async function celebrate() {
  celebration.replaceChildren();
  const card = document.createElement("div");
  card.className = "celebrate-card";
  card.innerHTML =
    "<small>GYEOLIDEUN SIGNATURE</small><strong>2048 오브제 완성!</strong>";
  celebration.append(card);
  for (let i = 0; i < 34; i++) {
    const dot = document.createElement("i"),
      angle = (i / 34) * Math.PI * 2,
      distance = 120 + (i % 6) * 18;
    dot.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    dot.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    dot.style.setProperty("--delay", `${(i % 5) * 0.035}s`);
    celebration.append(dot);
  }
  celebration.hidden = false;
  const duration = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ? 0
    : 2600;
  await new Promise((resolve) => setTimeout(resolve, duration));
  celebration.hidden = true;
}
function showVictory() {
  $("overlay-label").textContent = "2048 오브제를 완성했어요!";
  $("final-score").textContent = `${score.toLocaleString("ko-KR")}점`;
  $("retry").textContent = "다시 만들기";
  $("overlay").hidden = false;
  $("undo").disabled = true;
}
function save() {
  write(key, JSON.stringify({ board, score, usedUndo, celebrated }));
  write(`${key}-best`, String(best));
}
function render(merged = []) {
  cells.forEach((cell, index) => {
    cell.replaceChildren();
    const value = board[index];
    if (!value) return;
    const tile = document.createElement("div");
    tile.className = `tile${merged.includes(index) ? " merged" : ""}`;
    tile.style.backgroundImage = `url('../../public/assets/object-2048/${Math.min(value, 2048)}.png')`;
    tile.innerHTML = `<span>${value}</span>`;
    cell.append(tile);
  });
  $("score").textContent = score.toLocaleString("ko-KR");
  $("best").textContent = best.toLocaleString("ko-KR");
  $("highest").textContent = highestTile(board);
  $("undo").disabled = !previous || usedUndo;
}
function syncGameOver() {
  if (celebrated) {
    showVictory();
    return true;
  }
  const over = !canMove(board);
  $("overlay").hidden = !over;
  if (over) {
    $("undo").disabled = true;
    $("overlay-label").textContent = "향기가 가득 찼어요";
    $("retry").textContent = "다시 만들기";
    $("final-score").textContent = `${score.toLocaleString("ko-KR")}점`;
    $("talk").textContent = "멋진 향기 오브제를 만들었어요.";
  }
  return over;
}
function start() {
  gameSession += 1;
  moving = false;
  celebrated = false;
  board = newGame();
  score = 0;
  previous = null;
  usedUndo = false;
  $("overlay").hidden = true;
  celebration.hidden = true;
  $("talk").textContent = "같은 향기 스톤을 이어주세요.";
  save();
  render();
}
function slide(result) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
    return Promise.resolve();
  const animations = [];
  result.transitions.forEach(({ from, to }) =>
    from.forEach((source) => {
      if (source === to) return;
      const tile = cells[source].querySelector(".tile");
      if (!tile?.animate) return;
      tile.classList.add("sliding");
      const a = cells[source].getBoundingClientRect(),
        b = cells[to].getBoundingClientRect();
      animations.push(
        tile
          .animate(
            [
              { transform: "translate3d(0,0,0)" },
              {
                transform: `translate3d(${b.left - a.left}px,${b.top - a.top}px,0)`,
              },
            ],
            {
              duration: 185,
              easing: "cubic-bezier(.2,.72,.25,1)",
              fill: "forwards",
            },
          )
          .finished.catch(() => {}),
      );
    }),
  );
  return Promise.all(animations);
}
async function apply(direction) {
  if (moving) return;
  const result = move(board, direction);
  if (!result.moved) return;
  moving = true;
  const before = { board: [...board], score };
  await slide(result);
  previous = before;
  board = addRandom(result.board);
  score += result.score;
  best = Math.max(best, score);
  const top = Math.max(...result.merged.map((index) => result.board[index]), 0);
  const won = top >= 2048 && !celebrated;
  if (top) {
    $("talk").textContent =
      talk[Math.min(top, 2048)] || "향기가 한층 깊어졌어요.";
    if (won) {
      celebrated = true;
      fanfare();
    } else tone(top);
  }
  save();
  render(result.merged);
  if (won) {
    const winningSession = gameSession;
    await celebrate();
    if (winningSession !== gameSession) return;
    showVictory();
    moving = false;
    return;
  }
  moving = false;
  if (!canMove(board)) setTimeout(syncGameOver, 250);
}
const directions = {
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
  ArrowUp: "up",
  w: "up",
  W: "up",
  ArrowDown: "down",
  s: "down",
  S: "down",
};
document.addEventListener("keydown", (event) => {
  const direction = directions[event.key];
  if (direction) {
    event.preventDefault();
    apply(direction);
  }
});
let touch = null;
$("board").addEventListener("dragstart", (event) => event.preventDefault());
$("board").addEventListener("selectstart", (event) => event.preventDefault());
$("board").addEventListener("pointerdown", (event) => {
  touch = { x: event.clientX, y: event.clientY };
  $("board").setPointerCapture?.(event.pointerId);
});
$("board").addEventListener("pointerup", (event) => {
  if (!touch) return;
  const dx = event.clientX - touch.x,
    dy = event.clientY - touch.y;
  touch = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  apply(
    Math.abs(dx) > Math.abs(dy)
      ? dx > 0
        ? "right"
        : "left"
      : dy > 0
        ? "down"
        : "up",
  );
});
$("undo").addEventListener("click", () => {
  if (!previous || usedUndo || !canMove(board)) return;
  board = previous.board;
  score = previous.score;
  previous = null;
  usedUndo = true;
  $("overlay").hidden = true;
  save();
  render();
  $("talk").textContent = "한 걸음 전으로 돌아왔어요.";
});
$("restart").addEventListener("click", () => {
  if (confirm("현재 오브제를 지우고 새로 시작할까요?")) start();
});
$("retry").addEventListener("click", start);
$("sound").addEventListener("click", () => {
  sound = !sound;
  $("sound").textContent = sound ? "소리 켜짐" : "소리 꺼짐";
  $("sound").setAttribute("aria-pressed", String(sound));
});
const shareRecord = () => ({ score, best, tile: highestTile(board) });
async function runShare(button, action) {
  button.disabled = true;
  shareStatus.textContent = "공유를 준비하고 있어요.";
  try {
    const message = await action(shareRecord());
    shareStatus.textContent = message || "공유 창을 열었어요.";
  } catch (error) {
    shareStatus.textContent =
      error?.name === "AbortError"
        ? "공유를 취소했어요."
        : "공유하지 못했어요. 잠시 후 다시 시도해 주세요.";
  } finally {
    button.disabled = false;
  }
}
$("kakao-result-share").addEventListener("click", (event) =>
  runShare(event.currentTarget, shareObjectKakao),
);
$("image-result-share").addEventListener("click", (event) =>
  runShare(event.currentTarget, shareObjectImage),
);
$("link-result-share").addEventListener("click", (event) =>
  runShare(event.currentTarget, shareObjectLink),
);
$("retry").addEventListener("click", () => {
  shareStatus.textContent = "";
});
let saved = null;
try {
  saved = JSON.parse(read(key));
} catch {}
if (saved?.board?.length === 16 && saved.board.some(Boolean)) {
  board = saved.board;
  score = Number(saved.score) || 0;
  usedUndo = Boolean(saved.usedUndo);
  celebrated = Boolean(saved.celebrated);
  render();
  syncGameOver();
  $("resume-dialog").showModal();
} else start();
$("resume").addEventListener("click", () => {
  $("resume-dialog").close();
  syncGameOver();
});
$("fresh").addEventListener("click", () => {
  $("resume-dialog").close();
  start();
});
addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  let current = null;
  try {
    current = JSON.parse(read(key));
  } catch {}
  if (!current?.board?.length) return;
  board = current.board;
  score = Number(current.score) || 0;
  usedUndo = Boolean(current.usedUndo);
  celebrated = Boolean(current.celebrated);
  previous = null;
  moving = false;
  render();
  syncGameOver();
});
