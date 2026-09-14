// Let combat damage numbers escape the battle panel without changing battle scrolling.
//
// Desktop battle layout intentionally uses overflow-x:hidden / overflow-y:auto.
// Damage popups are created inside enemies or combat stat rows, so numbers near
// the panel edge can otherwise be clipped. Move only transient damage text to a
// fixed body-level presentation layer before the next paint. The original CSS
// classes and keyframe animations are preserved.

const FLOATING_DAMAGE_SELECTOR = [
  ".damage-pop",
  ".player-damage-pop",
  ".status-damage-pop",
].join(",");

const PORTAL_Z_INDEX = "2147483646";

function restoreInline(style, property, value) {
  if (value) style.setProperty(property, value);
  else style.removeProperty(property);
}

function portalDamagePopup(popup) {
  if (!(popup instanceof HTMLElement)) return;
  if (!popup.matches(FLOATING_DAMAGE_SELECTOR)) return;
  if (popup.dataset.combatFloatingTextPortal === "1") return;
  if (!popup.closest(".battle")) return;

  popup.dataset.combatFloatingTextPortal = "1";

  // Measure the popup's layout anchor without its transform animation. This
  // gives us the same intended origin it had inside the battle panel, while
  // avoiding an animation-frame-dependent jump when it is reparented.
  const previousAnimation = popup.style.animation,
    previousTransform = popup.style.transform,
    previousRotate = popup.style.rotate;

  popup.style.animation = "none";
  popup.style.transform = "none";
  popup.style.rotate = "0deg";

  const rect = popup.getBoundingClientRect();
  if (!rect.width && !rect.height) {
    restoreInline(popup.style, "animation", previousAnimation);
    restoreInline(popup.style, "transform", previousTransform);
    restoreInline(popup.style, "rotate", previousRotate);
    return;
  }

  Object.assign(popup.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    right: "auto",
    bottom: "auto",
    margin: "0",
    zIndex: PORTAL_Z_INDEX,
    pointerEvents: "none",
  });

  document.body.append(popup);

  // Commit the fixed anchor with animation disabled, then restart the original
  // class animation from that unclipped viewport-level position.
  void popup.offsetWidth;
  restoreInline(popup.style, "animation", previousAnimation);
  restoreInline(popup.style, "transform", previousTransform);
  restoreInline(popup.style, "rotate", previousRotate);
}

function inspectNode(node) {
  if (!(node instanceof Element)) return;
  if (node.matches(FLOATING_DAMAGE_SELECTOR)) portalDamagePopup(node);
  for (const popup of node.querySelectorAll(FLOATING_DAMAGE_SELECTOR))
    portalDamagePopup(popup);
}

new MutationObserver((records) => {
  for (const record of records)
    for (const node of record.addedNodes) inspectNode(node);
}).observe(document.body, { childList: true, subtree: true });
