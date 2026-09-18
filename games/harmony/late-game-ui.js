import { CARDS } from "./data.js";
import { loadGame } from "./persistence.js?v=20260915-2";

const NOTE_LABEL = Object.freeze({ top: "TOP", middle: "MIDDLE", base: "BASE" });
const STATUS_LABEL = Object.freeze({
  burning: "연소",
  corrosion: "부식",
  weak: "약화",
  poison: "중독",
  bind: "속박",
  vulnerable: "취약",
  overload: "과부하",
  interference: "교란",
  silence: "침묵",
  bleed: "출혈",
  seal: "봉인",
  confusion: "혼란",
  regeneration: "재생",
  protection: "보호",
});

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

function intentIsVisible(enemy) {
  const view = enemy?.intentView;
  return !(view?.hidden || view?.visibility === "hidden" || view?.hiddenDetails);
}

function shortActionText(action) {
  if (!action) return "다음 행동";
  if (action.name) return action.name;
  if (action.type === "attack") {
    const hits = Math.max(1, Math.floor(Number(action.hits) || 1)),
      pattern = action.attackPattern === "nonContact" ? "비접촉" : "접촉";
    return `${pattern} 공격 ${Math.max(0, Number(action.value) || 0)}${hits > 1 ? ` × ${hits}` : ""}`;
  }
  if (action.type === "guard") return `방어막 ${Math.max(0, Number(action.value) || 0)}`;
  if (action.type === "debuff") return statusMapText(action.applyPlayer) || "상태이상 부여";
  return "다음 행동";
}

function isTelegraphSetup(action) {
  if (!action) return false;
  const name = String(action.name || "");
  if (/(예고|준비|축적|충전|감시|분석|기록|지정|갱신|설정)/.test(name)) return true;
  if (Number(action.lateState?.pressureDelta) > 0 || Number(action.lateState?.chargeDelta) > 0) return true;
  return [
    "watchCards4",
    "watchFieldBurn",
    "setInspection",
    "analyzeAttackType",
    "analyzePreviousTurn",
    "analyzePreviousTurns",
  ].includes(action.lateHook);
}

function nextPatternAction(run, enemy) {
  const pattern = Array.isArray(enemy?.pattern) ? enemy.pattern : [];
  if (!pattern.length) return null;
  const stateIndex = Number(enemy?.patternState?.lastKey),
    turnIndex = (Math.max(1, Math.floor(Number(run?.battle?.turn) || 1)) - 1) % pattern.length,
    currentIndex = Number.isInteger(stateIndex) ? stateIndex : turnIndex;
  return pattern[(currentIndex + 1) % pattern.length] || null;
}

export function latePatternPreview(run, enemy) {
  const currentAction = enemy?.intent;
  if (!intentIsVisible(enemy) || !isTelegraphSetup(currentAction)) return null;
  const nextAction = nextPatternAction(run, enemy);
  if (!nextAction) return null;
  return {
    text: shortActionText(nextAction),
    help: actionHelp(nextAction),
    kind: nextAction.type || "effect",
  };
}

function statusValueText(id, value) {
  const label = STATUS_LABEL[id] || id,
    stackCount = typeof value === "number" ? value : Number(value?.stacks) || 0,
    turns = typeof value === "object" ? Number(value?.turns) || 0 : 0,
    notes = Array.isArray(value?.notes)
      ? value.notes.map((note) => NOTE_LABEL[note] || String(note).toUpperCase()).join("/")
      : "";
  return [label, stackCount > 0 ? `${stackCount}중첩` : "", turns > 0 ? `${turns}턴` : "", notes ? `대상 ${notes}` : ""]
    .filter(Boolean)
    .join(" · ");
}

function statusMapText(map) {
  if (!map || typeof map !== "object") return "";
  return Object.entries(map).map(([id, value]) => statusValueText(id, value)).join(", ");
}

