const FX_STORAGE_KEY = "harmony_combat_fx";
const SUPER_NODE_SELECTOR = [
  ".super-contact-attack-card",
  ".strong-attack-focus.super-contact-focus",
  ".strong-attack-dimmer.super-contact-focus",
  ".super-attack-charge",
  ".noncontact-cast-card-super",
  ".noncontact-super-charge",
].join(", ");
const SUPER_CARD_SELECTORS = [
  ".super-contact-attack-card",
  ".noncontact-cast-card-super",
];
const SUPER_FALLBACK_SELECTORS = [
  ".noncontact-super-charge",
  ".super-attack-charge",
  ".strong-attack-focus.super-contact-focus",
  ".strong-attack-dimmer.super-contact-focus",
];

let activeStage = null;

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

function firstConnected(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element?.isConnected) return element;
  }
  return null;
}

function currentSuperNode() {
  // Always prefer the actual animated card. The previous generic query could
  // accidentally pick the giant charge/focus graphic first, which made the
  // blackout cover the card instead of cutting a window around it.
  return firstConnected(SUPER_CARD_SELECTORS) || firstConnected(SUPER_FALLBACK_SELECTORS);
}

function flavorFor(node) {
  return node?.matches(
    ".noncontact-cast-card-super, .noncontact-super-charge",
  )
    ? "noncontact"
    : "contact";
}

function syncStage(stage, source) {
  const battle = document.querySelector(".battle");
  const windowElement = stage?.querySelector(".super-fx-hard-window");
  if (!stage?.isConnected || !battle || !windowElement) return false;

  const battleRect = battle.getBoundingClientRect();
  if (!battleRect.width || !battleRect.height) return false;

  let sourceRect = source?.getBoundingClientRect?.();
  if (!sourceRect?.width || !sourceRect?.height) {
    sourceRect = {
      left: battleRect.left + battleRect.width / 2 - 70,
      top: battleRect.top + battleRect.height * 0.7 - 100,
      width: 140,
      height: 200,
    };
  }

  const padding = source?.matches?.(SUPER_CARD_SELECTORS.join(", ")) ? 10 : 6;
  const rawLeft = sourceRect.left - battleRect.left - padding;
  const rawTop = sourceRect.top - battleRect.top - padding;
  const left = Math.max(0, Math.min(battleRect.width, rawLeft));
  const top = Math.max(0, Math.min(battleRect.height, rawTop));
  const right = Math.max(
    left,
    Math.min(
      battleRect.width,
      sourceRect.right - battleRect.left + padding,
    ),
  );
  const bottom = Math.max(
    top,
    Math.min(
      battleRect.height,
      sourceRect.bottom - battleRect.top + padding,
    ),
  );
  const width = Math.max(8, right - left);
  const height = Math.max(8, bottom - top);
  const originX = left + width / 2;
  const originY = top + height / 2;

  stage.style.left = `${battleRect.left}px`;
  stage.style.top = `${battleRect.top}px`;
  stage.style.width = `${battleRect.width}px`;
  stage.style.height = `${battleRect.height}px`;
  stage.style.setProperty("--hard-super-origin-x", `${originX}px`);
  stage.style.setProperty("--hard-super-origin-y", `${originY}px`);

  windowElement.style.left = `${left}px`;
  windowElement.style.top = `${top}px`;
  windowElement.style.width = `${width}px`;
  windowElement.style.height = `${height}px`;
  return true;
}

function stopStage() {
  if (!activeStage) return;
  const stage = activeStage;
  activeStage = null;
  stage.classList.add("is-releasing");
  window.setTimeout(() => stage.remove(), 260);
}

function stageFrame() {
  if (!activeStage) return;
  if (!effectsEnabled()) {
    stopStage();
    return;
  }

  const source = currentSuperNode();
  if (!source) {
    stopStage();
    return;
  }

  const flavor = flavorFor(source);
  activeStage.classList.toggle("super-fx-hard-dimmer-contact", flavor === "contact");
  activeStage.classList.toggle(
    "super-fx-hard-dimmer-noncontact",
    flavor === "noncontact",
  );
  syncStage(activeStage, source);
  requestAnimationFrame(stageFrame);
}

function startStage(source) {
  if (!effectsEnabled()) return;

  if (activeStage?.isConnected) {
    syncStage(activeStage, currentSuperNode() || source);
    return;
  }

  const stage = document.createElement("div");
  const flavor = flavorFor(source);
  stage.className = `super-fx-hard-dimmer super-fx-hard-dimmer-${flavor}`;
  stage.setAttribute("aria-hidden", "true");
  stage.innerHTML = '<span class="super-fx-hard-window"></span>';
  document.body.append(stage);
  activeStage = stage;

  if (!syncStage(stage, currentSuperNode() || source)) {
    stopStage();
    return;
  }

  requestAnimationFrame(stageFrame);
}

function inspect(node) {
  if (!(node instanceof Element)) return;

  if (node.matches(SUPER_NODE_SELECTOR)) startStage(node);
  const nested = node.querySelector(SUPER_NODE_SELECTOR);
  if (nested) startStage(nested);
}

new MutationObserver((records) => {
  for (const record of records) {
    if (record.type === "attributes") inspect(record.target);
    else record.addedNodes.forEach(inspect);
  }
}).observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class"],
});

inspect(document.body);

document.documentElement.dataset.superStageHotfix = "2";
