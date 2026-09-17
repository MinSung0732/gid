const FX_STORAGE_KEY = "harmony_combat_fx";
const SUPER_NODE_SELECTOR = [
  ".super-contact-attack-card",
  ".strong-attack-focus.super-contact-focus",
  ".strong-attack-dimmer.super-contact-focus",
  ".super-attack-charge",
  ".noncontact-cast-card-super",
  ".noncontact-super-charge",
].join(", ");
const PLAYER_CONTACT_SUPER_SELECTOR = ".super-contact-attack-card";
const NONCONTACT_SUPER_CARD_SELECTOR = ".noncontact-cast-card-super";
const ENEMY_CONTACT_SOURCE_SELECTOR = ".enemy-contact-source";
const ENEMY_CONTACT_CHARGE_SELECTOR = ".super-attack-charge-enemy";
const SUPER_CARD_SELECTORS = [
  PLAYER_CONTACT_SUPER_SELECTOR,
  NONCONTACT_SUPER_CARD_SELECTOR,
];
const SAFE_SUPER_FALLBACK_SELECTORS = [
  ".noncontact-super-charge",
  ".super-attack-charge",
  ".strong-attack-focus.super-contact-focus",
  ".strong-attack-dimmer.super-contact-focus",
];

let activeStage = null;
let lastEnemyActorRect = null;

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

function snapshotRect(rect) {
  if (!rect?.width || !rect?.height) return null;
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right ?? rect.left + rect.width,
    bottom: rect.bottom ?? rect.top + rect.height,
    width: rect.width,
    height: rect.height,
  };
}

function activeEnemyContactSource() {
  return firstConnected([ENEMY_CONTACT_SOURCE_SELECTOR]);
}

function enemyContactSuperIsActive() {
  return Boolean(firstConnected([ENEMY_CONTACT_CHARGE_SELECTOR]));
}

function enemyChargeSize(actorRect, battleRect) {
  const actorSpan = Math.max(actorRect?.width || 0, actorRect?.height || 0);
  const desired = Math.max(260, Math.min(320, actorSpan + 120));
  const shortBattleAxis = Math.min(battleRect?.width || 0, battleRect?.height || 0);
  const responsiveCap = shortBattleAxis ? Math.max(180, shortBattleAxis * .58) : 300;
  return Math.round(Math.min(desired, responsiveCap));
}

function markEnemyContactCharge(charge) {
  if (!charge?.matches?.(".super-attack-charge")) return;
  if (charge.classList.contains("super-attack-charge-enemy")) return;
  const actor = activeEnemyContactSource();
  if (!actor) return;
  const actorRect = snapshotRect(actor.getBoundingClientRect());
  const battleRect = snapshotRect(document.querySelector(".battle")?.getBoundingClientRect?.());
  if (!actorRect) return;

  const size = enemyChargeSize(actorRect, battleRect);
  const rayScale = Math.max(.58, Math.min(1, size / 300));
  charge.classList.add("super-attack-charge-enemy");
  charge.style.setProperty("--enemy-super-charge-size", `${size}px`);
  charge.querySelectorAll("i").forEach((ray) => {
    const distance = Number.parseFloat(ray.style.getPropertyValue("--charge-distance"));
    const length = Number.parseFloat(ray.style.getPropertyValue("--charge-length"));
    if (Number.isFinite(distance))
      ray.style.setProperty("--charge-distance", `${Math.round(distance * .5 * rayScale)}px`);
    if (Number.isFinite(length))
      ray.style.setProperty("--charge-length", `${Math.round(length * .62 * rayScale)}px`);
  });
}

function currentSuperSpotlightSource() {
  const playerContactCard = firstConnected([PLAYER_CONTACT_SUPER_SELECTOR]);
  if (playerContactCard) return playerContactCard;

  if (enemyContactSuperIsActive()) {
    const enemyActor = activeEnemyContactSource();
    if (enemyActor) return enemyActor;
    return firstConnected([ENEMY_CONTACT_CHARGE_SELECTOR]);
  }

  const nonContactCard = firstConnected([NONCONTACT_SUPER_CARD_SELECTOR]);
  if (nonContactCard) return nonContactCard;
  return firstConnected(SAFE_SUPER_FALLBACK_SELECTORS);
}

