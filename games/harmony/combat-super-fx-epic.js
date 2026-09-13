const FX_STORAGE_KEY = "harmony_combat_fx";
const SUPER_ATTACK_CHARGE_MS = 2000;
const CONTACT_SUPER_HOLD_MS = SUPER_ATTACK_CHARGE_MS;
const CONTACT_SUPER_PLAYBACK_RATE = 0.72;
const NONCONTACT_SUPER_CHARGE_MS = SUPER_ATTACK_CHARGE_MS;
const NONCONTACT_SUPER_CAST_PLAYBACK_RATE = 0.82;

const tunedAnimations = new WeakSet();
const preparedContactCards = new WeakSet();
const preparedNonContactCards = new WeakSet();

document.documentElement.dataset.superFxEpic = "5";

function effectsEnabled() {
  const override = document.documentElement.dataset.combatFx;
  if (override === "off") return false;
  if (override === "on") return true;
  try {
    return localStorage.getItem(FX_STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function tuneAnimation(animation, rate = CONTACT_SUPER_PLAYBACK_RATE) {
  if (!animation || tunedAnimations.has(animation)) return;
  tunedAnimations.add(animation);
  try {
    if (typeof animation.updatePlaybackRate === "function") animation.updatePlaybackRate(rate);
    else animation.playbackRate = rate;
  } catch {
    // Some browsers expose an animation briefly while it is being replaced.
  }
}

function tuneAnimations(root, rate = CONTACT_SUPER_PLAYBACK_RATE) {
  if (!root?.getAnimations || !effectsEnabled()) return;
  root.getAnimations({ subtree: true }).forEach((animation) => tuneAnimation(animation, rate));
}

function pauseAtStart(root) {
  if (!root?.getAnimations) return [];
  const animations = root.getAnimations({ subtree: true });
  for (const animation of animations) {
    try {
      animation.pause();
      animation.currentTime = 0;
    } catch {
      // Ignore animations that have already been replaced by the renderer.
    }
  }
  return animations;
}

function resumeAnimations(animations, rate = 1) {
  for (const animation of animations) {
    try {
      if (rate !== 1) tuneAnimation(animation, rate);
      if (animation.playState !== "finished") animation.play();
    } catch {
      // The source node may have disappeared while the effect was running.
    }
  }
}

function getBattlePanel() {
  return document.querySelector(".battle") || document.querySelector("main") || document.body;
}

function getFxLayer() {
  return document.getElementById("fx-layer");
}

function syncBattlePanelDimmer(dimmer, card) {
  const battle = getBattlePanel();
  if (!dimmer?.isConnected || !battle) return false;

  const battleRect = battle.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  if (!battleRect.width || !battleRect.height) return false;

  const originX = Math.max(
    0,
    Math.min(battleRect.width, cardRect.left + cardRect.width / 2 - battleRect.left),
  );
  const originY = Math.max(
    0,
    Math.min(battleRect.height, cardRect.top + cardRect.height / 2 - battleRect.top),
  );

  dimmer.style.left = `${battleRect.left}px`;
  dimmer.style.top = `${battleRect.top}px`;
  dimmer.style.width = `${battleRect.width}px`;
  dimmer.style.height = `${battleRect.height}px`;
  dimmer.style.setProperty("--super-origin-x", `${originX}px`);
  dimmer.style.setProperty("--super-origin-y", `${originY}px`);
  return true;
}

function createBattlePanelDimmer(card, flavor) {
  if (!effectsEnabled()) return null;

  const dimmer = document.createElement("div");
  dimmer.className = `super-charge-panel-dimmer super-charge-panel-dimmer-${flavor}`;
  dimmer.setAttribute("aria-hidden", "true");

  const fxLayer = getFxLayer();
  if (fxLayer) fxLayer.prepend(dimmer);
  else document.body.append(dimmer);

  if (!syncBattlePanelDimmer(dimmer, card)) {
    dimmer.remove();
    return null;
  }
  return dimmer;
}

function releaseBattlePanelDimmer(dimmer) {
  if (!dimmer?.isConnected || dimmer.classList.contains("is-releasing")) return;
  dimmer.classList.add("is-releasing");
  window.setTimeout(() => dimmer.remove(), 320);
}

function trackCardStage(card, dimmer, onFrame) {
  const tick = () => {
    if (!card.isConnected || !effectsEnabled()) {
      releaseBattlePanelDimmer(dimmer);
      return;
    }
    syncBattlePanelDimmer(dimmer, card);
    onFrame?.();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function syncCircularCardCharge(charge, card) {
  if (!charge?.isConnected || !card?.isConnected) return;
  const rect = card.getBoundingClientRect();
  charge.style.left = `${rect.left + rect.width / 2}px`;
  charge.style.top = `${rect.top + rect.height / 2}px`;
}

function createCircularCardCharge(card, flavor, duration) {
  if (!effectsEnabled()) return null;
  const rect = card.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const charge = document.createElement("div"),
    particleCount = 32,
    particles = Array.from({ length: particleCount }, (_, index) => {
      const angle = index * (360 / particleCount) + (index % 3) * 4,
        radius = 138 + (index % 6) * 16,
        middleRadius = 54 + (index % 5) * 7,
        size = 3 + (index % 4),
        cycle = 820 + (index % 5) * 105,
        delay = -((index % 9) * 105);
      return `<i style="--particle-angle:${angle}deg;--particle-radius:${radius}px;--particle-middle-radius:${middleRadius}px;--particle-size:${size}px;--particle-cycle:${cycle}ms;--particle-delay:${delay}ms"></i>`;
    }).join("");

  charge.className = `super-card-light-charge super-card-light-charge-${flavor}`;
  charge.setAttribute("aria-hidden", "true");
  charge.style.setProperty("--super-card-charge-ms", `${duration}ms`);
  charge.innerHTML = `<span></span><b></b>${particles}`;
  (getFxLayer() || document.body).append(charge);
  syncCircularCardCharge(charge, card);
  return charge;
}

function monitorContactSuper(card) {
  if (preparedContactCards.has(card)) return;
  preparedContactCards.add(card);

  // Give contact supers a real wind-up instead of only stretching the launch.
  // main.js awaits the card animation's `finished` promise, so pausing that
  // animation safely holds combat resolution until the charge beat is over.
  const cardAnimations = pauseAtStart(card);
  const dimmer = createBattlePanelDimmer(card, "contact");
  const circularCharge = createCircularCardCharge(
    card,
    "contact",
    CONTACT_SUPER_HOLD_MS,
  );
  card.classList.add("super-contact-precharging");

  trackCardStage(card, dimmer, () => {
    syncCircularCardCharge(circularCharge, card);
    if (effectsEnabled()) {
      tuneAnimations(card, CONTACT_SUPER_PLAYBACK_RATE);
    }
  });

  window.setTimeout(() => {
    circularCharge?.remove();
    card.classList.remove("super-contact-precharging");
    if (effectsEnabled()) resumeAnimations(cardAnimations, CONTACT_SUPER_PLAYBACK_RATE);
    else resumeAnimations(cardAnimations, 1);
  }, CONTACT_SUPER_HOLD_MS);
}

function createNonContactSuperCharge(card) {
  const rect = card.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const charge = document.createElement("div");
  charge.className = "noncontact-super-charge noncontact-super-charge-epic";
  charge.setAttribute("aria-hidden", "true");
  charge.style.left = `${rect.left + rect.width / 2}px`;
  charge.style.top = `${rect.top + rect.height / 2}px`;
  charge.style.setProperty("--noncontact-super-charge-ms", `${NONCONTACT_SUPER_CHARGE_MS}ms`);

  const rays = Array.from({ length: 24 }, (_, index) => {
    const angle = index * 15 + (index % 2 ? 6 : -5);
    const distance = 118 + (index % 6) * 18;
    const delay = (index % 8) * 70;
    return `<i style="--charge-angle:${angle}deg;--charge-distance:${distance}px;--charge-delay:${delay}ms"></i>`;
  }).join("");
  charge.innerHTML = `<span></span><b></b>${rays}`;
  (getFxLayer() || document.body).append(charge);
  return charge;
}

async function prepareNonContactSuper(card) {
  if (
    preparedNonContactCards.has(card) ||
    !effectsEnabled()
  )
    return;

  preparedNonContactCards.add(card);

  const focus = [...document.querySelectorAll(".noncontact-cast-focus-super")].at(-1);
  const cardAnimations = pauseAtStart(card);
  const focusAnimations = pauseAtStart(focus);
  const dimmer = createBattlePanelDimmer(card, "noncontact");
  const circularCharge = createCircularCardCharge(
    card,
    "noncontact",
    NONCONTACT_SUPER_CHARGE_MS,
  );
  trackCardStage(card, dimmer, () =>
    syncCircularCardCharge(circularCharge, card),
  );

  card.classList.add("noncontact-super-precharging");
  const charge = createNonContactSuperCharge(card);

  await new Promise((resolve) => setTimeout(resolve, NONCONTACT_SUPER_CHARGE_MS));

  charge?.remove();
  circularCharge?.remove();
  card.classList.remove("noncontact-super-precharging");
  resumeAnimations(focusAnimations, NONCONTACT_SUPER_CAST_PLAYBACK_RATE);
  resumeAnimations(cardAnimations, NONCONTACT_SUPER_CAST_PLAYBACK_RATE);
}

function handleNode(node) {
  if (!(node instanceof Element)) return;

  const candidates = [
    node,
    ...node.querySelectorAll(
      ".super-contact-attack-card, .strong-attack-dimmer.super-contact-focus, .strong-attack-focus.super-contact-focus, .super-attack-charge, .noncontact-cast-card-super",
    ),
  ];

  for (const element of candidates) {
    if (element.matches(".super-contact-attack-card")) {
      monitorContactSuper(element);
    } else if (
      element.matches(
        ".strong-attack-dimmer.super-contact-focus, .strong-attack-focus.super-contact-focus, .super-attack-charge",
      )
    ) {
      tuneAnimations(element, CONTACT_SUPER_PLAYBACK_RATE);
    } else if (element.matches(".noncontact-cast-card-super")) {
      void prepareNonContactSuper(element);
    }
  }
}

new MutationObserver((records) => {
  for (const record of records) record.addedNodes.forEach(handleNode);
}).observe(document.body, { childList: true, subtree: true });

handleNode(document.body);

window.HarmonySuperFxTuning = Object.freeze({
  storageKey: FX_STORAGE_KEY,
  isEnabled: effectsEnabled,
  setEnabled(enabled) {
    const value = enabled ? "on" : "off";
    document.documentElement.dataset.combatFx = value;
    try {
      localStorage.setItem(FX_STORAGE_KEY, value);
    } catch {
      // The in-page data attribute still keeps the setting for this session.
    }
  },
});
