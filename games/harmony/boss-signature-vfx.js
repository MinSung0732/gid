const cfg = (label, color, style, intensity = "strong", symbol = "✦") =>
  Object.freeze({ label, color, style, intensity, symbol });

const ARCHIVE_READ = cfg("강제 열람", "#d7c39a", "archive", "super", "▤");
const ARCHIVE_REPLAY = cfg("기록 재현", "#c9b9e8", "archive-replay", "super", "▣");
const INSPECTION = cfg("정제 검사", "#f0c36c", "inspection", "strong", "⌁");
const ORGAN_SPORE = cfg("기관 증식 · 포자", "#a9d78f", "growth", "strong", "❋");
const ORGAN_MYCELIUM = cfg("기관 증식 · 균사", "#8fc7aa", "growth", "strong", "⌇");
const ORGAN_EMPOWER = cfg("기관 공명 강화", "#c7ef9a", "growth", "super", "✣");
const BLOOM = cfg("만개 전환", "#ef9fc7", "bloom", "super", "✿");
const COMPRESSION = cfg("초임계 압축", "#f1bd71", "compression", "super", "◎");
const COLLAPSE = cfg("붕괴 전환", "#f08b67", "compression", "super", "◉");
const ANALYSIS = cfg("행동 분석", "#8ecae8", "analysis", "strong", "⌬");
const ANALYSIS_WIDE = cfg("행동 분석 · 확장", "#8eb8f0", "analysis", "super", "⌬");
const EXPOSE = cfg("갑피 파열 · 노출", "#e7a38e", "rupture", "super", "◇");
const SUTURE = cfg("봉합", "#d9b3b3", "suture", "strong", "╳");
const IGNITION = cfg("폭풍 점화", "#ffb45d", "ignition", "super", "☼");
const CRITICAL = cfg("임계", "#ffe8a2", "critical", "strong", "⊙");
const RELEASE = cfg("임계 방출", "#fff2c2", "release", "super", "☀");
const DISCORD = cfg("불협 지정", "#d39ee8", "discord", "super", "♩");
const MEMORY = cfg("향의 회상", "#9dcde8", "memory", "super", "◫");

export const BOSS_SIGNATURES = Object.freeze({
  scent_devouring_archivist: Object.freeze({
    "opening:1": ARCHIVE_READ,
    "cycle:1": ARCHIVE_READ,
    "opening:4": ARCHIVE_READ,
    "cycle:4": ARCHIVE_READ,
    "opening:2": ARCHIVE_REPLAY,
    "cycle:2": ARCHIVE_REPLAY,
    "opening:5": ARCHIVE_REPLAY,
    "cycle:5": ARCHIVE_REPLAY,
  }),
  incomplete_refinement_supervisor: Object.freeze({
    "opening:0": INSPECTION,
    "cycle:0": INSPECTION,
    "opening:4": INSPECTION,
    "cycle:4": INSPECTION,
  }),
  symbiosis_mother: Object.freeze({
    "opening:0": Object.freeze({ phases: { "symbiosis-growth": ORGAN_SPORE } }),
    "cycle:0": Object.freeze({ phases: { "symbiosis-growth": ORGAN_SPORE } }),
    "opening:2": Object.freeze({ phases: { "symbiosis-growth": ORGAN_MYCELIUM } }),
    "cycle:2": Object.freeze({ phases: { "symbiosis-growth": ORGAN_MYCELIUM } }),
    onEnter: Object.freeze({ phases: { "symbiosis-bloom": ORGAN_EMPOWER } }),
    "cycle:1": Object.freeze({ phases: { "symbiosis-bloom": ORGAN_SPORE } }),
    "cycle:4": Object.freeze({ phases: { "symbiosis-bloom": ORGAN_MYCELIUM } }),
  }),
  blooming_parasitic_garden: Object.freeze({
    "opening:4": Object.freeze({ phases: { "garden-cycle": BLOOM } }),
    "cycle:4": Object.freeze({
      phases: {
        "garden-cycle": BLOOM,
        "garden-overlap": BLOOM,
      },
    }),
    "opening:5": Object.freeze({ phases: { "garden-cycle": BLOOM } }),
    "cycle:5": Object.freeze({ phases: { "garden-cycle": BLOOM } }),
    onEnter: Object.freeze({ phases: { "garden-overlap": BLOOM } }),
  }),
  grand_alchemy_perfume_core: Object.freeze({
    "opening:0": Object.freeze({ phases: { "alchemy-compression": COMPRESSION } }),
    "cycle:0": Object.freeze({ phases: { "alchemy-compression": COMPRESSION } }),
    onEnter: Object.freeze({
      phases: {
        "alchemy-control": cfg("제어 전환", "#d9c17c", "compression", "strong", "◎"),
        "alchemy-collapse": COLLAPSE,
      },
    }),
  }),
  forbidden_perfume_computation: Object.freeze({
    "opening:0": Object.freeze({ phases: { "computation-single": ANALYSIS } }),
    "cycle:0": Object.freeze({
      phases: {
        "computation-single": ANALYSIS,
        "computation-memory": ANALYSIS_WIDE,
      },
    }),
    onEnter: Object.freeze({ phases: { "computation-memory": ANALYSIS_WIDE } }),
  }),
  wounded_scent_incarnation: Object.freeze({
    "opening:3": EXPOSE,
    "cycle:3": EXPOSE,
  }),
  thousand_wounds: Object.freeze({
    "opening:3": SUTURE,
    "cycle:3": SUTURE,
  }),
  solar_scent_storm_core: Object.freeze({
    "opening:0": IGNITION,
    "cycle:0": IGNITION,
    "opening:4": IGNITION,
    "cycle:4": IGNITION,
  }),
  eternal_distillation_sun: Object.freeze({
    "opening:2": CRITICAL,
    "cycle:2": CRITICAL,
    "opening:3": RELEASE,
    "cycle:3": RELEASE,
  }),
  absolute_resonance_conductor: Object.freeze({
    "opening:0": DISCORD,
    "cycle:0": DISCORD,
  }),
  scent_memory_itself: Object.freeze({
    "opening:0": MEMORY,
    "cycle:0": MEMORY,
    "opening:4": MEMORY,
    "cycle:4": MEMORY,
  }),
});

