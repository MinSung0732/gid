const DELIVERY_STYLES = new Set([
  "streak",
  "projectile",
  "beam",
  "pulse",
  "instant",
  "arc",
]);

const IMPACT_STYLES = new Set([
  "default",
  "arcane",
  "fire",
  "poison",
  "shock",
  "shadow",
  "physicalPulse",
]);

const DEFAULT_PRESENTATION = Object.freeze({
  delivery: "streak",
  impactStyle: "default",
  releaseDuration: 110,
  travelDuration: 150,
  impactDuration: 190,
  multiHitGap: 78,
});

function resolvePresentation(action = {}, reduced = false) {
  const configured = action?.presentation || {},
    delivery = DELIVERY_STYLES.has(configured.delivery)
      ? configured.delivery
      : DEFAULT_PRESENTATION.delivery,
    impactStyle = IMPACT_STYLES.has(configured.impactStyle)
      ? configured.impactStyle
      : DEFAULT_PRESENTATION.impactStyle;
  return {
    delivery,
    impactStyle,
    releaseDuration: reduced ? 70 : DEFAULT_PRESENTATION.releaseDuration,
    travelDuration: reduced
      ? delivery === "instant"
        ? 35
        : 80
      : delivery === "instant"
        ? 55
        : DEFAULT_PRESENTATION.travelDuration,
    impactDuration: reduced ? 130 : DEFAULT_PRESENTATION.impactDuration,
    multiHitGap: reduced ? 45 : DEFAULT_PRESENTATION.multiHitGap,
  };
}

export function createEnemyNonContactResolutionVfx({
  combatEffectsEnabled,
  enemyElement,
  effectsLayer,
  getPlayerImpactPoint,
  reducedCombatMotion,
}) {
  const activeNodes = new Set(),
    wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  function track(node, life) {
    if (!node) return null;
    activeNodes.add(node);
    effectsLayer().append(node);
    const cleanup = () => {
      activeNodes.delete(node);
      node.remove();
    };
    node.addEventListener("animationend", (event) => {
      if (event.target === node) cleanup();
    });
    window.setTimeout(cleanup, life + 120);
    return node;
  }

  function actorPoint(enemyIndex) {
    const actor = enemyElement(enemyIndex),
      visual = actor?.querySelector(".enemy-visual") || actor,
      rect = visual?.getBoundingClientRect();
    return rect?.width && rect?.height
      ? {
          x: rect.left + rect.width * 0.5,
          y: rect.top + rect.height * 0.48,
        }
      : null;
  }

  function makeNode(className, point, life, impactStyle) {
    if (!point) return null;
    const node = document.createElement("span");
    node.className = className;
    node.style.left = `${point.x}px`;
    node.style.top = `${point.y}px`;
    node.style.setProperty("--noncontact-resolution-life", `${life}ms`);
    node.style.setProperty("--noncontact-resolution-style", impactStyle);
    node.setAttribute("aria-hidden", "true");
    return node;
  }

  function showRelease(point, presentation) {
    const node = makeNode(
      `hmy-enemy-noncontact-release style-${presentation.impactStyle}`,
      point,
      presentation.releaseDuration,
      presentation.impactStyle,
    );
    if (!node) return;
    node.innerHTML =
      '<i class="hmy-noncontact-release-core"></i><i class="hmy-noncontact-release-ring"></i>';
    track(node, presentation.releaseDuration);
  }

  function showTravel(from, to, presentation, order = 0) {
    if (!from || !to) return;
    const deltaX = to.x - from.x,
      deltaY = to.y - from.y,
      distance = Math.hypot(deltaX, deltaY);
    if (distance < 1) return;
    const node = makeNode(
      `hmy-enemy-noncontact-travel delivery-${presentation.delivery} style-${presentation.impactStyle}`,
      from,
      presentation.travelDuration,
      presentation.impactStyle,
    );
    if (!node) return;
    node.style.setProperty("--noncontact-travel-distance", `${distance}px`);
    node.style.setProperty(
      "--noncontact-travel-angle",
      `${Math.atan2(deltaY, deltaX)}rad`,
    );
    node.style.setProperty("--noncontact-hit-order", String(order));
    node.innerHTML =
      '<i class="hmy-noncontact-travel-line"></i><i class="hmy-noncontact-travel-core"></i>';
    track(node, presentation.travelDuration);
  }

  function showImpact(point, presentation, hit = {}) {
    const blocked = Number(hit.blocked || 0) > 0,
      shieldBreak = Boolean(hit.shieldBreak),
      node = makeNode(
        `hmy-enemy-noncontact-impact style-${presentation.impactStyle}${blocked ? " is-blocked" : ""}${shieldBreak ? " is-shield-break" : ""}`,
        point,
        presentation.impactDuration,
        presentation.impactStyle,
      );
    if (!node) return;
    node.innerHTML =
      '<i class="hmy-noncontact-impact-flash"></i><i class="hmy-noncontact-impact-ring"></i><i class="hmy-noncontact-impact-core"></i>' +
      '<i class="hmy-noncontact-impact-spark spark-1"></i><i class="hmy-noncontact-impact-spark spark-2"></i><i class="hmy-noncontact-impact-spark spark-3"></i>';
    track(node, presentation.impactDuration);
  }

  async function showEnemyNonContactResolution({
    enemyIndex,
    action = null,
    hits = [],
    onImpact = null,
  } = {}) {
    if (!Array.isArray(hits) || !hits.length) return false;
    const reduced = reducedCombatMotion(),
      presentation = resolvePresentation(action, reduced),
      source = actorPoint(enemyIndex),
      target = getPlayerImpactPoint();

    if (!combatEffectsEnabled() || !source || !target) {
      hits.forEach((hit, index) => onImpact?.(hit, index, target));
      return false;
    }

    showRelease(source, presentation);
    await wait(presentation.releaseDuration);

    for (let index = 0; index < hits.length; index++) {
      const hit = hits[index];
      showTravel(source, target, presentation, index);
      await wait(presentation.travelDuration);
      showImpact(target, presentation, hit);
      onImpact?.(hit, index, target);
      if (index < hits.length - 1) await wait(presentation.multiHitGap);
    }

    return true;
  }

  function cleanupEnemyNonContactResolution() {
    for (const node of [...activeNodes]) node.remove();
    activeNodes.clear();
  }

  return {
    cleanupEnemyNonContactResolution,
    showEnemyNonContactResolution,
  };
}
