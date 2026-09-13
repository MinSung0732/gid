const FX_STORAGE_KEY = "harmony_combat_fx";
const CONTACT_SUPER_PLAYBACK_RATE = 0.82;
const NONCONTACT_SUPER_CHARGE_MS = 420;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const tunedAnimations = new WeakSet();
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
    // A browser may expose a read-only animation while it is being replaced.
  }
}

function tuneAnimations(root) {
  if (!root?.getAnimations || reducedMotion.matches || !effectsEnabled()) return;
  root.getAnimations({ subtree: true }).forEach((animation) => tuneAnimation(animation));
}

function monitorContactSuper(card) {
  const tick = () => {
    if (!card.isConnected) return;
    if (!reducedMotion.matches && effectsEnabled()) tuneAnimations(card);
    requestAnimationFrame(tick);
  };
  tuneAnimations(card);
  requestAnimationFrame(tick);
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

function resumeAnimations(animations) {
  for (const animation of animations) {
    try {
      if (animation.playState !== "finished") animation.play();
    } catch {
      // The source node may have disappeared while the effect was running.
    }
  }
}

function createNonContactSuperCharge(card) {
  const rect = card.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const charge = document.createElement("div");
  charge.className = "noncontact-super-charge";
  charge.setAttribute("aria-hidden", "true");
  charge.style.left = `${rect.left + rect.width / 2}px`;
  charge.style.top = `${rect.top + rect.height / 2}px`;
  charge.style.setProperty("--noncontact-super-charge-ms", `${NONCONTACT_SUPER_CHARGE_MS}ms`);

  const rays = Array.from({ length: 18 }, (_, index) => {
    const angle = index * 20 + (index % 2 ? 7 : -4);
    const distance = 88 + (index % 5) * 11;
    const delay = (index % 6) * 18;
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

  // main.js creates the focus and the WAAPI card motion in the same task. By the
  // time MutationObserver runs, both animations are available to freeze at t=0.
  const focus = [...document.querySelectorAll(".noncontact-cast-focus-super")].at(-1);
  const cardAnimations = pauseAtStart(card);
  const focusAnimations = pauseAtStart(focus);
  card.classList.add("noncontact-super-precharging");
  const charge = createNonContactSuperCharge(card);

  await new Promise((resolve) => setTimeout(resolve, NONCONTACT_SUPER_CHARGE_MS));

  charge?.remove();
  card.classList.remove("noncontact-super-precharging");
  resumeAnimations(focusAnimations);
  resumeAnimations(cardAnimations);
}

function handleNode(node) {
  if (!(node instanceof Element)) return;

  const candidates = [
    node,
    ...node.querySelectorAll(
      ".super-contact-attack-card, .super-contact-focus, .super-attack-charge, .noncontact-cast-card-super",
    ),
  ];
  for (const element of candidates) {
    if (element.matches(".super-contact-attack-card")) monitorContactSuper(element);
    else if (element.matches(".super-contact-focus, .super-attack-charge")) tuneAnimations(element);
    else if (element.matches(".noncontact-cast-card-super")) void prepareNonContactSuper(element);
  }
}

new MutationObserver((records) => {
  for (const record of records) record.addedNodes.forEach(handleNode);
}).observe(document.body, { childList: true, subtree: true });

// This deliberately controls only the extra super-attack tuning added here.
// A future effects menu can reuse the same storage key/data attribute while the
// rest of the game's effect switches are wired in.
window.HarmonySuperFxTuning = Object.freeze({
  storageKey: FX_STORAGE_KEY,
  isEnabled: effectsEnabled,
  setEnabled(enabled) {
    const value = enabled ? "on" : "off";
    document.documentElement.dataset.combatFx = value;
    try {
      localStorage.setItem(FX_STORAGE_KEY, value);
    } catch {
      // Keeping the in-page data attribute is enough for this session.
    }
  },
});