function actionHelp(action) {
  if (!action) return "다음 적 행동의 상세 정보입니다.";
  const parts = [];
  if (action.type === "attack") {
    const hits = Math.max(1, Math.floor(Number(action.hits) || 1)),
      pattern = action.attackPattern === "nonContact" ? "비접촉" : "접촉";
    parts.push(`${pattern} 공격 ${Math.max(0, Number(action.value) || 0)} 피해${hits > 1 ? ` × ${hits}회` : ""}`);
  } else if (action.type === "guard") {
    parts.push(`방어막 ${Math.max(0, Number(action.value) || 0)} 획득`);
  } else if (action.type === "debuff") {
    parts.push("플레이어에게 상태이상 적용");
  }
  const playerEffects = statusMapText(action.applyPlayer);
  if (playerEffects) parts.push(`플레이어: ${playerEffects}`);
  if (Number(action.guard) > 0) parts.push(`행동 후 방어막 ${Number(action.guard)} 획득`);
  if (Number(action.allyGuard) > 0) parts.push(`아군 방어막 ${Number(action.allyGuard)} 지원`);
  if (action.lateHook === "cards4Attack") parts.push("직전 플레이어 턴에 카드 4장 이상 사용 시 피해 28% 증가");
  if (action.lateHook === "fieldBurnAttack") parts.push("전장 적들의 연소 합계가 12 이상이면 피해 30% 증가");
  if (action.lateHook === "inspectionAttack") parts.push("현재 검사 조건 달성 시 피해 28% 증가");
  if (action.lateHook === "scaleFromOwnBurn") parts.push("자신의 연소 1중첩마다 피해 4% 증가, 최대 40%");
  if (action.lateHook === "ruptureFollowup") parts.push("현재 방어막을 깨뜨릴 수 있으면 2연타 파열 공격으로 변환");
  if (action.lateState?.pressureReset) parts.push("행동 후 압력 초기화");
  if (action.lateState?.chargeReset) parts.push("행동 후 충전 초기화");
  return parts.length ? parts.join(" · ") : "다음 적 행동의 상세 정보입니다.";
}

