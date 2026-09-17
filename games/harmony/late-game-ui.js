import { CARDS } from "./data.js";
import { loadGame } from "./persistence.js?v=20260915-2";

const NOTE_LABEL = Object.freeze({ top: "TOP", middle: "MIDDLE", base: "BASE" });

function stacks(entity, id) {
  const value = entity?.statuses?.[id];
  return typeof value === "number"
    ? Math.max(0, value)
    : Math.max(0, Number(value?.stacks) || 0);
}

function phaseIndex(enemy) {
  if (!Array.isArray(enemy?.phases) || enemy.phases.length <= 1) return -1;
  if (Number.isInteger(enemy.patternV2State?.phaseIndex))
    return Math.max(0, Math.min(enemy.phases.length - 1, enemy.patternV2State.phaseIndex));
  const ratio = Math.max(0, Math.min(1, (Number(enemy.hp) || 0) / Math.max(1, Number(enemy.maxHp) || 1)));
  for (let index = 0; index < enemy.phases.length; index++) {
    if (ratio > Number(enemy.phases[index]?.hpAbove || 0) || index === enemy.phases.length - 1) return index;
  }
  return enemy.phases.length - 1;
}

function phaseText(enemy) {
  const index = phaseIndex(enemy);
  if (index < 0) return null;
  const phase = enemy.phases[index],
    label = phase?.label || phase?.id || `Phase ${index + 1}`,
    threshold = Number(phase?.hpAbove);
  if (index >= enemy.phases.length - 1 || !(threshold > 0)) return `PHASE ${index + 1} · ${label}`;
  return `PHASE ${index + 1} · ${label} · 다음 전환 HP ${Math.round(threshold * 100)}% 이하`;
}

function inspectionText(run, enemy) {
  const inspection = enemy?.customState?.inspection;
  if (!inspection) return null;
  const battle = run?.battle || {};
  if (inspection === "attack3") {
    const current = (Number(battle.contactCardsPlayedThisTurn) || 0) + (Number(battle.nonContactCardsPlayedThisTurn) || 0);
    return `검사 · 공격 카드 ${Math.min(3, current)} / 3`;
  }
  if (inspection === "nonContact2")
    return `검사 · 비접촉 카드 ${Math.min(2, Number(battle.nonContactCardsPlayedThisTurn) || 0)} / 2`;
  return `검사 · 방어막 획득 ${Math.min(20, Number(battle.lateShieldGainedThisTurn) || 0)} / 20`;
}

function fieldBurn(run) {
  return (run?.battle?.enemies || []).reduce((sum, enemy) => sum + stacks(enemy, "burning"), 0);
}

function namedTarget(run, id) {
  if (!id) return null;
  return (run?.battle?.enemies || []).find((enemy) => enemy.id === id)?.name || id;
}

function visibleIntentName(enemy) {
  const view = enemy?.intentView;
  if (view?.hidden || view?.visibility === "hidden" || view?.hiddenDetails) return null;
  return enemy?.intent?.name || null;
}

