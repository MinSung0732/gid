import { STATUS_DEFINITIONS } from "./statuses.js?v=20260911-4";
import { SFX } from "./sound.js?v=20260920-1";
import {
  getPlayerHealthAnchor,
  getPlayerImpactPoint,
} from "./player-vfx-anchor.js";
import { placeBattleOverlay } from "./battle-overlay.js";
import { buildPlayerPoisonRegions } from "./poison-tick-layout.js?v=20260920-1";

export function createCombatFeedbackVfx({
  combatEffectsEnabled,
  enemyElement,
  effectsLayer,
  formatNumber,
  reducedCombatMotion = () => false,
}) {
  const number = formatNumber;

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function statusProcPoint(event, impactPoint) {
    if (impactPoint?.x != null && impactPoint?.y != null) return impactPoint;
    if (event.target === "player") return getPlayerImpactPoint();
    const rect = enemyElement(event.targetIndex)?.getBoundingClientRect();
    return rect
      ? { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.46 }
      : null;
  }

  function addStatusProcParticle(effect, className, index, total) {
    const particle = document.createElement("i");
    particle.className = className;
    particle.style.setProperty("--proc-index", index);
    particle.style.setProperty("--proc-angle", `${(360 / total) * index - 95}deg`);
    particle.style.setProperty("--proc-distance", `${24 + (index % 3) * 8}px`);
    particle.style.setProperty("--proc-delay", `${(index % 3) * 22}ms`);
    effect.append(particle);
  }

  function createStatusProcEffect(event, point) {
    if (!point || !combatEffectsEnabled()) return null;
    const reduced = reducedCombatMotion(),
      isBleed = event.statusId === "bleed",
      effect = document.createElement("span"),
      particleCount = reduced ? 1 : isBleed ? 5 : 6;
    effect.className = `hmy-status-proc hmy-${isBleed ? "bleed" : "burn"}-proc${reduced ? " hmy-status-proc-reduced" : ""}`;
    effect.style.left = `${point.x}px`;
    effect.style.top = `${point.y}px`;
    effect.setAttribute("aria-hidden", "true");
    const core = document.createElement("i");
    core.className = isBleed ? "hmy-bleed-core" : "hmy-burn-core";
    effect.append(core);
    if (isBleed) {
      const slash = document.createElement("i");
      slash.className = "hmy-bleed-slash";
      effect.append(slash);
      for (let index = 0; index < particleCount; index++)
        addStatusProcParticle(effect, "hmy-bleed-particle", index, particleCount);
    } else {
      const flame = document.createElement("i");
      flame.className = "hmy-burn-flame";
      effect.append(flame);
      for (let index = 0; index < particleCount; index++)
        addStatusProcParticle(effect, "hmy-burn-ember", index, particleCount);
    }
    effectsLayer().append(effect);
    window.setTimeout(() => effect.remove(), reduced ? 300 : isBleed ? 520 : 560);
    return effect;
  }

  function showStatusProcDamage(event, point) {
    const definition = STATUS_DEFINITIONS[event.statusId];
    if (!definition || event.amount <= 0) return;
    presentStatusHealth(event, event.hpAfter);
    let host = null;
    if (event.target === "enemy") host = enemyElement(event.targetIndex);
    else {
      const health = getPlayerHealthAnchor();
      if (health && !health.closest(".player-stats")) host = health;
    }
    if (!host) return;
    const popup = document.createElement("strong"),
      isBleed = event.statusId === "bleed";
    popup.className = `status-damage-pop ${event.target === "enemy" ? "enemy-status-damage" : "health-status-damage"} hmy-${isBleed ? "bleed" : "burn"}-damage`;
    popup.style.setProperty("--status-damage-color", definition.color);
    if (point) {
      popup.style.setProperty("--damage-x", "0px");
      popup.style.setProperty("--damage-y", "0px");
    }
    popup.innerHTML = `<small>${definition.name} 발동 · 1중첩 소비</small>-${number(event.amount)}`;
    popup.setAttribute(
      "aria-label",
      `${definition.name} 발동, ${number(event.amount)} 추가 피해, 1중첩 소비`,
    );
    host.append(popup);
    popup.addEventListener("animationend", () => popup.remove(), { once: true });
    window.setTimeout(() => popup.remove(), 1100);
  }

  function statusProcChip(event, create = false) {
    const scope = event.target === "enemy"
        ? enemyElement(event.targetIndex)
        : document.querySelector(".player-effects-battle"),
      selector = `.status-chip[data-status-id="${event.statusId}"]`;
    let chip = scope?.querySelector(selector);
    if (!chip && create && scope) {
      const definition = STATUS_DEFINITIONS[event.statusId],
        list = scope.querySelector(".status-list");
      if (!definition || !list) return null;
      chip = document.createElement("span");
      chip.className = `status-chip status-${definition.kind} hmy-status-proc-chip-temporary`;
      chip.dataset.statusId = event.statusId;
      chip.style.setProperty("--status-color", definition.color);
      chip.setAttribute("aria-hidden", "true");
      chip.innerHTML = `<span>${definition.icon}</span><b>${definition.name} ${event.stackBefore}</b>`;
      list.classList.remove("status-list-empty");
      list.append(chip);
    }
    return chip;
  }

  function setStatusProcStack(event, stack, create = false) {
    const chip = statusProcChip(event, create),
      count = chip?.querySelector("b");
    if (count && Number.isFinite(stack))
      count.textContent = count.textContent.replace(/\d+/, String(stack));
    return chip;
  }

  function pulseConsumedStatus(event) {
    const chip = statusProcChip(event, true);
    if (!chip) return;
    chip.classList.remove(
      "hmy-status-consume-bleed",
      "hmy-status-consume-burn",
    );
    void chip.offsetWidth;
    chip.classList.add(`hmy-status-consume-${event.statusId === "bleed" ? "bleed" : "burn"}`);
    setStatusProcStack(event, event.stackAfter);
    window.setTimeout(() => {
      chip.classList.remove(
        "hmy-status-consume-bleed",
        "hmy-status-consume-burn",
      );
      if (
        chip.classList.contains("hmy-status-proc-chip-temporary") &&
        event.stackAfter <= 0
      )
        chip.remove();
    }, 430);
  }

  async function showStatusProcVfx(event, { impactPoint = null } = {}) {
    if (!event || !["bleed", "burning"].includes(event.statusId)) return;
    const point = statusProcPoint(event, impactPoint);
    setStatusProcStack(event, event.stackBefore, true);
    await wait(reducedCombatMotion() ? 35 : 85);
    createStatusProcEffect(event, point);
    if (event.target === "player" && typeof SFX.playerStatusHit === "function")
      SFX.playerStatusHit();
    await wait(reducedCombatMotion() ? 35 : 45);
    showStatusProcDamage(event, point);
    await wait(reducedCombatMotion() ? 0 : 15);
    pulseConsumedStatus(event);
    await wait(reducedCombatMotion() ? 20 : 15);
  }

  async function showStatusProcQueue(events, options = {}) {
    stageStatusDamageHealth(events);
    for (let index = 0; index < events.length; index++) {
      await showStatusProcVfx(events[index], options);
      if (index < events.length - 1) await wait(20);
    }
    finalizeStatusDamageHealth(events);
  }

  function playContactHitSound(strong = false, superStrong = false) {
    if (superStrong && typeof SFX.superContactHit === "function")
      SFX.superContactHit();
    else if (strong && typeof SFX.strongContactHit === "function")
      SFX.strongContactHit();
    else SFX.contactHit();
  }

  function thornsActorElement(actor, index) {
    if (actor !== "enemy" || !Number.isInteger(index)) return null;
    const enemy = enemyElement(index);
    return enemy?.querySelector(".enemy-visual") || enemy;
  }

  function thornsActorPoint(actor, index) {
    if (actor === "player") return getPlayerImpactPoint();
    const rect = thornsActorElement(actor, index)?.getBoundingClientRect();
    return rect
      ? { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.46 }
      : null;
  }

  function thornsStatusChip(event) {
    const scope = event.source === "enemy"
      ? enemyElement(event.sourceIndex)
      : document.querySelector(".player-effects-battle");
    return scope?.querySelector('.status-chip[data-status-id="thorns"]') || null;
  }

  function setThornsStack(chip, stack) {
    const count = chip?.querySelector("b");
    if (count && Number.isFinite(stack))
      count.textContent = count.textContent.replace(/\d+/, String(stack));
  }

  function pulseThornsChip(chip, className, stack) {
    if (!chip) return;
    chip.classList.remove("hmy-thorns-trigger", "hmy-thorns-consume");
    void chip.offsetWidth;
    chip.classList.add(className);
    setThornsStack(chip, stack);
    window.setTimeout(() => chip.classList.remove(className), 430);
  }

  function removeTransient(node, timeout) {
    const remove = (event) => {
      if (!event || event.target === node) node.remove();
    };
    node.addEventListener("animationend", remove);
    window.setTimeout(() => remove(), timeout);
  }

  function appendThornsSource(point, size, color, reduced) {
    if (!point) return;
    const source = document.createElement("span");
    source.className = `hmy-thorns-retaliate hmy-thorns-source${reduced ? " hmy-thorns-reduced" : ""}`;
    source.style.left = `${point.x}px`;
    source.style.top = `${point.y}px`;
    source.style.setProperty("--thorns-color", color);
    source.style.setProperty("--thorns-size", `${size}px`);
    source.setAttribute("aria-hidden", "true");
    for (let index = 0; index < (reduced ? 3 : 5); index++) {
      const spike = document.createElement("i");
      spike.style.setProperty("--thorn-angle", `${index * (360 / (reduced ? 3 : 5)) - 90}deg`);
      spike.style.setProperty("--thorn-delay", `${index * 14}ms`);
      source.append(spike);
    }
    effectsLayer().append(source);
    removeTransient(source, reduced ? 320 : 560);
  }

  function appendThornsImpact(point, color, reduced, order) {
    if (!point) return;
    const impact = document.createElement("span");
    impact.className = `hmy-thorns-retaliate hmy-thorns-impact${reduced ? " hmy-thorns-reduced" : ""}`;
    impact.style.left = `${point.x}px`;
    impact.style.top = `${point.y}px`;
    impact.style.setProperty("--thorns-color", color);
    impact.style.setProperty("--thorn-target-delay", `${order * 24}ms`);
    impact.setAttribute("aria-hidden", "true");
    for (let index = 0; index < (reduced ? 2 : 4); index++) {
      const ray = document.createElement("i");
      ray.style.setProperty("--thorn-angle", `${index * (360 / (reduced ? 2 : 4)) - 45}deg`);
      impact.append(ray);
    }
    effectsLayer().append(impact);
    removeTransient(impact, reduced ? 340 : 580);
  }

  function appendThornsTrail(sourcePoint, targetPoint, color, order) {
    if (!sourcePoint || !targetPoint) return;
    const deltaX = targetPoint.x - sourcePoint.x,
      deltaY = targetPoint.y - sourcePoint.y,
      distance = Math.hypot(deltaX, deltaY),
      trail = document.createElement("span");
    if (distance < 1) return;
    trail.className = "hmy-thorns-retaliate hmy-thorns-trail";
    trail.style.left = `${sourcePoint.x}px`;
    trail.style.top = `${sourcePoint.y}px`;
    trail.style.width = `${distance}px`;
    trail.style.setProperty("--thorns-color", color);
    trail.style.setProperty("--thorn-angle", `${Math.atan2(deltaY, deltaX)}rad`);
    trail.style.setProperty("--thorn-target-delay", `${order * 24}ms`);
    trail.setAttribute("aria-hidden", "true");
    trail.append(document.createElement("i"));
    effectsLayer().append(trail);
    removeTransient(trail, 600);
  }

  async function showThornsRetaliationVfx(event) {
    if (!event || !["player", "enemy"].includes(event.source)) return;
    const chip = thornsStatusChip(event),
      definition = STATUS_DEFINITIONS.thorns,
      color = definition?.color || "currentColor",
      reduced = reducedCombatMotion(),
      sourcePoint = thornsActorPoint(event.source, event.sourceIndex),
      targets = (event.targets || [])
        .map((target) => ({
          ...target,
          point: thornsActorPoint(target.target, target.targetIndex),
        }))
        .filter((target) => target.point);
    setThornsStack(chip, event.stackBefore);
    await wait(reduced ? 30 : 55);
    pulseThornsChip(chip, "hmy-thorns-trigger", event.stackBefore);
    if (combatEffectsEnabled()) {
      const sourceActor = thornsActorElement(event.source, event.sourceIndex),
        sourceRect = sourceActor?.getBoundingClientRect(),
        sourceSize = event.source === "player"
          ? 118
          : Math.max(72, Math.min(110, (sourceRect?.width || 92) * 0.88));
      appendThornsSource(sourcePoint, sourceSize, color, reduced);
    }
    await wait(reduced ? 35 : 55);
    if (combatEffectsEnabled())
      targets.forEach((target, index) => {
        if (!reduced)
          appendThornsTrail(sourcePoint, target.point, color, index);
        appendThornsImpact(target.point, color, reduced, index);
      });
    await wait(reduced ? 45 : 105);
    pulseThornsChip(chip, "hmy-thorns-consume", event.stackAfter);
    await wait(reduced ? 15 : 25);
  }

  function showPlayerDamage(
    amount,
    attackPattern = null,
    strong = false,
    superStrong = false,
    playHurtSound = true,
  ) {
    const battle = document.querySelector(".battle"),
      health = getPlayerHealthAnchor();
    if (!battle || !health || amount <= 0) return;
    if (attackPattern === "contact") playContactHitSound(strong, superStrong);
    else if (attackPattern === "nonContact") SFX.nonContactHit();
    if (playHurtSound) {
      if (superStrong) SFX.playerSuperHit();
      else if (strong) SFX.playerStrongHit();
      else SFX.playerHit();
    }
    if (combatEffectsEnabled()) {
      for (const animation of battle.getAnimations()) {
        if (
          animation.animationName === "player-hit" ||
          animation.animationName === "player-contact-hit-strong"
        )
          animation.cancel();
      }
      battle.classList.remove("player-hit", "player-hit-strong");
      battle.classList.add(strong ? "player-hit-strong" : "player-hit");
      document.querySelector(".battle-hit-wash")?.remove();
      const hitWash = document.createElement("span");
      hitWash.className = "battle-hit-wash";
      hitWash.setAttribute("aria-hidden", "true");
      placeBattleOverlay(hitWash, battle);
      hitWash.addEventListener("animationend", () => hitWash.remove(), {
        once: true,
      });
    }
    const popup = document.createElement("strong");
    popup.className = `health-damage-pop${strong ? " player-damage-strong" : ""}`;
    popup.textContent = `-${number(amount)}`;
    popup.setAttribute("aria-label", `${number(amount)} 체력 피해`);
    health.append(popup);
    popup.addEventListener("animationend", () => popup.remove(), { once: true });
  }

  function showPlayerStatusSmoke(color) {
    const panel = getPlayerHealthAnchor();
    if (!panel) return;
    const smoke = document.createElement("span");
    smoke.className = "player-status-smoke";
    smoke.style.setProperty("--status-smoke-color", color);
    smoke.setAttribute("aria-hidden", "true");
    smoke.innerHTML = "<i></i>".repeat(12);
    panel.append(smoke);
    smoke.addEventListener("animationend", (event) => {
      if (event.target === smoke) smoke.remove();
    });
    window.setTimeout(() => smoke.remove(), 1400);
  }

  function isPoisonTick(hit) {
    return hit?.statusId === "poison" &&
      hit.presentation === "turnEndTick" &&
      Number.isFinite(hit.stackBefore) &&
      Number.isFinite(hit.stackAfter);
  }

  function poisonTickPoint(hit) {
    const rect = enemyElement(hit.targetIndex)?.getBoundingClientRect();
    return rect
      ? { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.46 }
      : null;
  }

  function getPlayerPoisonRegions(reduced = false, impact = getPlayerImpactPoint()) {
    const battle = document.querySelector(".battle"),
      hand = battle?.querySelector(".hand");
    if (!battle || !impact) return [];
    return buildPlayerPoisonRegions({
      bounds: battle.getBoundingClientRect(),
      handBounds: hand?.getBoundingClientRect(),
      impact,
      viewportWidth: window.innerWidth,
      reduced,
    });
  }

  function createPoisonSpot({
    effect,
    point,
    scale = 1,
    particleCount = 3,
    delay = 0,
    rotation = 0,
    intensity = 1,
    player = false,
  }) {
    const spot = document.createElement("span");
    spot.className = `hmy-poison-spot${player ? " hmy-poison-spot-player" : " hmy-poison-spot-enemy"}`;
    spot.style.left = `${point.x}px`;
    spot.style.top = `${point.y}px`;
    spot.style.setProperty("--poison-spot-scale", String(scale));
    spot.style.setProperty("--poison-spot-delay", `${delay}ms`);
    spot.style.setProperty("--poison-spot-rotation", `${rotation}deg`);
    spot.style.setProperty("--poison-intensity", String(intensity));
    if (player) {
      const stain = document.createElement("i");
      stain.className = "hmy-poison-stain";
      spot.append(stain);
    }
    const core = document.createElement("i");
    core.className = "hmy-poison-core";
    spot.append(core);
    for (let index = 0; index < particleCount; index++) {
      const angleOffsets = [-11, 7, -4, 9, -7],
        angle = (360 / particleCount) * index - 18 + angleOffsets[index],
        distance = player ? 30 + (index % 3) * 8 : 38 + (index % 3) * 8,
        particle = document.createElement("i");
      particle.className = "hmy-poison-particle";
      particle.style.setProperty("--poison-angle", `${angle}deg`);
      particle.style.setProperty("--poison-distance", `${distance}px`);
      particle.style.setProperty("--poison-particle-delay", `${index * 12}ms`);
      particle.style.setProperty("--poison-size", `${5 + (index % 2) * 2}px`);
      spot.append(particle);
    }
    effect.append(spot);
    return spot;
  }

  function createPoisonTickEffect(hit) {
    if (!combatEffectsEnabled()) return null;
    const reduced = reducedCombatMotion(),
      player = hit.target === "player",
      point = player ? getPlayerImpactPoint() : poisonTickPoint(hit),
      effect = document.createElement("span");
    if (!point) return null;
    effect.className = `hmy-poison-tick hmy-poison-tick-${hit.target}${reduced ? " hmy-poison-tick-reduced" : ""}`;
    effect.style.setProperty(
      "--poison-color",
      STATUS_DEFINITIONS.poison.color,
    );
    effect.setAttribute("aria-hidden", "true");
    if (player) {
      const regions = getPlayerPoisonRegions(reduced, point);
      if (!regions.length) return null;
      for (const region of regions)
        createPoisonSpot({ effect, point: region, player: true, ...region });
      const haze = document.createElement("i"),
        pulse = document.createElement("i");
      haze.className = "hmy-poison-haze";
      pulse.className = "hmy-poison-final-pulse";
      for (const node of [haze, pulse]) {
        node.style.left = `${point.x}px`;
        node.style.top = `${point.y}px`;
        effect.append(node);
      }
    } else
      createPoisonSpot({
        effect,
        point,
        particleCount: reduced ? 0 : 5,
        delay: 0,
        intensity: 1,
      });

    const targetVisual = hit.target === "enemy"
      ? enemyElement(hit.targetIndex)?.querySelector(".enemy-visual")
      : null;
    targetVisual?.classList.add("hmy-poison-inner-pulse");
    effectsLayer().append(effect);
    const cleanup = () => {
      effect.remove();
      targetVisual?.classList.remove("hmy-poison-inner-pulse");
    };
    effect.addEventListener("animationend", (event) => {
      if (event.target === effect) cleanup();
    });
    window.setTimeout(cleanup, reduced ? 440 : player ? 620 : 520);
    return effect;
  }

  function pulsePoisonChip(hit, phase) {
    const chip = statusProcChip(hit, true);
    if (!chip) return;
    chip.classList.remove(
      "hmy-poison-chip-activate",
      "hmy-poison-chip-consume",
    );
    if (phase === "activate") setStatusProcStack(hit, hit.stackBefore, true);
    else setStatusProcStack(hit, hit.stackAfter, true);
    void chip.offsetWidth;
    chip.classList.add(`hmy-poison-chip-${phase}`);
    window.setTimeout(() => {
      chip.classList.remove(
        "hmy-poison-chip-activate",
        "hmy-poison-chip-consume",
      );
      if (
        phase === "consume" &&
        chip.classList.contains("hmy-status-proc-chip-temporary") &&
        hit.stackAfter <= 0
      )
        chip.remove();
    }, reducedCombatMotion() ? 190 : 390);
  }

  function showPoisonTickVfx(hit, showPopup) {
    const reduced = reducedCombatMotion(),
      player = hit.target === "player",
      seepDelay = player ? 30 : reduced ? 25 : 50,
      popupDelay = player ? (reduced ? 250 : 330) : reduced ? 90 : 240,
      consumeDelay = player ? (reduced ? 300 : 380) : reduced ? 130 : 290;
    pulsePoisonChip(hit, "activate");
    window.setTimeout(() => createPoisonTickEffect(hit), seepDelay);
    window.setTimeout(showPopup, popupDelay);
    window.setTimeout(() => pulsePoisonChip(hit, "consume"), consumeDelay);
  }

  function statusHealthElements(hit) {
    if (hit.target === "enemy") {
      const enemy = enemyElement(hit.targetIndex);
      return {
        labels: enemy ? [enemy.querySelector(".enemy-health-value")] : [],
        fills: enemy ? [enemy.querySelector(".enemy-hp > span")] : [],
        progress: [],
      };
    }
    return {
      labels: [
        ...new Set(document.querySelectorAll(
          ".health-stat > b, .run-hud-health b, .mobile-hud-health > span > b",
        )),
      ],
      fills: [
        ...new Set(document.querySelectorAll(
          ".player-health-bar > span, .mobile-hud-health > i > em",
        )),
      ],
      progress: [...document.querySelectorAll(".player-health-bar")],
    };
  }

  function setHealthLabel(label, hp, maxHp) {
    if (!label) return;
    const suffix = label.querySelector("small"),
      value = `${number(hp)} / ${number(maxHp)}`;
    if (!suffix) {
      label.textContent = value;
      return;
    }
    const text = [...label.childNodes].find((node) => node.nodeType === 3);
    if (text) text.nodeValue = `${value} `;
    else label.prepend(document.createTextNode(`${value} `));
  }

  function presentStatusHealth(hit, hp, staged = false) {
    if (!Number.isFinite(hp) || !Number.isFinite(hit.maxHp)) return;
    const elements = statusHealthElements(hit),
      percent = Math.max(0, Math.min(100, hp / Math.max(1, hit.maxHp) * 100));
    for (const label of elements.labels) setHealthLabel(label, hp, hit.maxHp);
    for (const progress of elements.progress) {
      progress.setAttribute("aria-valuemax", String(hit.maxHp));
      progress.setAttribute("aria-valuenow", String(hp));
    }
    for (const fill of elements.fills) {
      if (!fill) continue;
      if (staged) fill.classList.add("hmy-status-health-staged");
      fill.style.width = `${percent}%`;
      if (staged) {
        void fill.offsetWidth;
        fill.classList.remove("hmy-status-health-staged");
      }
    }
  }

  function statusHealthKey(hit) {
    return hit.target === "enemy" ? `enemy:${hit.targetIndex}` : "player";
  }

  function stageStatusDamageHealth(hits) {
    const staged = new Set();
    for (const hit of hits) {
      const key = statusHealthKey(hit);
      if (staged.has(key) || !Number.isFinite(hit.hpBefore)) continue;
      staged.add(key);
      presentStatusHealth(hit, hit.hpBefore, true);
    }
  }

  function finalizeStatusDamageHealth(hits) {
    const finalHits = new Map();
    for (const hit of hits)
      if (Number.isFinite(hit.hpAfter)) finalHits.set(statusHealthKey(hit), hit);
    for (const hit of finalHits.values()) presentStatusHealth(hit, hit.hpAfter);
  }

  function showStatusDamagePopup(hit, definition, slot) {
    presentStatusHealth(hit, hit.hpAfter);
    const host = hit.target === "enemy"
        ? enemyElement(hit.targetIndex)
        : getPlayerHealthAnchor(),
      className = `status-damage-pop ${hit.target === "enemy" ? "enemy-status-damage" : "health-status-damage"}`;
    if (!host) return;
    const popup = document.createElement("strong");
    popup.className = className;
    popup.style.setProperty("--status-damage-color", definition.color);
    popup.style.setProperty("--damage-x", `${(slot - 1) * 58}px`);
    popup.style.setProperty("--damage-y", `${slot * 16}px`);
    popup.innerHTML = `<small>${definition.name}</small>-${number(hit.amount)}`;
    popup.setAttribute(
      "aria-label",
      `${definition.name}으로 ${number(hit.amount)} 피해`,
    );
    host.append(popup);
    popup.addEventListener("animationend", () => popup.remove(), { once: true });
  }

  function showStatusDamage(hit, index = 0) {
    const definition =
      STATUS_DEFINITIONS[hit.statusId] ||
      (hit.statusId === "shufflePenalty"
        ? { name: "셔플 반동", color: "#caa8ff" }
        : hit.statusId === "impurityOverflow"
          ? { name: "불순물 과부하", color: "#8b6f91" }
          : null);
    if (!definition || hit.amount <= 0) return;
    const color = definition.color,
      delay = index * 190,
      slot = index % 3;
    setTimeout(() => {
      const showPopup = () => showStatusDamagePopup(hit, definition, slot);
      if (isPoisonTick(hit)) showPoisonTickVfx(hit, showPopup);
      else {
        if (hit.target === "player" && hit.statusId !== "thorns")
          showPlayerStatusSmoke(color);
        showPopup();
      }
    }, delay);
  }

  function showEnemyDebuffSmoke(statusIds = []) {
    const battle = document.querySelector(".battle"),
      uniqueStatusIds = [...new Set(statusIds)];
    if (!battle || !uniqueStatusIds.length) return;
    uniqueStatusIds.forEach((statusId, index) => {
      const definition = STATUS_DEFINITIONS[statusId];
      if (!definition) return;
      window.setTimeout(() => {
        if (!document.body.contains(battle)) return;
        const smoke = document.createElement("span");
        smoke.className = "enemy-debuff-smoke";
        smoke.style.setProperty("--debuff-smoke-color", definition.color);
        smoke.setAttribute("aria-hidden", "true");
        smoke.innerHTML = "<i></i>".repeat(20 + Math.floor(Math.random() * 6));
        for (const particle of smoke.children) {
          const fromLeft = Math.random() < .5;
          particle.style.setProperty("--smoke-x", `${8 + Math.random() * 84}%`);
          particle.style.setProperty("--smoke-size", `${80 + Math.random() * 75}px`);
          particle.style.setProperty("--smoke-enter-x", `${fromLeft ? -55 - Math.random() * 40 : 55 + Math.random() * 40}px`);
          particle.style.setProperty("--smoke-drift", `${fromLeft ? 18 + Math.random() * 30 : -18 - Math.random() * 30}px`);
          particle.style.setProperty("--smoke-rise", `${125 + Math.random() * 80}px`);
          particle.style.setProperty("--smoke-delay", `${Math.random() * .22}s`);
          particle.style.setProperty("--smoke-duration", `${.72 + Math.random() * .3}s`);
        }
        placeBattleOverlay(smoke, battle);
        window.setTimeout(() => smoke.remove(), 1400);
      }, index * 130);
    });
  }

  function showStatusDamageQueue(hits) {
    stageStatusDamageHealth(hits);
    hits.forEach(showStatusDamage);
    const poisonTail = hits.some(
        (hit) => isPoisonTick(hit) && hit.target === "player",
      )
        ? 250
        : hits.some(isPoisonTick)
          ? 150
          : 0;
    return hits.length
      ? new Promise((resolve) =>
          setTimeout(
            () => {
              finalizeStatusDamageHealth(hits);
              resolve();
            },
            Math.min(900, 130 + hits.length * 190 + poisonTail),
          ),
        )
      : Promise.resolve();
  }

  function addHealingMotes(effect) {
    if (!effect) return;
    for (let index = 0; index < 7; index++) {
      const mote = document.createElement("i");
      mote.className = "healing-mote";
      mote.style.setProperty("--heal-x", `${-28 + index * 9}px`);
      mote.style.setProperty("--heal-drift", `${index % 2 ? 8 : -7}px`);
      mote.style.setProperty("--heal-delay", `${(index % 4) * 55}ms`);
      effect.append(mote);
    }
  }

  function playerCleanseBounds() {
    const hand = document.querySelector(".hand"),
      battle = document.querySelector(".battle"),
      handRect = hand?.getBoundingClientRect(),
      battleRect = battle?.getBoundingClientRect(),
      source =
        handRect?.width > 0 && handRect?.height > 0
          ? handRect
          : battleRect?.width > 0 && battleRect?.height > 0
            ? battleRect
            : null;
    if (!source) return null;

    const viewportPadding = 12,
      maxWidth = Math.max(0, window.innerWidth - viewportPadding * 2),
      mobile = window.matchMedia?.("(max-width: 720px)")?.matches,
      width = Math.min(
        maxWidth,
        760,
        Math.max(mobile ? 260 : 320, source.width * (mobile ? 0.9 : 0.84)),
      ),
      height = Math.min(
        mobile ? 180 : 230,
        Math.max(mobile ? 120 : 160, source.height * (mobile ? 0.72 : 0.86)),
      ),
      centerX = source.left + source.width * 0.5,
      centerY = source.top + source.height * (handRect === source ? 0.42 : 0.72);

    return { centerX, centerY, width, height };
  }

  function showPlayerCleanseVfx(changes = []) {
    if (!changes.length || !combatEffectsEnabled()) return Promise.resolve();
    const bounds = playerCleanseBounds();
    if (!bounds) return Promise.resolve();

    const reduced = reducedCombatMotion(),
      effect = document.createElement("span"),
      uniqueChanges = changes.filter(
        (change, index, all) =>
          change?.statusId &&
          change.stackBefore > change.stackAfter &&
          all.findIndex((candidate) => candidate?.statusId === change.statusId) === index,
      );
    if (!uniqueChanges.length) return Promise.resolve();

    effect.className = `hmy-player-cleanse${reduced ? " hmy-player-cleanse-reduced" : ""}`;
    effect.style.left = `${bounds.centerX}px`;
    effect.style.top = `${bounds.centerY}px`;
    effect.style.width = `${bounds.width}px`;
    effect.style.height = `${bounds.height}px`;
    effect.setAttribute("aria-hidden", "true");
    effect.innerHTML =
      '<i class="hmy-player-cleanse-haze"></i>' +
      '<i class="hmy-player-cleanse-core"></i>' +
      '<i class="hmy-player-cleanse-wave hmy-player-cleanse-wave-primary"></i>' +
      '<i class="hmy-player-cleanse-wave hmy-player-cleanse-wave-secondary"></i>' +
      '<i class="hmy-player-cleanse-afterglow"></i>';

    if (!reduced) {
      const particleCount = Math.min(16, Math.max(8, uniqueChanges.length * 4));
      for (let index = 0; index < particleCount; index++) {
        const change = uniqueChanges[index % uniqueChanges.length],
          definition = STATUS_DEFINITIONS[change.statusId],
          angle = ((Math.PI * 2) / particleCount) * index,
          distanceX = bounds.width * (0.34 + (index % 3) * 0.035),
          distanceY = bounds.height * (0.34 + ((index + 1) % 3) * 0.04),
          particle = document.createElement("i");
        particle.className = "hmy-player-cleanse-residue";
        particle.style.setProperty("--cleanse-x", `${Math.cos(angle) * distanceX}px`);
        particle.style.setProperty("--cleanse-y", `${Math.sin(angle) * distanceY}px`);
        particle.style.setProperty(
          "--cleanse-residue-color",
          definition?.color || "#8cb8a5",
        );
        particle.style.setProperty("--cleanse-particle-delay", `${180 + (index % 5) * 16}ms`);
        effect.append(particle);
      }
    }

    for (let index = 0; index < uniqueChanges.length; index++) {
      const change = uniqueChanges[index],
        chip = document.querySelector(
          `.player-effects-battle .status-chip[data-status-id="${change.statusId}"]`,
        );
      if (!chip) continue;
      chip.style.setProperty("--cleanse-chip-delay", `${index * 50}ms`);
      chip.classList.remove("hmy-player-cleanse-chip");
      void chip.offsetWidth;
      chip.classList.add("hmy-player-cleanse-chip");
    }

    effectsLayer().append(effect);
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        effect.remove();
        for (const change of uniqueChanges) {
          const chip = document.querySelector(
            `.player-effects-battle .status-chip[data-status-id="${change.statusId}"]`,
          );
          chip?.classList.remove("hmy-player-cleanse-chip");
          chip?.style.removeProperty("--cleanse-chip-delay");
        }
        resolve();
      };
      effect.addEventListener("animationend", (event) => {
        if (event.target === effect) finish();
      });
      window.setTimeout(finish, reduced ? 500 : 600);
    });
  }

  function showEnemyHealing(amount, targetIndex, label = "재생") {
    const enemy = enemyElement(targetIndex);
    if (!enemy || !Number.isFinite(amount) || amount <= 0) return;
    SFX.heal();
    enemy.querySelector(".enemy-healing-pop")?.remove();
    const popup = document.createElement("strong");
    popup.className = "enemy-healing-pop";
    popup.style.setProperty(
      "--enemy-heal-color",
      STATUS_DEFINITIONS.regeneration?.color || "#82d49a",
    );
    popup.innerHTML = `<small>${label}</small>+${number(amount)}`;
    popup.setAttribute("aria-label", `${label}으로 체력 ${number(amount)} 회복`);
    (enemy.querySelector(".enemy-vitals") || enemy).append(popup);
    popup.addEventListener("animationend", () => popup.remove(), { once: true });
    window.setTimeout(() => popup.remove(), 1100);
  }

  function showPlayerHealing(
    amount,
    { waitForPresentation = false } = {},
  ) {
    const health = getPlayerHealthAnchor(),
      battle = document.querySelector(".battle");
    if (!health || amount <= 0)
      return waitForPresentation ? Promise.resolve() : undefined;
    SFX.heal();
    health.classList.remove("player-healing");
    void health.offsetWidth;
    health.classList.add("player-healing");
    const effect = document.createElement("span");
    effect.className = "healing-effect";
    effect.setAttribute("aria-label", `${number(amount)} 체력 회복`);
    effect.innerHTML = `<i class="healing-mist healing-mist-a"></i><i class="healing-mist healing-mist-b"></i><strong>+${number(amount)}</strong>`;
    health.append(effect);
    addHealingMotes(effect);
    const healingNumber = effect.querySelector("strong");
    let presentation = null;
    if (waitForPresentation) {
      presentation = new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          effect.remove();
          resolve();
        };
        healingNumber?.addEventListener("animationend", finish, { once: true });
        window.setTimeout(finish, 1100);
      });
    } else
      healingNumber?.addEventListener("animationend", () => effect.remove(), {
        once: true,
      });
    if (battle) {
      document.querySelector(".battle-healing-mist")?.remove();
      const borderMist = document.createElement("span");
      borderMist.className = "battle-healing-mist";
      borderMist.setAttribute("aria-hidden", "true");
      placeBattleOverlay(borderMist, battle);
      borderMist.addEventListener("animationend", () => borderMist.remove(), {
        once: true,
      });
    }
    return presentation;
  }

  return {
    playContactHitSound,
    showEnemyDebuffSmoke,
    showEnemyHealing,
    showPlayerDamage,
    showPlayerHealing,
    showPlayerCleanseVfx,
    stageStatusDamageHealth,
    showStatusDamageQueue,
    showStatusProcQueue,
    showStatusProcVfx,
    showThornsRetaliationVfx,
  };
}