function telemetryHelp(row, enemy) {
  const text = String(row?.text || "");
  if (row?.help) return row.help;
  if (row?.kind === "intent") return actionHelp(enemy?.intent);
  if (row?.kind === "phase") return "현재 보스 페이즈와 다음 페이즈 전환 조건입니다.";
  if (text.startsWith("압력")) {
    if (enemy?.mechanic === "pressure3") return "현재 압력입니다. 한 장의 카드로 20 이상 피해를 주면 압력이 1 감소하고, 폭발 행동 뒤 초기화됩니다.";
    if (enemy?.mechanic === "shieldBreakPressure") return "현재 압력입니다. 이 적의 방어막을 완전히 파괴하면 압력이 1 감소합니다.";
    return "현재 압력입니다. 폭발 계열 행동 뒤 0으로 초기화됩니다.";
  }
  if (text.startsWith("충전")) return "충전 2에 도달하면 대폭발이 준비됩니다. 한 장의 카드로 이 적에게 20 이상 피해를 주면 충전이 1 감소합니다.";
  if (text.startsWith("불안정") || text.startsWith("균열")) return "이 적을 공격한 카드 1장마다 1씩 쌓입니다. 특정 공격이 이 수치를 참조해 강화되거나 폭발로 변합니다.";
  if (text.startsWith("사용 카드")) return "이번 플레이어 턴의 카드 사용 수입니다. 4장 이상 사용하면 다음 감시 판정 공격의 피해가 28% 증가합니다.";
  if (text.startsWith("연쇄열")) return "현재 살아 있는 적들의 연소 합계입니다. 12 이상이면 연쇄열 공격의 피해가 30% 증가합니다.";
  if (text.startsWith("잔향")) return "이 적의 잔향이 4 이상이면 공격 피해가 25% 증가합니다.";
  if (text.startsWith("검사")) return "표시된 검사 조건의 진행도입니다. 조건을 달성하면 다음 검사 판정 공격의 피해가 28% 증가합니다.";
  if (text.startsWith("흡수 카드")) return "기록관이 보관한 플레이어 카드입니다. 기록 재현 행동에서 그 카드의 성격을 모방합니다.";
  if (text.startsWith("턴 종료 시 손패")) return "이번 턴 종료 시 손패에서 카드 1장이 무작위로 기록관에게 흡수됩니다.";
  if (text.startsWith("소환물")) return "현재 살아 있는 소환물 수입니다. 동시에 유지되는 소환물은 최대 2체입니다.";
  if (text.startsWith("공생 연결")) return "연결된 아군이 피해를 받을 때 공생체도 피해를 나눠 받습니다. 누적 30에 도달하면 연결이 해제됩니다.";
  if (text.startsWith("사망 연소")) return "이 적이 쓰러질 때 남은 연소의 절반을 표시된 대상에게 전달합니다.";
  if (text.startsWith("분석 결과")) return "직전 플레이를 분석한 결과이며, 다음 방어 또는 공격 보정에 사용됩니다.";
  if (text.startsWith("봉인 대상")) return "다음 봉인 행동이 제한할 노트입니다. 표시된 노트가 1턴 동안 제한됩니다.";
  if (text.includes(" 연속 ")) return "같은 노트를 연속 사용한 횟수입니다. 반복 노트 대응 기믹이 이 값을 참조합니다.";
  if (text.startsWith("Harmony 예상")) return "최근 플레이에서 Harmony를 감지한 상태입니다. 다음 방해 행동의 대응 방식이 달라집니다.";
  if (text.startsWith("불협 노트")) return "표시된 노트 사용으로 불협이 누적됩니다. 3에 도달하면 다음 공격이 강화되고 불협은 소모됩니다.";
  if (text.startsWith("최근 3턴 분석")) return "최근 3턴 동안 가장 많이 사용한 노트를 분석한 결과입니다. 해당 노트에 대응하는 방어가 적용됩니다.";
  return "이 적의 현재 전투 기믹 상태입니다.";
}

export function lateEnemyTelemetry(run, enemy) {
  if (!run?.battle || !enemy || enemy.hp <= 0) return [];
  const state = enemy.customState || {},
    rows = [],
    phase = phaseText(enemy);
  if (phase) rows.push({ icon: "◫", text: phase, kind: "phase" });

  if (["pressure2", "pressure3", "shieldBreakPressure"].includes(enemy.mechanic)) {
    const max = enemy.mechanic === "pressure2" ? 2 : 3;
    rows.push({ icon: "💥", text: `압력 ${Math.min(max, Number(state.pressure) || 0)} / ${max}`, kind: "danger" });
  }
  if (enemy.mechanic === "damageBreakCharge")
    rows.push({ icon: "◈", text: `충전 ${Math.min(2, Number(state.charge) || 0)} / 2`, kind: "danger" });
  if (enemy.mechanic === "attackedCounter") {
    const key = Object.prototype.hasOwnProperty.call(state, "instability") ? "instability" : "fracture",
      label = key === "instability" ? "불안정" : "균열";
    rows.push({ icon: "◈", text: `${label} ${Math.min(3, Number(state[key]) || 0)} / 3`, kind: "danger" });
  }
  if (enemy.mechanic === "cardsPlayedWatch")
    rows.push({ icon: "⚙", text: `사용 카드 ${Math.min(4, Number(run.battle.cardsPlayedThisTurn) || 0)} / 4`, kind: "watch" });
  if (enemy.mechanic === "fieldBurnCounter")
    rows.push({ icon: "♨", text: `연쇄열 ${Math.min(12, fieldBurn(run))} / 12`, kind: "danger" });
  if (enemy.mechanic === "resonanceThreshold")
    rows.push({ icon: "≋", text: `잔향 ${Math.min(4, stacks(enemy, "resonance"))} / 4`, kind: "danger" });

  const inspection = inspectionText(run, enemy);
  if (inspection) rows.push({ icon: "⌖", text: inspection, kind: "watch" });

  if (enemy.mechanic === "archivist") {
    const held = state.storedCard?.id,
      name = held ? CARDS[held.id]?.name || held : null;
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
    const note = state.discordNote ? NOTE_LABEL[state.discordNote] || String(state.discordNote).toUpperCase() : "지정 전";
    rows.push({ icon: "≠", text: `불협 노트 ${note} · ${Math.min(3, Number(state.discord) || 0)} / 3`, kind: "danger" });
  }
  if (enemy.mechanic === "recentThreeTurnMemory" && state.analyzedNote)
    rows.push({ icon: "◉", text: `최근 3턴 분석 · ${NOTE_LABEL[state.analyzedNote] || state.analyzedNote}`, kind: "watch" });

  return rows;
}

