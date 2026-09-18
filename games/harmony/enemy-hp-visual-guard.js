// Prevent transient enemy HP bar rollbacks during one player-card resolution.
//
// The combat engine resolves all hits first, while main.js replays those hits
// visually afterwards. Some multi-hit + follow-up combinations rebuild a local
// visual HP cursor from the pre-card snapshot, which can briefly make an enemy
// look healed before the final render restores the real HP. This guard owns only
// the presentation layer: during one card resolution, an enemy HP display may
// stay the same or decrease, but never increase.
//
// Keep this separate from engine HP state. Legitimate healing outside the active
// player-card resolution is untouched, and a new card starts a fresh sequence.

const app = document.getElementById("app");

const MAX_SEQUENCE_MS = 6500;
const POST_HIT_IDLE_MS = 900;

let sequence = null;
let sequenceId = 0;
let syncQueued = false;
let finishTimer = null;
let maxTimer = null;

function enemyIndex(element) {
  const value = Number(element?.dataset?.target);
  return Number.isInteger(value) ? value : null;
}

function readHealth(element) {
  const label = element?.querySelector(".enemy-health-value")?.textContent || "";
  const match = label.match(/(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const hp = Number(match[1]),
    maxHp = Number(match[2]);
  return Number.isFinite(hp) && Number.isFinite(maxHp) && maxHp > 0
    ? { hp: Math.max(0, hp), maxHp }
    : null;
}

function snapshotEnemies() {
  const states = new Map();
  for (const enemy of app?.querySelectorAll(".battle .enemy[data-target]") || []) {
    const index = enemyIndex(enemy),
      health = readHealth(enemy);
    if (index === null || !health) continue;
    states.set(index, { minHp: health.hp, maxHp: health.maxHp });
  }
  return states;
}

function clearTimers() {
  if (finishTimer) window.clearTimeout(finishTimer);
  if (maxTimer) window.clearTimeout(maxTimer);
  finishTimer = null;
  maxTimer = null;
}

function endSequence(id = sequence?.id) {
  if (!sequence || sequence.id !== id) return;
  clearTimers();
  sequence = null;
}

function scheduleIdleEnd() {
  if (!sequence?.sawDecrease) return;
  if (finishTimer) window.clearTimeout(finishTimer);
  const id = sequence.id;
  finishTimer = window.setTimeout(() => endSequence(id), POST_HIT_IDLE_MS);
}

function beginSequence() {
  const states = snapshotEnemies();
  if (!states.size) return;
  clearTimers();
  sequence = {
    id: ++sequenceId,
    states,
    sawDecrease: false,
  };
  const id = sequence.id;
  maxTimer = window.setTimeout(() => endSequence(id), MAX_SEQUENCE_MS);
}


export function beginEnemyHpVisualGuard() {
  beginSequence();
}

export function endEnemyHpVisualGuard() {
  endSequence();
}

export function enemyHpVisualGuardSnapshot() {
  return sequence
    ? {
        active: true,
        id: sequence.id,
        sawDecrease: sequence.sawDecrease,
        targets: [...sequence.states.keys()],
      }
    : { active: false, id: null, sawDecrease: false, targets: [] };
}

function writeHealth(element, hp, maxHp) {
  const bar = element.querySelector(".enemy-hp > span"),
    label = element.querySelector(".enemy-health-value"),
    safeHp = Math.max(0, Math.min(maxHp, hp));
  if (bar) {
    const width = `${(100 * safeHp) / maxHp}%`;
    if (bar.style.width !== width) bar.style.width = width;
  }
  if (label) {
    const text = `${safeHp} / ${maxHp}`;
    if (label.textContent !== text) label.textContent = text;
  }
}

function enforceMonotonicHp() {
  syncQueued = false;
  if (!sequence || !app) return;

  const battle = app.querySelector(".battle");
  if (!battle || battle.classList.contains("enemy-phase")) {
    endSequence();
    return;
  }

  let sawDecreaseNow = false;
  for (const enemy of battle.querySelectorAll(".enemy[data-target]")) {
    const index = enemyIndex(enemy),
      health = readHealth(enemy);
    if (index === null || !health) continue;

    let state = sequence.states.get(index);
    if (!state) {
      // A newly rendered/replaced enemy node in the same card resolution keeps
      // the first value we see as its baseline.
      state = { minHp: health.hp, maxHp: health.maxHp };
      sequence.states.set(index, state);
      continue;
    }

    // Max HP changes are not part of ordinary hit feedback. If a future mechanic
    // legitimately changes max HP, rebase instead of forcing an obsolete ratio.
    if (health.maxHp !== state.maxHp) {
      state.maxHp = health.maxHp;
      state.minHp = Math.min(health.hp, health.maxHp);
      continue;
    }

    if (health.hp < state.minHp) {
      state.minHp = health.hp;
      sequence.sawDecrease = true;
      sawDecreaseNow = true;
      continue;
    }

    if (health.hp > state.minHp) {
      // MutationObserver runs before the next paint, so correcting here prevents
      // the one/two-frame full-HP flash rather than merely correcting it later.
      writeHealth(enemy, state.minHp, state.maxHp);
    }
  }

  if (sawDecreaseNow || sequence.sawDecrease) scheduleIdleEnd();
}

function queueSync() {
  if (!sequence || syncQueued) return;
  syncQueued = true;
  queueMicrotask(enforceMonotonicHp);
}

if (app) {
  new MutationObserver(queueSync).observe(app, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["style", "class"],
  });
}