export function bossSignatureConfig({ bossId, actionId, phase } = {}) {
  const entry = BOSS_SIGNATURES[bossId]?.[actionId];
  if (!entry) return null;
  if (entry.phases) return entry.phases[phase] || null;
  return entry;
}

export function createBossSignatureVfx({
  combatEffectsEnabled,
  enemyElement,
  effectsLayer,
  reducedCombatMotion,
  cardLabelFor = (id) => id,
}) {
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  async function showBossSignature(payload = {}) {
    const config = bossSignatureConfig(payload);
    if (!config || !combatEffectsEnabled()) return false;
    const actor = enemyElement(payload.enemyIndex),
      rect = actor?.getBoundingClientRect();
    if (!actor || !rect?.width || !rect?.height) return false;

    const reduced = reducedCombatMotion(),
      root = document.createElement("span"),
      symbol = document.createElement("i"),
      label = document.createElement("strong"),
      ring = document.createElement("i"),
      core = document.createElement("i");

    root.className = `hmy-boss-signature hmy-boss-signature-${config.style} intensity-${config.intensity}${reduced ? " reduced" : ""}`;
    root.style.left = `${rect.left + rect.width / 2}px`;
    root.style.top = `${rect.top + rect.height * .48}px`;
    root.style.width = `${Math.max(130, rect.width)}px`;
    root.style.height = `${Math.max(130, rect.height)}px`;
    root.style.setProperty("--boss-signature-color", config.color);
    root.setAttribute("aria-hidden", "true");

    core.className = "hmy-boss-signature-core";
    ring.className = "hmy-boss-signature-ring";
    symbol.className = "hmy-boss-signature-symbol";
    symbol.textContent = config.symbol;
    label.className = "hmy-boss-signature-label";
    label.textContent = config.label;
    root.append(core, ring, symbol, label);

    if (!reduced) {
      for (let index = 0; index < 7; index++) {
        const mote = document.createElement("i");
        mote.className = "hmy-boss-signature-mote";
        mote.style.setProperty("--sig-angle", `${index * 51 - 78}deg`);
        mote.style.setProperty("--sig-distance", `${42 + (index % 3) * 15}px`);
        mote.style.setProperty("--sig-delay", `${120 + index * 24}ms`);
        root.append(mote);
      }
      if (config.style === "inspection") {
        const meter = document.createElement("span");
        meter.className = "hmy-boss-signature-meter";
        meter.innerHTML = "<i></i><i></i><i></i>";
        root.append(meter);
      }
      if (config.style === "memory") {
        const panes = document.createElement("span");
        panes.className = "hmy-boss-signature-memory-panes";
        panes.innerHTML = "<i></i><i></i><i></i>";
        root.append(panes);
      }
      if (["archive", "archive-replay"].includes(config.style)) {
        const pages = document.createElement("span");
        pages.className = "hmy-boss-signature-pages";
        pages.innerHTML = "<i></i><i></i><i></i>";
        root.append(pages);
        if (config.style === "archive-replay" && payload.storedCardId) {
          const card = document.createElement("span");
          card.className = "hmy-boss-signature-card-ghost";
          card.textContent = cardLabelFor(payload.storedCardId);
          root.append(card);
        }
      }
      if (["growth", "bloom"].includes(config.style)) {
        const organic = document.createElement("span");
        organic.className = `hmy-boss-signature-organic ${config.style}`;
        organic.innerHTML = "<i></i><i></i><i></i><i></i><i></i><i></i>";
        root.append(organic);
      }
      if (config.style === "analysis") {
        const lenses = document.createElement("span");
        lenses.className = "hmy-boss-signature-lenses";
        lenses.innerHTML = "<i></i><i></i><i></i>";
        root.append(lenses);
      }
      if (["rupture", "suture"].includes(config.style)) {
        const seams = document.createElement("span");
        seams.className = `hmy-boss-signature-seams ${config.style}`;
        seams.innerHTML = "<i></i><i></i><i></i>";
        root.append(seams);
      }
      if (["ignition", "critical", "release"].includes(config.style)) {
        const heat = document.createElement("span");
        heat.className = "hmy-boss-signature-heat";
        heat.innerHTML = "<i></i><i></i><i></i>";
        root.append(heat);
      }
      if (config.style === "discord") {
        const notes = document.createElement("span");
        notes.className = "hmy-boss-signature-notes";
        notes.innerHTML = "<i>TOP</i><i>MIDDLE</i><i>BASE</i>";
        root.append(notes);
      }
    }

    actor.classList.add("hmy-boss-signature-actor");
    effectsLayer().append(root);
    await wait(reduced ? 250 : config.intensity === "super" ? 520 : 440);
    actor.classList.remove("hmy-boss-signature-actor");
    root.remove();
    return true;
  }

  return { showBossSignature };
}
