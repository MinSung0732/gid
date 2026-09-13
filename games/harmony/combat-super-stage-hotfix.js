const FX_STORAGE_KEY = "harmony_combat_fx";
const SUPER_NODE_SELECTOR = [
  ".super-contact-attack-card",
  ".strong-attack-focus.super-contact-focus",
  ".strong-attack-dimmer.super-contact-focus",
  ".super-attack-charge",
  ".noncontact-cast-card-super",
  ".noncontact-super-charge",
].join(", ");

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

function currentSuperNode() {
  return document.querySelector(
    ".super-contact-attack-card, .noncontact-cast-card-super, .super-attack-charge, .strong-attack-focus.super-contact-focus, .noncontact-super-charge",
  );
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
  if (!stage?.isConnected || !battle) return false;

  const battleRect = battle.getBoundingClientRect();
  if (!battleRect.width || !battleRect.height) return false;

  let sourceRect = source?.getBoundingClientRect?.();
  if (!sourceRect?.width || !sourceRect?.height) {
    sourceRect = {
      left: battleRect.left + battleRect.width / 2,
      top: battleRect.top + battleRect.height * 0.72,
      width: 0,
      height: 0,
    };
  }

  const originX = Math.max(
    0,
    Math.min(
      battleRect.width,
      sourceRect.left + sourceRect.width / 2 - battleRect.left,
    ),
  );
  const originY = Math.max(
    0,
    Math.min(
      battleRect.height,
      sourceRect.top + sourceRect.height / 2 - battleRect.top,
    ),
  );

  stage.style.left = `${battleRect.left}px`;
  stage.style.top = `${battleRect.top}px`;
  stage.style.width = `${battleRect.width}px`;
  stage.style.height = `${battleRect.height}px`;
  stage.style.setProperty("--hard-super-origin-x", `${originX}px`);
  stage.style.setProperty("--hard-super-origin-y", `${originY}px`);
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
    syncStage(activeStage, source);
    return;
  }

  const stage = document.createElement("div");
  const flavor = flavorFor(source);
  stage.className = `super-fx-hard-dimmer super-fx-hard-dimmer-${flavor}`;
  stage.setAttribute("aria-hidden", "true");
  document.body.append(stage);
  activeStage = stage;

  if (!syncStage(stage, source)) {
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

document.documentElement.dataset.superStageHotfix = "1";
