const MIRROR_RELIC_ID = "relic_mirror_of_duplication";

export function createRoomRelicPresentation({ cards, items, presentationCardHtml }) {
  let cleanupTimer = 0;

  function clearRoomRelicPresentation() {
    window.clearTimeout(cleanupTimer);
    document
      .querySelectorAll(".room-relic-vfx-host,.room-relic-result-strip")
      .forEach((node) => node.remove());
  }

  function presentationCard(card, className) {
    if (!card || typeof presentationCardHtml !== "function") return null;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = presentationCardHtml(card);
    const element = wrapper.firstElementChild;
    if (!element) return null;
    element.classList.add(className);
    element.removeAttribute("data-action");
    element.removeAttribute("data-index");
    element.removeAttribute("aria-disabled");
    element.tabIndex = -1;
    element.setAttribute("aria-hidden", "true");
    return element;
  }

  function showRoomRelicTrigger({ relic, signature, result }) {
    if (!relic || !signature || !result?.card || !result.label) return false;
    const room = document.querySelector(".play-content .room"),
      decision = room?.querySelector("button.primary[data-action]");
    if (!room || !decision) return false;

    clearRoomRelicPresentation();
    const host = document.createElement("div"),
      strip = document.createElement("aside"),
      roomRect = room.getBoundingClientRect(),
      decisionRect = decision.getBoundingClientRect(),
      availableTop = Math.max(86, decisionRect.top - roomRect.top - 210);

    host.className = `room-relic-vfx-host room-relic-vfx-${signature}`;
    host.setAttribute("role", "status");
    host.setAttribute("aria-label", `${relic.name} 발동. ${result.label} 카드 1장 복제.`);
    host.style.setProperty("--room-relic-top", `${Math.round(availableTop)}px`);

    const trigger = document.createElement("div"),
      stage = document.createElement("div"),
      scan = document.createElement("span"),
      bloom = document.createElement("span"),
      original = presentationCard(result.card, "room-relic-card-original"),
      reflection = presentationCard(result.card, "room-relic-card-reflection"),
      duplicate = presentationCard(result.card, "room-relic-card-duplicate"),
      resultText = document.createElement("strong");
    if (!original || !reflection || !duplicate) return false;

    trigger.className = "room-relic-trigger-label";
    trigger.innerHTML = `<span aria-hidden="true">◇</span><b>${relic.name}</b><small>RELIC TRIGGER</small>`;
    stage.className = "room-relic-mirror-stage";
    scan.className = "room-relic-mirror-scan";
    bloom.className = "room-relic-mirror-bloom";
    resultText.className = "room-relic-result-text";
    resultText.textContent = `${result.label} +1`;
    stage.append(original, reflection, scan, bloom, duplicate, resultText);
    host.append(trigger, stage);

    strip.className = "room-relic-result-strip";
    strip.setAttribute("role", "status");
    strip.innerHTML = `<span aria-hidden="true">◇</span><small>${relic.name}</small><strong>${result.label} +1</strong>`;

    room.append(host, strip);
    window.setTimeout(() => host.remove(), 920);
    cleanupTimer = window.setTimeout(() => strip.remove(), 3800);
    return true;
  }

  function showRoomRelicFeedback(feedback) {
    if (
      feedback?.type !== "cardDuplicate" ||
      feedback.relicId !== MIRROR_RELIC_ID ||
      !feedback.card?.id ||
      !cards[feedback.card.id]
    ) return false;
    const relic = items[feedback.relicId];
    if (!relic) return false;
    const level = Math.max(0, Number(feedback.card.level) || 0),
      label = `${cards[feedback.card.id].name}${level ? ` +${level}` : ""}`;
    return showRoomRelicTrigger({
      relic,
      signature: "mirror-duplicate",
      result: { card: feedback.card, label },
    });
  }

  return {
    show: showRoomRelicFeedback,
    clear: clearRoomRelicPresentation,
    showRoomRelicTrigger,
  };
}
