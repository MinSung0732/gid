import { CARDS, ITEMS } from "./data.js?v=20260917-2";

export function createRewardUi({
  getRun,
  currentRewardOffer,
  power,
  cardHtml,
  itemHtml,
  formatNumber,
}) {
  const number = formatNumber;

  function rewardSourceLabel(source) {
    return {
      combat: "전투 보상",
      gather: "채집 보상",
      golden: "황금 보물",
      elite: "엘리트 보상",
      boss: "보스 보상",
      signatureBoss: "Signature 보상",
      treasureEvent: "이벤트 보상",
      curseEvent: "계약 보상",
    }[source] || "보상";
  }

  function rewardOptionMarkup(option) {
    if (option.type === "card" && CARDS[option.id])
      return `<article class="reward-offer-option reward-offer-card">${cardHtml({ id: option.id, level: 0 }, null, {
        action: "reward-claim",
        card: option.id,
        optionId: option.optionId,
        className: "reward-select-card",
        ariaLabel: `${CARDS[option.id].name} 카드 획득`,
      })}<button data-action="reward-claim" data-option="${option.optionId}" data-card="${option.id}">이 카드 획득</button></article>`;
    if (option.type === "item" && ITEMS[option.id])
      return `<article class="reward-offer-option reward-item reward-tier-${ITEMS[option.id].tier}">${itemHtml(option.id)}<button data-action="reward-claim" data-option="${option.optionId}">보상 획득</button></article>`;
    if (option.type === "gold")
      return `<article class="reward-offer-option reward-gold-option"><span aria-hidden="true">●</span><strong>${number(option.amount || 0)}G</strong><small>대체 보상</small><button data-action="reward-claim" data-option="${option.optionId}">골드 획득</button></article>`;
    return "";
  }

  function rewardRoom() {
    const run = getRun(),
      reward = run?.reward,
      offer = run ? currentRewardOffer(run) : null;
    if (!reward || !offer)
      return `<section class="room"><p class="eyebrow">DISCOVERY</p><h1>보상 정리 중</h1><p>완료된 보상을 정리하고 다음 방으로 이동합니다.</p></section>`;
    const options = (offer.options || []).filter((option) => !option.claimed),
      battleCardProgress = reward.metadata?.battleCardReward,
      totalGroups = battleCardProgress?.totalGroups || reward.groups?.length || 1,
      currentGroup = battleCardProgress
        ? Math.min(
            totalGroups,
            Math.max(
              1,
              Number(offer.metadata?.groupIndex) || Number(battleCardProgress.generatedGroups) || 1,
            ),
          )
        : Math.min(totalGroups, (reward.activeGroupIndex || 0) + 1),
      canPickMore = offer.remainingPicks > 0,
      eventText = reward.metadata?.eventText,
      groupProgress = totalGroups > 1 ? `<small class="reward-group-progress">보상 그룹 ${currentGroup} / ${totalGroups}</small>` : "",
      remaining = canPickMore
        ? `<p class="reward-pick-copy">후보 ${options.length}개 · 최대 <b>${offer.remainingPicks}개</b> 더 획득할 수 있습니다. 원하는 만큼만 받고 나머지는 포기할 수 있습니다.</p>`
        : "",
      goldCopy = reward.gold > 0
        ? `<p class="reward-base-gold">기본 골드 보상 <b>${number(reward.gold)}G</b>${!reward.goldIncludesBonus && power(run, "goldBonus") ? ` · 보너스 +${power(run, "goldBonus")}G` : ""}</p>`
        : "";
    return `<section class="room reward-room"><p class="eyebrow">${rewardSourceLabel(offer.source).toUpperCase()}</p>${groupProgress}<h1>${eventText ? "결과를 확인하세요" : "원하는 보상을 선택하세요"}</h1>${eventText ? `<p class="reward-event-copy">${eventText}</p>` : ""}${goldCopy}${remaining}<div class="choices reward-offer-options${offer.rewardPool === "active" ? " card-reward-choices" : ""}">${options.map(rewardOptionMarkup).join("") || '<p class="hint">획득 가능한 후보가 없습니다.</p>'}</div>${offer.allowSkip ? `<button class="primary reward-skip-button" data-action="reward-skip">${offer.claimedOptionIds?.length ? "남은 보상 포기하고 진행 →" : "받지 않고 진행 →"}</button>` : ""}</section>`;
  }

  return { rewardRoom };
}
