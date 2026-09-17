import * as E from "./engine.js?v=20260913-22";
import { SFX } from "./sound.js?v=20260911-9";
import { placeBattleOverlay } from "./battle-overlay.js";
import { MULTI_HIT_IMPACT_CAP, getMultiHitImpactPoint } from "./multi-hit-presentation.js";

const SPECIAL_CARD_ATTACK_VFX = Object.freeze({
  // Future card-only visuals live here. Add `fx: { vfx: "your-key" }` to the
  // card definition, then register the same key with a handler below.
  // "example-card-vfx": ({ targetIndex, descriptor }) => { ... },
});
const SPECIAL_CARD_ATTACK_SFX = Object.freeze({
  // Future card-only sounds use `fx: { sfx: "your-key" }` on the card and a
  // matching function here. Missing handlers intentionally fall back to defaults.
});

export function createAttackFeedbackVfx({
  combatEffectsEnabled,
  effectsLayer,
  enemyElement,
  formatNumber,
  getCombatFxSequence,
  nextCombatFxSequence,
  playContactHitSound,
  reducedCombatMotion,
}) {
  const number = formatNumber;
  let activeMultiHitImpacts = [];

  function multiHitPoint(presentation) {
    return presentation?.multiHit ? presentation.impactPoint || null : null;
  }

  function localImpactPoint(enemy, presentation) {
    const point = multiHitPoint(presentation);
    if (!point) return null;
    if (Number.isFinite(point.localX) && Number.isFinite(point.localY))
      return { x: point.localX, y: point.localY };
    const bounds = enemy.getBoundingClientRect();
    return { x: point.x - bounds.left, y: point.y - bounds.top };
  }

  function decorateMultiHitImpact(node, presentation, life = 220) {
    if (!node || !presentation?.multiHit) return;
    activeMultiHitImpacts = activeMultiHitImpacts.filter((entry) => entry?.isConnected);
    while (activeMultiHitImpacts.length >= MULTI_HIT_IMPACT_CAP)
      activeMultiHitImpacts.shift()?.remove();
    node.classList.add("hmy-multihit-impact");
    if (presentation.isFinisher) node.classList.add("hmy-multihit-finisher");
    if (Number.isFinite(presentation.visualScale))
      node.style.scale = String(presentation.visualScale);
    activeMultiHitImpacts.push(node);
    window.setTimeout(() => node.remove(), presentation.isFinisher ? Math.max(life, 280) : life);
  }

  function shouldReact(presentation) {
    return !presentation?.multiHit || presentation.react || presentation.isFinisher;
  }

  function resolveMultiHitImpactPoint({
    targetIndex = null,
    hitIndex = 0,
    hitCount = 2,
    previousPoint = null,
    previousRegion = null,
  } = {}) {
    const enemy = enemyElement(targetIndex);
    if (!enemy) return null;
    return getMultiHitImpactPoint({
      targetRect: enemy.getBoundingClientRect(),
      targetIndex,
      hitIndex,
      hitCount,
      previousPoint,
      previousRegion,
    });
  }

  function showCombatImpactRing(
    targetIndex = null,
    tone = "contact",
    superStrong = false,
  ) {
    if (!combatEffectsEnabled()) return;
    const enemy = enemyElement(targetIndex);
    if (!enemy) return;
    const ring = document.createElement("span");
    ring.className = `combat-impact-ring impact-${tone}${superStrong ? " impact-super" : ""}`;
    ring.setAttribute("aria-hidden", "true");
    enemy.append(ring);
    ring.addEventListener("animationend", () => ring.remove(), { once: true });
    window.setTimeout(() => ring.remove(), 820);
  }

  function contactHitPause(power = "weak", reducedMotion = false) {
    const timings = reducedMotion
      ? { weak: 28, strong: 46, super: 70 }
      : { weak: 65, strong: 110, super: 175 };
    return timings[power] || timings.weak;
  }

  function showContactImpactHold(targetIndex = null, power = "weak", presentation = null) {
    if (!combatEffectsEnabled()) return;
    const battle = document.querySelector(".battle"),
      enemy = enemyElement(targetIndex);
    if (!battle || !enemy) return;
    const battleRect = battle.getBoundingClientRect(),
      enemyRect = enemy.getBoundingClientRect(),
      hold = document.createElement("span");
    hold.className = `contact-impact-hold contact-impact-hold-${power}`;
    hold.setAttribute("aria-hidden", "true");
    const point = multiHitPoint(presentation);
    hold.style.setProperty(
      "--contact-hit-x",
      `${point ? point.x - battleRect.left : enemyRect.left + enemyRect.width / 2 - battleRect.left}px`,
    );
    hold.style.setProperty(
      "--contact-hit-y",
      `${point ? point.y - battleRect.top : enemyRect.top + enemyRect.height / 2 - battleRect.top}px`,
    );
    placeBattleOverlay(hold, battle);
    decorateMultiHitImpact(hold, presentation, 230);
    hold.addEventListener("animationend", () => hold.remove(), { once: true });
    window.setTimeout(() => hold.remove(), power === "super" ? 420 : 320);
  }

  function showContactImpactCrack(targetIndex = null, power = "strong", presentation = null) {
    if (power === "weak" || !combatEffectsEnabled()) return;
    const enemy = enemyElement(targetIndex);
    if (!enemy) return;
    const crack = document.createElement("span"),
      crackCount = power === "super" ? 12 : 7,
      angleOffset = [-9, 4, 13, -4][getCombatFxSequence() % 4];
    crack.className = `contact-impact-crack contact-impact-crack-${power}`;
    crack.setAttribute("aria-hidden", "true");
    for (let index = 0; index < crackCount; index++) {
      const line = document.createElement("i"),
        angle = index * (360 / crackCount) + angleOffset + (index % 2 ? 7 : -4),
        length = power === "super" ? 64 + (index % 4) * 14 : 42 + (index % 3) * 11;
      line.style.setProperty("--crack-angle", `${angle}deg`);
      line.style.setProperty("--crack-length", `${length}px`);
      line.style.setProperty("--crack-start", `${power === "super" ? 16 + (index % 3) * 5 : 12 + (index % 2) * 5}px`);
      line.style.setProperty("--crack-branch", `${index % 2 ? 24 : -28}deg`);
      line.style.setProperty("--crack-delay", `${(index % 4) * 12}ms`);
      crack.append(line);
    }
    const localPoint = localImpactPoint(enemy, presentation);
    if (localPoint) {
      crack.style.left = `${localPoint.x}px`;
      crack.style.top = `${localPoint.y}px`;
    }
    enemy.append(crack);
    decorateMultiHitImpact(crack, presentation, 240);
    crack.addEventListener(
      "animationend",
      (event) => {
        if (event.target === crack) crack.remove();
      },
      { once: true },
    );
    window.setTimeout(() => crack.remove(), power === "super" ? 900 : 700);
  }

  function showContactTierImpact(targetIndex = null, power = "weak", presentation = null) {
    showContactImpactHold(targetIndex, power, presentation);
    showContactImpactCrack(targetIndex, power, presentation);
  }

  function showShieldBreakImpact(
    targetIndex = null,
    pattern = "contact",
    power = "weak",
    presentation = null,
  ) {
    if (!combatEffectsEnabled()) return;
    const enemy = enemyElement(targetIndex);
    if (!enemy) return;
    const effect = document.createElement("span"),
      shardCount = power === "super" ? 14 : power === "strong" ? 10 : 7,
      phase = getCombatFxSequence() % 5;
    effect.className = `shield-break-impact shield-break-${pattern} shield-break-${power}`;
    effect.setAttribute("aria-hidden", "true");
    effect.innerHTML = '<span class="shield-break-shell"></span><span class="shield-break-core"></span>';
    for (let index = 0; index < shardCount; index++) {
      const shard = document.createElement("i"),
        angle = (360 / shardCount) * index + phase * 7 + (index % 2 ? 5 : -3),
        distance = power === "super"
          ? 76 + (index % 4) * 14
          : power === "strong"
            ? 58 + (index % 4) * 11
            : 42 + (index % 3) * 9;
      shard.style.setProperty("--shield-break-angle", `${angle}deg`);
      shard.style.setProperty("--shield-break-distance", `${distance}px`);
      shard.style.setProperty("--shield-break-delay", `${(index % 4) * 12}ms`);
      shard.style.setProperty("--shield-break-spin", `${index % 2 ? 78 : -72}deg`);
      effect.append(shard);
    }
    const point = multiHitPoint(presentation);
    if (pattern === "noncontact") {
      const bounds = point ? null : enemy.getBoundingClientRect();
      effect.classList.add("shield-break-overlay");
      effect.style.left = `${point?.x ?? bounds.left + bounds.width / 2}px`;
      effect.style.top = `${point?.y ?? bounds.top + bounds.height * 0.48}px`;
      effectsLayer().append(effect);
    } else {
      const localPoint = localImpactPoint(enemy, presentation);
      if (localPoint) {
        effect.style.left = `${localPoint.x}px`;
        effect.style.top = `${localPoint.y}px`;
      }
      enemy.append(effect);
    }
    decorateMultiHitImpact(effect, presentation, 250);
    effect.addEventListener(
      "animationend",
      (event) => {
        if (event.target === effect) effect.remove();
      },
      { once: true },
    );
    window.setTimeout(() => effect.remove(), power === "super" ? 1040 : 820);
  }

  function showNonContactImpact(
    targetIndex = null,
    power = "weak",
    shieldBreak = false,
    presentation = null,
  ) {
    if (!combatEffectsEnabled()) return;
    const enemy = enemyElement(targetIndex),
      battle = document.querySelector(".battle");
    if (!enemy) return;
    const profile = power === "super"
        ? { particles: 14, rings: 3, life: 900, distance: 88 }
        : power === "strong"
          ? { particles: 10, rings: 2, life: 720, distance: 66 }
          : { particles: 6, rings: 1, life: 460, distance: 40 },
      bounds = enemy.getBoundingClientRect(),
      impact = document.createElement("span"),
      strong = power !== "weak",
      superStrong = power === "super",
      phase = getCombatFxSequence() % 4;
    impact.className = `noncontact-impact noncontact-impact-${power}${strong ? " noncontact-impact-strong" : ""}${superStrong ? " noncontact-impact-super" : ""}${shieldBreak ? " noncontact-impact-shield-break" : ""}`;
    impact.setAttribute("aria-hidden", "true");
    const point = multiHitPoint(presentation);
    impact.style.left = `${point?.x ?? bounds.left + bounds.width / 2}px`;
    impact.style.top = `${point?.y ?? bounds.top + bounds.height * 0.46}px`;
    impact.style.setProperty("--noncontact-life", `${profile.life}ms`);
    impact.innerHTML = `<span class="noncontact-aura"></span>${Array.from({ length: profile.rings }, (_, index) => `<span class="noncontact-ring noncontact-ring-${index + 1}"></span>`).join("")}<span class="noncontact-core"></span><span class="noncontact-beam"></span><span class="noncontact-cross"></span>`;
    for (let index = 0; index < profile.particles; index++) {
      const particle = document.createElement("i"),
        angle = Math.round((360 / profile.particles) * index + phase * 9 + (index % 2 ? 4 : -3)),
        distance = profile.distance + (index % 4) * (superStrong ? 18 : strong ? 12 : 7);
      particle.style.setProperty("--spark-angle", `${angle}deg`);
      particle.style.setProperty("--spark-distance", `${distance}px`);
      particle.style.setProperty("--spark-delay", `${(index % 5) * (superStrong ? 13 : 16)}ms`);
      impact.append(particle);
    }
    effectsLayer().append(impact);
    decorateMultiHitImpact(impact, presentation, 240);
    impact.addEventListener(
      "animationend",
      (event) => {
        if (event.target === impact) impact.remove();
      },
      { once: true },
    );
    window.setTimeout(() => impact.remove(), profile.life + 120);
    if (battle && strong && !reducedCombatMotion() && shouldReact(presentation)) {
      const shakeClass = superStrong
        ? "noncontact-super-shake"
        : "noncontact-strong-shake";
      battle.classList.remove("noncontact-strong-shake", "noncontact-super-shake");
      void battle.offsetWidth;
      battle.classList.add(shakeClass);
      window.setTimeout(
        () => battle.classList.remove(shakeClass),
        superStrong ? 480 : 320,
      );
    }
  }

  function showAttackImpactVisual(descriptor, targetIndex = null, presentation = null) {
    if (!combatEffectsEnabled()) return;
    const requestedKey = E.combatFxVisualKey(descriptor),
      specialHandler = SPECIAL_CARD_ATTACK_VFX[requestedKey];
    if (typeof specialHandler === "function") {
      specialHandler({ targetIndex, descriptor });
      return;
    }
    const key = defaultAttackVfxKey(descriptor),
      power = descriptor.power || "weak";
    if (key.startsWith("contact-hit-")) {
      showContactTierImpact(targetIndex, power, presentation);
      return;
    }
    if (key.startsWith("contact-shield-break-")) {
      showContactTierImpact(targetIndex, power, presentation);
      showShieldBreakImpact(targetIndex, "contact", power, presentation);
      return;
    }
    if (key.startsWith("noncontact-hit-")) {
      showNonContactImpact(targetIndex, power, false, presentation);
      return;
    }
    if (key.startsWith("noncontact-shield-break-")) {
      showNonContactImpact(targetIndex, power, true, presentation);
      showShieldBreakImpact(targetIndex, "noncontact", power, presentation);
    }
  }

  function normalizedAttackFx(
    amount,
    attackPattern,
    strong,
    superStrong,
    brokeThroughShield,
    fx,
  ) {
    const fallbackPower = superStrong
        ? "super"
        : strong
          ? "strong"
          : E.combatFxPowerTier(Math.max(0, amount || 0) + Math.max(0, fx?.blocked || 0)),
      power = ["weak", "strong", "super"].includes(fx?.power)
        ? fx.power
        : fallbackPower;
    return {
      ...(fx || {}),
      pattern: fx?.pattern || attackPattern || "neutral",
      power: power === "none" ? "weak" : power,
      shieldBreak: Boolean(fx?.shieldBreak || brokeThroughShield),
    };
  }

  function defaultAttackVfxKey(descriptor) {
    return E.combatFxVisualKey({ ...descriptor, vfxKey: null });
  }

  function playAttackHitSound(descriptor) {
    for (const key of descriptor.soundCandidates || []) {
      const special = SPECIAL_CARD_ATTACK_SFX[key];
      if (typeof special === "function") {
        special(descriptor);
        return;
      }
    }
    const strong = descriptor.power !== "weak",
      superStrong = descriptor.power === "super";
    if (descriptor.pattern === "contact" && descriptor.shieldBreak) {
      if (superStrong) SFX.barrierBreakSuperContactHit();
      else if (strong) SFX.barrierBreakStrongContactHit();
      else SFX.barrierBreakContactHit();
      return;
    }
    if (descriptor.pattern === "contact") {
      playContactHitSound(strong, superStrong);
      return;
    }
    if (descriptor.pattern === "nonContact") SFX.nonContactHit();
  }

  function enemyHitClassFor(descriptor) {
    if (descriptor.pattern === "nonContact") {
      if (descriptor.power === "super") return "enemy-hit-noncontact-super";
      if (descriptor.power === "strong") return "enemy-hit-noncontact-strong";
      return "enemy-hit-noncontact";
    }
    if (descriptor.power === "super") return "enemy-hit-super";
    if (descriptor.power === "strong") return "enemy-hit-strong";
    return "enemy-hit";
  }

  function showHitFeedback(
    amount,
    targetIndex = null,
    attackPattern = null,
    strong = false,
    superStrong = false,
    brokeThroughShield = false,
    fx = null,
    presentation = null,
  ) {
    const enemy = enemyElement(targetIndex),
      visibleAmount = Math.max(0, Number(amount) || 0),
      blockedAmount = Math.max(0, Number(fx?.blocked) || 0);
    if (!enemy || visibleAmount + blockedAmount <= 0) return multiHitPoint(presentation);
    const descriptor = normalizedAttackFx(
        amount,
        attackPattern,
        strong,
        superStrong,
        brokeThroughShield,
        fx,
      ),
      visualStrong = descriptor.power !== "weak",
      visualSuperStrong = descriptor.power === "super",
      hitClass = enemyHitClassFor(descriptor);
    if (!presentation?.multiHit || presentation.playSound !== false) playAttackHitSound(descriptor);
    if (combatEffectsEnabled()) {
      if (shouldReact(presentation)) {
        for (const animation of enemy.getAnimations()) {
          if (animation.animationName?.startsWith("enemy-hit")) animation.cancel();
        }
        enemy.classList.remove(
          "enemy-hit",
          "enemy-hit-strong",
          "enemy-hit-super",
          "enemy-hit-noncontact",
          "enemy-hit-noncontact-strong",
          "enemy-hit-noncontact-super",
        );
        enemy.classList.add(hitClass);
      }
      showAttackImpactVisual(descriptor, targetIndex, presentation);
    }
    if (visibleAmount <= 0) return multiHitPoint(presentation);
    const popup = document.createElement("strong"),
      slot = nextCombatFxSequence() % 7,
      xOffsets = [-14, 8, -6, 14, 1, -10, 10],
      yOffsets = [-2, 3, -5, 1, -4, 4, -1],
      rotations = [-5, 3, -2, 4, 0, -4, 2];
    popup.className = `damage-pop${visualStrong ? " damage-pop-strong" : ""}${visualSuperStrong ? " damage-pop-super" : ""}${presentation?.multiHit ? " hmy-multihit-damage" : ""}${presentation?.isFinisher ? " hmy-multihit-finisher" : ""}`;
    popup.textContent = `-${number(amount)}`;
    popup.setAttribute("aria-label", `${number(amount)} 피해`);
    popup.style.setProperty("--damage-pop-x", `${xOffsets[slot]}px`);
    popup.style.setProperty("--damage-pop-y", `${yOffsets[slot]}px`);
    popup.style.setProperty("--damage-pop-rotate", `${rotations[slot]}deg`);
    const popupPoint = localImpactPoint(enemy, presentation);
    if (popupPoint) {
      popup.style.left = `${popupPoint.x}px`;
      popup.style.top = `${popupPoint.y}px`;
    }
    enemy.append(popup);
    popup.addEventListener("animationend", () => popup.remove(), { once: true });
    return multiHitPoint(presentation);
  }

  function showWeakContactImpact(targetIndex = null, presentation = null) {
    if (!combatEffectsEnabled()) return;
    const enemy = enemyElement(targetIndex),
      battle = document.querySelector(".battle");
    if (!enemy) return;
    const impact = document.createElement("span"),
      angle = [-14, -7, 5, 12][getCombatFxSequence() % 4],
      rayCount = 8;
    impact.className = "weak-contact-impact";
    impact.setAttribute("aria-hidden", "true");
    impact.style.setProperty("--impact-angle", `${angle}deg`);
    impact.innerHTML = `${"<span></span>".repeat(2)}${"<i></i>".repeat(rayCount)}`;
    [...impact.querySelectorAll("i")].forEach((ray, index) => {
      ray.style.setProperty("--impact-ray-angle", `${index * (360 / rayCount) + angle}deg`);
      ray.style.setProperty("--impact-ray-length", `${34 + (index % 3) * 7}px`);
      ray.style.setProperty("--impact-ray-delay", `${(index % 2) * 12}ms`);
    });
    const localPoint = localImpactPoint(enemy, presentation);
    if (localPoint) {
      impact.style.left = `${localPoint.x}px`;
      impact.style.top = `${localPoint.y}px`;
    }
    enemy.append(impact);
    decorateMultiHitImpact(impact, presentation, 220);
    impact.addEventListener("animationend", () => impact.remove(), { once: true });
    window.setTimeout(() => impact.remove(), 620);
    if (battle && !reducedCombatMotion() && shouldReact(presentation)) {
      for (const animation of battle.getAnimations()) {
        if (animation.animationName === "weak-contact-screen-shake") animation.cancel();
      }
      battle.classList.remove("weak-contact-shake");
      void battle.offsetWidth;
      battle.classList.add("weak-contact-shake");
      window.setTimeout(() => battle.classList.remove("weak-contact-shake"), 190);
    }
  }

  function showStrongContactImpact(targetIndex = null, superStrong = false, presentation = null) {
    if (!combatEffectsEnabled()) return;
    const enemy = enemyElement(targetIndex),
      battle = document.querySelector(".battle");
    if (!enemy) return;
    const impact = document.createElement("span"),
      rayCount = superStrong ? 16 : 12,
      angle = [-11, -4, 6, 13][getCombatFxSequence() % 4];
    impact.className = `strong-contact-impact${superStrong ? " strong-contact-impact-super" : ""}`;
    impact.setAttribute("aria-hidden", "true");
    impact.style.setProperty("--impact-angle", `${angle}deg`);
    impact.innerHTML = `${"<span></span>".repeat(superStrong ? 4 : 3)}${"<i></i>".repeat(rayCount)}`;
    [...impact.querySelectorAll("i")].forEach((ray, index) => {
      ray.style.setProperty("--impact-ray-angle", `${index * (360 / rayCount) + angle}deg`);
      ray.style.setProperty(
        "--impact-ray-length",
        `${superStrong ? 78 + (index % 4) * 11 : 58 + (index % 4) * 9}px`,
      );
      ray.style.setProperty("--impact-ray-delay", `${(index % 4) * 10}ms`);
    });
    const localPoint = localImpactPoint(enemy, presentation);
    if (localPoint) {
      impact.style.left = `${localPoint.x}px`;
      impact.style.top = `${localPoint.y}px`;
    }
    enemy.append(impact);
    decorateMultiHitImpact(impact, presentation, 240);
    impact.addEventListener(
      "animationend",
      (event) => {
        if (event.target === impact) impact.remove();
      },
      { once: true },
    );
    window.setTimeout(() => impact.remove(), superStrong ? 960 : 760);
    if (battle && !reducedCombatMotion() && shouldReact(presentation)) {
      const shakeClass = superStrong ? "super-contact-shake" : "strong-contact-shake";
      for (const animation of battle.getAnimations()) {
        if (["strong-contact-screen-shake", "super-contact-screen-shake"].includes(animation.animationName))
          animation.cancel();
      }
      battle.classList.remove("strong-contact-shake", "super-contact-shake");
      void battle.offsetWidth;
      battle.classList.add(shakeClass);
      window.setTimeout(
        () => battle.classList.remove(shakeClass),
        superStrong ? 620 : 440,
      );
    }
  }

  return {
    contactHitPause,
    resolveMultiHitImpactPoint,
    showHitFeedback,
    showStrongContactImpact,
    showWeakContactImpact,
  };
}