export function lateEnemyTelemetry(run, enemy) {
  if (!run?.battle || !enemy || enemy.hp <= 0) return [];
  const state = enemy.customState || {},
    rows = [],
    phase = phaseText(enemy),
    intentName = visibleIntentName(enemy);
  if (phase) rows.push({ icon: "◫", text: phase, kind: "phase" });

  if (intentName)
    rows.push({ icon: "◎", text: `예고 · ${intentName}`, kind: "intent" });

  if (["pressure2", "pressure3", "shieldBreakPressure"].includes(enemy.mechanic)) {
    const max = enemy.mechanic === "pressure2" ? 2 : 3;
    rows.push({ icon: "💥", text: `압력 ${Math.min(max, Number(state.pressure) || 0)} / ${max}`, kind: "danger" });
  }
  if (enemy.mechanic === "damageBreakCharge")
    rows.push({ icon: "◈", text: `충전 ${Math.min(2, Number(state.charge) || 0)} / 2 · 카드 1장 피해 20+ 시 -1`, kind: "danger" });
  if (enemy.mechanic === "attackedCounter") {
    const key = Object.prototype.hasOwnProperty.call(state, "instability") ? "instability" : "fracture",
      label = key === "instability" ? "불안정" : "균열";
    rows.push({ icon: "◈", text: `${label} ${Math.min(3, Number(state[key]) || 0)} / 3`, kind: "danger" });
  }
  if (enemy.mechanic === "cardsPlayedWatch")
    rows.push({ icon: "⚙", text: `사용 카드 ${Math.min(4, Number(run.battle.cardsPlayedThisTurn) || 0)} / 4`, kind: "watch" });
  if (enemy.mechanic === "fieldBurnCounter")
    rows.push({ icon: "♨", text: `연쇄열 ${Math.min(12, fieldBurn(run))} / 12`, kind: "danger" });

  const inspection = inspectionText(run, enemy);
  if (inspection) rows.push({ icon: "⌖", text: inspection, kind: "watch" });

  if (enemy.mechanic === "archivist") {
    const held = state.storedCard?.id,
      name = held ? CARDS[held]?.name || held : null;
    rows.push({ icon: "📖", text: name ? `흡수 카드 · ${name}` : "흡수 카드 · 없음", kind: "watch" });
    if (run.battle.lateHandAbsorbPending)
      rows.push({ icon: "📖", text: "턴 종료 시 손패 카드 1장 흡수", kind: "danger" });
  }
  if ((enemy.encounterTags || []).includes("summoner")) {
    const summons = (run.battle.enemies || []).filter((target) => target?.summoned && target.hp > 0).length;
    rows.push({ icon: "＋", text: `소환물 ${Math.min(2, summons)} / 2`, kind: "watch" });
  }
  if (enemy.mechanic === "symbioticLink") {
    const target = namedTarget(run, state.targetId);
    rows.push({
      icon: "⌘",
      text: `공생 연결 ${Math.min(30, Number(state.transferredDamage) || 0)} / 30${target ? ` · ${target}` : ""}`,
      kind: "watch",
    });
  }
  if (enemy.mechanic === "transferBurnOnDeath") {
    const target = namedTarget(run, state.targetId);
    if (target) rows.push({ icon: "♨", text: `사망 연소 전달 대상 · ${target}`, kind: "watch" });
  }
  if (enemy.mechanic === "attackTypeResistance" && state.resistPattern)
    rows.push({ icon: "⌖", text: `분석 결과 · ${state.resistPattern === "contact" ? "접촉" : "비접촉"} 피해 30% 감소`, kind: "watch" });
  if (enemy.mechanic === "adaptiveComputation" && state.analysis)
    rows.push({ icon: "⌖", text: `분석 결과 · ${state.analysis}`, kind: "watch" });
  if (enemy.mechanic === "rotatingNoteSeal") {
    const order = ["top", "middle", "base"],
      note = order[(Number(state.sealIndex) || 0) % order.length];
    rows.push({ icon: "▧", text: `봉인 대상 · ${NOTE_LABEL[note]}`, kind: "control" });
  }
  if (enemy.mechanic === "repeatedNoteCounter" && state.lastNote)
    rows.push({ icon: "♪", text: `${NOTE_LABEL[state.lastNote] || state.lastNote} 연속 ${Number(state.repeatNoteCount) || 0}`, kind: "watch" });
  if (enemy.mechanic === "harmonyPrediction" && state.harmonyPredicted)
    rows.push({ icon: "✦", text: "Harmony 예상 · 다음 방해 대응", kind: "control" });
  if (enemy.mechanic === "discordAndHarmony") {
    const note = NOTE_LABEL[state.discordNote] || String(state.discordNote || "TOP").toUpperCase();
    rows.push({ icon: "≠", text: `불협 노트 ${note} · ${Math.min(3, Number(state.discord) || 0)} / 3`, kind: "danger" });
  }
  if (enemy.mechanic === "recentThreeTurnMemory" && state.analyzedNote)
    rows.push({ icon: "◉", text: `최근 3턴 분석 · ${NOTE_LABEL[state.analyzedNote] || state.analyzedNote}`, kind: "watch" });

  if (["attackedThorns", "contactCardThorns", "woundedBodyCycle"].includes(enemy.mechanic) || stacks(enemy, "thorns") > 0)
    rows.push({ icon: "✦", text: `가시 ${Math.min(6, stacks(enemy, "thorns"))} / 6`, kind: "danger" });

  return rows;
}

function runtimeState() {
  const storage = globalThis.window?.HarmonyRuntime?.storage;
  if (!storage) return null;
  try {
    return loadGame(storage)?.run || null;
  } catch {
    return null;
  }
}

function ensureStyle() {
  if (document.getElementById("late-game-telemetry-style")) return;
  const style = document.createElement("style");
  style.id = "late-game-telemetry-style";
  style.textContent = `
    .late-enemy-telemetry{display:grid;gap:4px;margin:7px 0 0;padding:7px 9px;border:1px solid rgba(255,255,255,.11);border-radius:10px;background:rgba(0,0,0,.18);font-size:.73rem;line-height:1.25}
    .late-enemy-telemetry span{display:flex;gap:6px;align-items:center;min-width:0}
    .late-enemy-telemetry span b{font-weight:700;white-space:normal}
    .late-enemy-telemetry .phase{letter-spacing:.02em}
    .late-enemy-telemetry .danger{font-weight:700}
    .late-enemy-telemetry .control{font-weight:700}
  `;
  document.head.append(style);
}

function patchTelemetry() {
  const run = runtimeState();
  if (!run?.battle) return;
  ensureStyle();
  const cards = [...document.querySelectorAll("#app .enemy[data-target]")];
  for (const card of cards) {
    const index = Number(card.dataset.target),
      enemy = run.battle.enemies?.[index];
    if (!enemy) continue;
    const rows = lateEnemyTelemetry(run, enemy),
      key = JSON.stringify(rows),
      existing = card.querySelector(":scope > .late-enemy-telemetry");
    if (!rows.length) {
      existing?.remove();
      continue;
    }
    if (existing?.dataset.key === key) continue;
    const box = existing || document.createElement("div");
    box.className = "late-enemy-telemetry";
    box.dataset.key = key;
    box.innerHTML = rows
      .map((row) => `<span class="${row.kind || ""}"><i aria-hidden="true">${row.icon || "•"}</i><b>${row.text}</b></span>`)
      .join("");
    if (!existing) card.querySelector(".enemy-vitals")?.after(box);
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      patchTelemetry();
    });
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener("DOMContentLoaded", schedule);
  schedule();
}