function runtimeState() {
  const live = globalThis.window?.HarmonyCurrentRenderRun;
  if (live && typeof live === "object") return live;
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
    .late-enemy-telemetry span{display:flex;gap:6px;align-items:center;min-width:0;cursor:help;outline:none}
    .late-enemy-telemetry span:focus-visible{border-radius:4px;box-shadow:0 0 0 1px #f8e29a88}
    .late-enemy-telemetry span b{font-weight:700;white-space:normal}
    .late-enemy-telemetry .phase{letter-spacing:.02em}
    .late-enemy-telemetry .danger{font-weight:700}
    .late-enemy-telemetry .control{font-weight:700}
    .late-telemetry-tooltip{position:fixed;z-index:10050;display:none;box-sizing:border-box;width:max-content;max-width:min(330px,calc(100vw - 24px));padding:9px 11px;border:1px solid #f8e29a42;border-radius:9px;background:#0a211df5;color:#e9f0eb;box-shadow:0 10px 28px #0008;font-size:11px;font-weight:600;line-height:1.45;word-break:keep-all;pointer-events:none}
    .late-telemetry-tooltip.visible{display:block}
    .late-pattern-preview{display:none}
    @media (min-width:901px){
      .enemy[data-enemy-card-ui="1"]>.late-enemy-telemetry{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;align-content:flex-end;gap:2px 6px;color:#a9bdb2;font-size:9px;line-height:1.15}
      .enemy[data-enemy-card-ui="1"]>.late-enemy-telemetry span{flex:0 1 auto;display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:0;max-width:100%;padding:1px 0;border:0;border-radius:0;background:transparent}
      .enemy[data-enemy-card-ui="1"]>.late-enemy-telemetry span i{flex:0 0 auto;font-size:9px;font-style:normal;line-height:1;color:#8fa99b}
      .enemy[data-enemy-card-ui="1"]>.late-enemy-telemetry span b{min-width:0;overflow:hidden;font-size:9px;font-weight:800;line-height:1.15;white-space:nowrap;text-overflow:ellipsis;word-break:keep-all}
      .enemy[data-enemy-card-ui="1"]>.late-enemy-telemetry .phase{color:#d6c887}
      .enemy[data-enemy-card-ui="1"]>.late-enemy-telemetry .danger{color:#e8b18e}
      .enemy[data-enemy-card-ui="1"]>.late-enemy-telemetry .control{color:#cbb6de}
      .enemy[data-enemy-card-ui="1"]>.late-enemy-telemetry .watch{color:#a9c6b7}
      .late-pattern-preview{display:grid;grid-template-rows:9px minmax(0,1fr);gap:2px;min-width:0;cursor:help;outline:none}
      .late-pattern-preview>small{color:#8d9f96;font-size:7px;font-weight:900;line-height:1;letter-spacing:.09em;text-align:center}
      .late-pattern-preview>span{display:grid;grid-template-columns:14px minmax(0,1fr);align-items:center;gap:4px;min-width:0;padding:4px 6px;border:1px solid #d0a96a55;border-radius:8px;background:linear-gradient(90deg,#48371f99,#102a25d9);box-shadow:0 3px 10px #0002;color:#e7d39b}
      .late-pattern-preview i{font-size:10px;font-style:normal;line-height:1;text-align:center}
      .late-pattern-preview b{min-width:0;overflow:hidden;font-size:9px;font-weight:800;line-height:1.1;white-space:nowrap;text-overflow:ellipsis}
      .late-pattern-preview:focus-visible>span{box-shadow:0 0 0 1px #f8e29a88}
    }
  `;
  document.head.append(style);
}

function ensureTooltip() {
  let tooltip = document.getElementById("late-telemetry-tooltip");
  if (tooltip) return tooltip;
  tooltip = document.createElement("div");
  tooltip.id = "late-telemetry-tooltip";
  tooltip.className = "late-telemetry-tooltip";
  tooltip.setAttribute("role", "tooltip");
  document.body.append(tooltip);
  return tooltip;
}

function showTooltip(target) {
  const help = target?.dataset?.lateHelp;
  if (!help) return;
  const tooltip = ensureTooltip();
  tooltip.textContent = help;
  tooltip.classList.add("visible");
  const rect = target.getBoundingClientRect(),
    tooltipRect = tooltip.getBoundingClientRect(),
    gap = 8,
    left = Math.max(12, Math.min(window.innerWidth - tooltipRect.width - 12, rect.left + rect.width / 2 - tooltipRect.width / 2)),
    above = rect.top - tooltipRect.height - gap,
    top = above >= 12 ? above : Math.min(window.innerHeight - tooltipRect.height - 12, rect.bottom + gap);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${Math.max(12, top)}px`;
}

function hideTooltip() {
  document.getElementById("late-telemetry-tooltip")?.classList.remove("visible");
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

    const preview = latePatternPreview(run, enemy),
      existingPreview = card.querySelector(":scope > .late-pattern-preview"),
      previewKey = JSON.stringify(preview);
    if (!preview) existingPreview?.remove();
    else if (existingPreview?.dataset.key !== previewKey) {
      const box = existingPreview || document.createElement("div"),
        label = document.createElement("small"),
        line = document.createElement("span"),
        icon = document.createElement("i"),
        text = document.createElement("b");
      box.className = "late-pattern-preview";
      box.dataset.key = previewKey;
      box.dataset.lateHelp = preview.help;
      box.tabIndex = 0;
      label.textContent = "패턴 예고";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "◎";
      text.textContent = preview.text;
      line.append(icon, text);
      box.replaceChildren(label, line);
      if (!existingPreview) card.querySelector(":scope > .intent-wrap")?.after(box);
    }

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
    box.replaceChildren(...rows.map((row) => {
      const entry = document.createElement("span"),
        icon = document.createElement("i"),
        label = document.createElement("b");
      entry.className = row.kind || "";
      entry.dataset.lateHelp = telemetryHelp(row, enemy);
      entry.tabIndex = 0;
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = row.icon || "•";
      label.textContent = row.text;
      entry.append(icon, label);
      return entry;
    }));
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
  document.addEventListener("pointerover", (event) => {
    const target = event.target.closest?.("[data-late-help]");
    if (target) showTooltip(target);
  });
  document.addEventListener("pointerout", (event) => {
    const target = event.target.closest?.("[data-late-help]");
    if (target && !target.contains(event.relatedTarget)) hideTooltip();
  });
  document.addEventListener("focusin", (event) => {
    const target = event.target.closest?.("[data-late-help]");
    if (target) showTooltip(target);
  });
  document.addEventListener("focusout", (event) => {
    if (event.target.closest?.("[data-late-help]")) hideTooltip();
  });
  window.addEventListener("scroll", hideTooltip, true);
  window.addEventListener("resize", hideTooltip);
  window.addEventListener("DOMContentLoaded", schedule);
  schedule();
}