function flavorFor(node) {
  return node?.matches(
    ".noncontact-cast-card-super, .noncontact-super-charge",
  )
    ? "noncontact"
    : "contact";
}

function safeDecorativeRect(sourceRect, battleRect) {
  if (!sourceRect?.width || !sourceRect?.height) return null;
  const width = Math.min(180, Math.max(120, battleRect.width * .3));
  const height = Math.min(200, Math.max(140, battleRect.height * .34));
  const centerX = sourceRect.left + sourceRect.width / 2;
  const centerY = sourceRect.top + sourceRect.height / 2;
  return {
    left: centerX - width / 2,
    top: centerY - height / 2,
    right: centerX + width / 2,
    bottom: centerY + height / 2,
    width,
    height,
  };
}

function spotlightRect(source, battleRect) {
  const sourceRect = snapshotRect(source?.getBoundingClientRect?.());
  if (source?.matches?.(ENEMY_CONTACT_SOURCE_SELECTOR) && sourceRect) {
    lastEnemyActorRect = sourceRect;
    return sourceRect;
  }
  if (source?.matches?.(ENEMY_CONTACT_CHARGE_SELECTOR)) {
    return lastEnemyActorRect || safeDecorativeRect(sourceRect, battleRect);
  }
  if (source?.matches?.(".super-attack-charge")) {
    return safeDecorativeRect(sourceRect, battleRect);
  }
  return sourceRect;
}

function syncStage(stage, source) {
  const battle = document.querySelector(".battle");
  const windowElement = stage?.querySelector(".super-fx-hard-window");
  if (!stage?.isConnected || !battle || !windowElement) return false;

  const battleRect = snapshotRect(battle.getBoundingClientRect());
  if (!battleRect) return false;

  let sourceRect = spotlightRect(source, battleRect);
  if (!sourceRect) {
    sourceRect = {
      left: battleRect.left + battleRect.width / 2 - 70,
      top: battleRect.top + battleRect.height * .7 - 100,
      right: battleRect.left + battleRect.width / 2 + 70,
      bottom: battleRect.top + battleRect.height * .7 + 100,
      width: 140,
      height: 200,
    };
  }

  const enemyActorSource = source?.matches?.(
    `${ENEMY_CONTACT_SOURCE_SELECTOR}, ${ENEMY_CONTACT_CHARGE_SELECTOR}`,
  );
  const padding = enemyActorSource
    ? 26
    : source?.matches?.(SUPER_CARD_SELECTORS.join(", "))
      ? 10
      : 8;
  const rawLeft = sourceRect.left - battleRect.left - padding;
  const rawTop = sourceRect.top - battleRect.top - padding;
  const left = Math.max(0, Math.min(battleRect.width, rawLeft));
  const top = Math.max(0, Math.min(battleRect.height, rawTop));
  const right = Math.max(
    left,
    Math.min(battleRect.width, sourceRect.right - battleRect.left + padding),
  );
  const bottom = Math.max(
    top,
    Math.min(battleRect.height, sourceRect.bottom - battleRect.top + padding),
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
  lastEnemyActorRect = null;
  stage.classList.add("is-releasing");
  window.setTimeout(() => stage.remove(), 260);
}

function stageFrame() {
  if (!activeStage) return;
  if (!effectsEnabled()) {
    stopStage();
    return;
  }

  const source = currentSuperSpotlightSource();
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
    syncStage(activeStage, currentSuperSpotlightSource() || source);
    return;
  }

  lastEnemyActorRect = null;
  const stage = document.createElement("div");
  const flavor = flavorFor(source);
  stage.className = `super-fx-hard-dimmer super-fx-hard-dimmer-${flavor}`;
  stage.setAttribute("aria-hidden", "true");
  stage.innerHTML = '<span class="super-fx-hard-window"></span>';
  document.body.append(stage);
  activeStage = stage;

  if (!syncStage(stage, currentSuperSpotlightSource() || source)) {
    stopStage();
    return;
  }

  requestAnimationFrame(stageFrame);
}

function inspect(node) {
  if (!(node instanceof Element)) return;

  if (node.matches(".super-attack-charge")) markEnemyContactCharge(node);
  node.querySelectorAll(".super-attack-charge").forEach(markEnemyContactCharge);

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

document.documentElement.dataset.superStageHotfix = "3";
