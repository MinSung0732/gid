const FX_STORAGE_KEY = "harmony_combat_fx";
const CONTACT_SUPER_PLAYBACK_RATE = 0.56;
const NONCONTACT_SUPER_CHARGE_MS = 1250;
const NONCONTACT_SUPER_CAST_PLAYBACK_RATE = 0.82;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const tunedAnimations = new WeakSet();
const preparedContactCards = new WeakSet();
const preparedNonContactCards = new WeakSet();

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
  if (!root?.getAnimations || reducedMotion.matches || !effectsEnabled()) return;
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

function syncBattlePanelDimmer(dimmer, card) {
  const battle = document.querySelector(".battle");
  if (!dimmer?.isConnected || !battle) return false;

  const battleRect = battle.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  if (!battleRect.width || !battleRect.height) return false;

  const originX = Math.max(0, Math.min(battleRect.width, cardRect.left + cardRect.width / 2 - battleRect.left));
  const originY = Math.max(0, Math.min(battleRect.height, cardRect.top + cardRect.height / 2 - battleRect.top));

  dimmer.style.left = `${battleRect.left}px`;
  dimmer.style.top = `${battleRect.top}px`;
  dimmer.style.width = `${battleRect.width}px`;
  dimmer.style.height = `${battleRect.height}px`;
  dimmer.style.setProperty("--super-origin-x", `${originX}px`);
  dimmer.style.setProperty("--super-origin-y", `${originY}px`);
  return true;
}

function createBattlePanelDimmer(card, flavor) {
  if (reducedMotion.matches || !effectsEnabled()) return null;
  const dimmer = document.createElement("div");
  dimmer.className = `super-charge-panel-dimmer super-charge-panel-dimmer-${flavor}`;
  dimmer.setAttribute("aria-hidden", "true");
  document.body.append(dimmer);
  if (!syncBattlePanelDimmer(dimmer, card)) {
    dimmer.remove();
    return null;
  }
  return dimmer;
}

function releaseBattlePanelDimmer(dimmer) {
  if (!dimmer?.isConnected || dimmer.classList.contains("is-releasing")) return;
  dimmer.classList.add("is-releasing");
  window.setTimeout(() => dimmer.remove(), 280);
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

function monitorContactSuper(card) {
  if (preparedContactCards.has(card)) return;
  preparedContactCards.add(card);

  const dimmer = createBattlePanelDimmer(card, "contact");
  tuneAnimations(card, CONTACT_SUPER_PLAYBACK_RATE);
  trackCardStage(card, dimmer, () => {
    if (!reducedMotion.matches && effectsEnabled()) {
      tuneAnimations(card, CONTACT_SUPER_PLAYBACK_RATE);
    }
  });
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
    const delay = (index % 8) * 55;
    return `<i style="--charge-angle:${angle}deg;--charge-distance:${distance}px;--charge-delay:${delay}ms"></i>`;
  }).join("");
  charge.innerHTML = `<span></span><b></b>${rays}`;
  (document.getElementById("fx-layer") || document.body).append(charge);
  return charge;
}

async function prepareNonContactSuper(card) {
  if (
    preparedNonContactCards.has(card) ||
    reducedMotion.matches ||
    !effectsEnabled()
  )
    return;

  preparedNonContactCards.add(card);

  const focus = [...document.querySelectorAll(".noncontact-cast-focus-super")].at(-1);
  const cardAnimations = pauseAtStart(card);
  const focusAnimations = pauseAtStart(focus);
  const dimmer = createBattlePanelDimmer(card, "noncontact");
  trackCardStage(card, dimmer);

  card.classList.add("noncontact-super-precharging");
  const charge = createNonContactSuperCharge(card);

  await new Promise((resolve) => setTimeout(resolve, NONCONTACT_SUPER_CHARGE_MS));

  charge?.remove();
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
