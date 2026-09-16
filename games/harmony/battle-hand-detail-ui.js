export function createBattleHandDetailUi({
  documentRef = document,
  windowRef = window,
  requestFrame = requestAnimationFrame,
} = {}) {
  let detailState = null,
    bound = false;

  function hide() {
    if (!detailState) return;
    const { tooltip, placeholder } = detailState;
    tooltip.classList.remove("battle-card-effect-tooltip-portal");
    tooltip.style.removeProperty("--battle-detail-left");
    tooltip.style.removeProperty("--battle-detail-top");
    tooltip.style.removeProperty("--battle-detail-width");
    tooltip.style.removeProperty("--battle-detail-max-height");
    if (placeholder?.isConnected) placeholder.replaceWith(tooltip);
    else tooltip.remove();
    detailState = null;
  }

  function mount(card) {
    if (detailState?.card === card && detailState.tooltip.isConnected)
      return detailState.tooltip;
    hide();
    const tooltip = card.querySelector(".card-effect-tooltip");
    if (!tooltip) return null;
    const placeholder = documentRef.createComment("card-effect-tooltip");
    tooltip.before(placeholder);
    tooltip.classList.add("battle-card-effect-tooltip-portal");
    documentRef.body.append(tooltip);
    detailState = { card, tooltip, placeholder };
    return tooltip;
  }

  function position(card) {
    const battle = card.closest(".battle"),
      hand = card.closest(".hand");
    if (!battle || !hand) return;
    const tooltip = mount(card);
    if (!tooltip) return;

    const battleRect = battle.getBoundingClientRect(),
      handRect = hand.getBoundingClientRect(),
      cardRect = card.getBoundingClientRect(),
      viewportPadding = 10,
      panelWidth = Math.max(
        180,
        Math.min(
          430,
          battleRect.width - 20,
          windowRef.innerWidth - viewportPadding * 2,
        ),
      ),
      panelLeft = Math.min(
        windowRef.innerWidth - viewportPadding - panelWidth,
        Math.max(
          viewportPadding,
          cardRect.left + cardRect.width / 2 - panelWidth / 2,
        ),
      ),
      spaceAbove = Math.max(0, handRect.top - viewportPadding),
      spaceBelow = Math.max(
        0,
        windowRef.innerHeight - handRect.bottom - viewportPadding,
      ),
      panelMaxHeight = Math.min(
        210,
        Math.max(96, Math.max(spaceAbove, spaceBelow) - 10),
      );

    tooltip.style.setProperty("--battle-detail-left", `${Math.round(panelLeft)}px`);
    tooltip.style.setProperty("--battle-detail-width", `${Math.round(panelWidth)}px`);
    tooltip.style.setProperty(
      "--battle-detail-max-height",
      `${Math.round(panelMaxHeight)}px`,
    );

    requestFrame(() => {
      if (!detailState || detailState.card !== card || !card.isConnected) return;
      const panelHeight = Math.min(tooltip.scrollHeight, panelMaxHeight),
        canFitAbove = spaceAbove >= panelHeight + 10,
        desiredTop = canFitAbove
          ? handRect.top - panelHeight - 10
          : handRect.bottom + 10,
        panelTop = Math.max(
          viewportPadding,
          Math.min(
            desiredTop,
            windowRef.innerHeight - panelHeight - viewportPadding,
          ),
        );
      tooltip.style.setProperty("--battle-detail-top", `${Math.round(panelTop)}px`);
    });
  }

  function refresh() {
    const card = detailState?.card;
    if (!card?.isConnected) {
      hide();
      return;
    }
    if (card.matches(":hover") || card.matches(":focus, :focus-within")) position(card);
    else hide();
  }

  function onPointerOver(event) {
    const card = event.target?.closest?.(".battle > .hand .card");
    if (!card || card.contains(event.relatedTarget)) return;
    position(card);
  }

  function onPointerOut(event) {
    const card = event.target?.closest?.(".battle > .hand .card");
    if (!card || card.contains(event.relatedTarget)) return;
    requestFrame(() => {
      if (
        detailState?.card === card &&
        !card.matches(":hover, :focus, :focus-within")
      )
        hide();
    });
  }

  function onFocusIn(event) {
    const card = event.target?.closest?.(".battle > .hand .card");
    if (card) position(card);
  }

  function onFocusOut(event) {
    const card = event.target?.closest?.(".battle > .hand .card");
    if (!card) return;
    requestFrame(() => {
      if (detailState?.card === card && !card.matches(":hover, :focus-within"))
        hide();
    });
  }

  function bind() {
    if (bound) return;
    bound = true;
    documentRef.addEventListener("pointerover", onPointerOver);
    documentRef.addEventListener("pointerout", onPointerOut);
    documentRef.addEventListener("focusin", onFocusIn);
    documentRef.addEventListener("focusout", onFocusOut);
    windowRef.addEventListener("resize", refresh);
    documentRef.addEventListener("scroll", refresh, true);
  }

  return { bind, hide, position, refresh };
}
