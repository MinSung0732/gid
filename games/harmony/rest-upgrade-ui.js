export function createRestUpgradeUi({
  engine,
  cards,
  getRun,
  cardHtml,
  presentationCardHtml,
  cardEffectText,
}) {
  const $ = (id) => document.getElementById(id);

  function highlightUpgradeDetailValues(beforeText, afterText) {
    const beforeValues = beforeText.match(/[+-]?\d+(?:\.\d+)?%?/g) || [];
    let valueIndex = 0;
    return afterText.replace(/[+-]?\d+(?:\.\d+)?%?/g, (value) => {
      const changed = beforeValues[valueIndex] !== value;
      valueIndex += 1;
      return changed
        ? `<mark class="rest-upgrade-value-changed">${value}</mark>`
        : value;
    });
  }

  function comparisonMarkup(index) {
    const run = getRun(),
      card = run?.phase === "rest" && run.restMode === "upgrade" ? run.deck[index] : null;
    if (!card || run.restResult || card.level >= engine.cardMaxUpgrade(card)) return "";
    const before = { ...card },
      after = { ...card, level: card.level + 1 },
      definition = cards[card.id],
      beforeDetail = cardEffectText(before, true),
      afterDetail = highlightUpgradeDetailValues(
        beforeDetail,
        cardEffectText(after, true),
      );
    return `<div class="rest-upgrade-comparison-head"><span>강화 미리보기</span><strong>${definition.name}</strong></div><div class="rest-upgrade-card-pair"><article><small>강화 전 · +${before.level}</small>${presentationCardHtml(before)}</article><span class="rest-upgrade-arrow" aria-hidden="true">→</span><article class="rest-upgrade-after"><small>강화 후 · +${after.level}</small>${presentationCardHtml(after, before)}</article></div><div class="rest-upgrade-detail-pair"><article><strong>강화 전 자세한 효과</strong><p>${beforeDetail}</p></article><article><strong>강화 후 자세한 효과</strong><p>${afterDetail}</p></article></div>`;
  }

  function upgradeSuccess(run) {
    const result = run.restResult,
      upgraded =
        run.deck[result.index]?.id === result.cardId
          ? run.deck[result.index]
          : { id: result.cardId, level: result.level },
      definition = cards[result.cardId];
    return `<section class="room rest-room rest-upgrade-success"><p class="eyebrow">UPGRADE COMPLETE</p><h1>강화 성공!</h1><p><b>${definition.name}</b> 카드가 +${result.previousLevel}에서 +${result.level} 단계로 강화되었습니다.</p><div class="rest-upgrade-success-card"><span class="rest-upgrade-success-glow" aria-hidden="true"></span><span class="rest-upgrade-success-sparks" aria-hidden="true">${"<i></i>".repeat(12)}</span>${presentationCardHtml(upgraded)}</div><div class="rest-upgrade-success-detail"><strong>강화된 효과</strong><p>${cardEffectText(upgraded, true)}</p></div><button class="primary rest-upgrade-continue" data-action="rest-leave">다음으로 진행하기 →</button></section>`;
  }

  function upgradeChoice(card, index) {
    const definition = cards[card.id],
      nextLevel = Math.min(engine.cardMaxUpgrade(card), card.level + 1),
      interaction = {
        action: "upgrade",
        card: card.id,
        index,
        className: "rest-upgrade-card",
        ariaLabel: `${definition.name} +${nextLevel} 강화`,
      };
    return `<article class="rest-upgrade-option">${cardHtml(card, null, interaction)}<button class="rest-upgrade-button" data-action="upgrade" data-index="${index}">강화 +${card.level} → +${nextLevel}</button></article>`;
  }

  function actionChoice(run) {
    const choices = engine.restCardChoices(run),
      fullHealth = run.hp >= run.maxHp,
      healAmount = engine.restHealAmount(run),
      noUpgrade = choices.length === 0;
    return `<section class="room rest-room rest-action-choice"><p class="eyebrow">REST SITE</p><h1>잠시 쉬어갑니다</h1><p>이번 휴식처에서 할 행동을 하나 선택하세요.</p><div class="rest-action-options"><article class="rest-action-option${fullHealth ? " is-disabled" : ""}"><button class="primary rest-action-button rest-heal-button" data-action="rest-heal" ${fullHealth ? "disabled" : ""}><strong>휴식하기</strong><small>${fullHealth ? "체력이 이미 가득 찼습니다" : `체력 ${healAmount} 회복`}</small></button><p>체력을 회복하고 휴식처를 마칩니다.</p></article><article class="rest-action-option${noUpgrade ? " is-disabled" : ""}"><button class="rest-action-button rest-upgrade-open-button" data-action="rest-upgrade-open" ${noUpgrade ? "disabled" : ""}><strong>강화하기</strong><small>${noUpgrade ? "강화할 수 있는 카드가 없습니다" : "카드 1장을 영구 강화"}</small></button><p>${noUpgrade ? "강화할 수 있는 카드가 없습니다." : "강화할 카드 선택 화면으로 이동합니다."}</p></article></div></section>`;
  }

  function upgradeSelect(run) {
    const choices = engine.restCardChoices(run);
    return `<section class="room rest-room rest-upgrade-select"><p class="eyebrow">REST SITE · UPGRADE</p><h1>강화할 카드를 선택하세요</h1><p>아직 강화가 적용되지 않았습니다. 돌아가면 휴식을 선택할 수 있습니다.</p><button class="rest-upgrade-back" data-action="rest-upgrade-back">← 휴식/강화 선택으로 돌아가기</button><div class="choices rest-card-choices">${choices.map((index) => upgradeChoice(run.deck[index], index)).join("") || '<p class="hint">강화할 수 있는 카드가 없습니다.</p>'}</div><aside id="rest-upgrade-comparison" class="rest-upgrade-comparison" aria-hidden="true"></aside></section>`;
  }

  function restRoom() {
    const run = getRun();
    if (!run) return "";
    if (run.restResult?.type === "upgrade") return upgradeSuccess(run);
    return run.restMode === "upgrade" ? upgradeSelect(run) : actionChoice(run);
  }

  function previewTarget(target) {
    return target?.closest?.(".rest-upgrade-card, .rest-upgrade-button") || null;
  }

  function showRestUpgradeComparison(target) {
    const targetCard = previewTarget(target),
      panel = $("rest-upgrade-comparison"),
      index = Number(targetCard?.dataset.index);
    if (!panel || !Number.isInteger(index)) return;
    const markup = comparisonMarkup(index);
    if (!markup) return;
    panel.innerHTML = markup;
    panel.classList.add("visible");
    panel.setAttribute("aria-hidden", "false");
  }

  function hideRestUpgradeComparison(target = null) {
    const panel = $("rest-upgrade-comparison");
    if (
      !panel ||
      target?.closest?.(".rest-upgrade-option, .rest-upgrade-comparison")
    )
      return;
    panel.classList.remove("visible");
    panel.setAttribute("aria-hidden", "true");
  }

  function bindRestUpgradeComparison(app) {
    app.addEventListener("pointerover", (event) => {
      const target = previewTarget(event.target);
      if (target && !target.contains(event.relatedTarget))
        showRestUpgradeComparison(target);
    });
    app.addEventListener("pointerout", (event) => {
      const target = previewTarget(event.target);
      if (target && !target.contains(event.relatedTarget))
        hideRestUpgradeComparison(event.relatedTarget);
      else if (
        event.target.closest?.(".rest-upgrade-comparison") &&
        !event.relatedTarget?.closest?.(".rest-upgrade-comparison")
      )
        hideRestUpgradeComparison(event.relatedTarget);
    });
    app.addEventListener("focusin", (event) => {
      if (previewTarget(event.target)) showRestUpgradeComparison(event.target);
    });
    app.addEventListener("focusout", (event) => {
      if (previewTarget(event.target))
        hideRestUpgradeComparison(event.relatedTarget);
    });
  }

  return {
    bindRestUpgradeComparison,
    hideRestUpgradeComparison,
    restRoom,
  };
}
