import { DECK_BALANCE, ECONOMY_BALANCE } from "./editor/index.js";

const SPECIAL_DECK_PICKER_CONFIG = Object.freeze({
  note: {
    eyebrow: "OLFACTORY LAB",
    title: "노트 치환 · 내 덱",
    description: "카드를 고른 뒤 TOP · MIDDLE · BASE 중 새 노트를 선택하세요.",
  },
  remove: {
    eyebrow: "OLFACTORY LAB",
    title: "용매 세척",
    description: "골드를 사용해 선택한 카드 1장을 덱에서 영구 제거합니다.",
  },
  cleanse_card: {
    eyebrow: "BLOOD ALTAR",
    title: "카드 1장 무료 소각",
    description: "소각할 카드 1장을 선택하세요. 선택한 카드는 덱에서 영구 소멸합니다.",
  },
  duplicate: {
    eyebrow: "MIRROR DOPPELGANGER",
    title: "카드 복제",
    description: "복제 비용은 카드 티어에 따라 달라집니다. 비용을 확인한 뒤 복제할 카드를 선택하세요.",
  },
});

export function createSpecialDeckPickerUi({
  engine,
  cards,
  getRun,
  getMeta,
  getCardAnimating,
  presentationCardHtml,
  save,
  render,
}) {
  let mode = null;
  const $ = (id) => document.getElementById(id);
  const labRemovePrice = (run) =>
    Math.max(0, ECONOMY_BALANCE.labRemoveBasePrice - engine.power(run, "labCostDiscount"));

  function pickerDialog() {
    let dialog = $("special-deck-picker");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "special-deck-picker";
    dialog.className = "special-deck-picker-dialog";
    dialog.innerHTML = `<div class="dialog-head"><div><small id="special-deck-picker-eyebrow">DECK CHOICE</small><h2 id="special-deck-picker-title">내 덱 보기</h2></div><button data-special-deck-picker-close>닫기</button></div><p id="special-deck-picker-description" class="special-deck-picker-description"></p><div id="special-deck-picker-grid" class="special-deck-picker-grid"></div>`;
    document.body.append(dialog);
    dialog.addEventListener("click", (event) => {
      if (event.target.closest("[data-special-deck-picker-close]")) {
        dialog.close();
        return;
      }
      const button = event.target.closest("[data-special-deck-action]"),
        run = getRun();
      if (!button || !run || !mode) return;
      const index = Number(button.dataset.index),
        action = button.dataset.specialDeckAction,
        meta = getMeta();
      if (!Number.isInteger(index) || !run.deck[index]) return;
      if (action === "note")
        engine.chooseSpecial(run, "note", meta, index, button.dataset.note);
      else engine.chooseSpecial(run, action, meta, index);
      engine.checkUnlocks(run, meta);
      save();
      dialog.close();
      render();
    });
    dialog.addEventListener("close", () => {
      mode = null;
    });
    return dialog;
  }

  function pickerActions(pickerMode, card, index) {
    const run = getRun();
    if (!run) return "";
    const removePrice = labRemovePrice(run);
    if (pickerMode === "note") {
      const currentNote = card.note || cards[card.id].note;
      return ["top", "middle", "base"]
        .map(
          (note) =>
            `<button data-special-deck-action="note" data-index="${index}" data-note="${note}" class="${currentNote === note ? "current" : ""}">${note.toUpperCase()}</button>`,
        )
        .join("");
    }
    const duplicateTier = cards[card.id]?.tier || 1,
      duplicateSlots = duplicateTier === 3 ? 2 : 1,
      blocked =
        pickerMode === "remove"
          ? run.gold < removePrice || run.deck.length <= DECK_BALANCE.minimumSize
          : pickerMode === "cleanse_card"
            ? run.deck.length <= DECK_BALANCE.minimumSize
            : pickerMode === "duplicate"
              ? run.deck.length + duplicateSlots > engine.deckLimit(run) ||
                run.deck.filter((held) => held.id === card.id).length >=
                  engine.cardMaxCopies(card.id)
              : false,
      duplicateCost =
        duplicateTier === 1
          ? "체력 -5"
          : duplicateTier === 2
            ? "체력 -10"
            : duplicateTier === 3
              ? "체력 -15 · 불순물 1장"
              : "체력 -10 · T1 저주 1개",
      label =
        {
          remove: `${removePrice}G · 영구 제거`,
          cleanse_card: "이 카드 소각",
          duplicate: `${duplicateCost} · 복제`,
        }[pickerMode] || "선택";
    return `<button data-special-deck-action="${pickerMode}" data-index="${index}" ${blocked ? "disabled" : ""}>${label}</button>`;
  }

  function renderPicker(pickerMode) {
    const config = SPECIAL_DECK_PICKER_CONFIG[pickerMode],
      run = getRun();
    if (!config || !run) return null;
    const dialog = pickerDialog();
    mode = pickerMode;
    $("special-deck-picker-eyebrow").textContent = config.eyebrow;
    const removePrice = pickerMode === "remove" ? labRemovePrice(run) : null;
    $("special-deck-picker-title").textContent =
      `${pickerMode === "remove" ? `용매 세척 · ${removePrice}G` : config.title} · ${run.deck.length}장`;
    $("special-deck-picker-description").textContent =
      pickerMode === "remove"
        ? `${removePrice}G를 사용해 선택한 카드 1장을 덱에서 영구 제거합니다.`
        : config.description;
    $("special-deck-picker-grid").innerHTML = run.deck
      .map(
        (card, index) =>
          `<article class="special-deck-picker-card">${presentationCardHtml(card)}<div class="special-deck-picker-actions">${pickerActions(pickerMode, card, index)}</div></article>`,
      )
      .join("");
    return dialog;
  }

  function openSpecialDeckPicker(pickerMode) {
    const dialog = renderPicker(pickerMode);
    if (dialog) dialog.showModal();
  }

  function bindSpecialDeckPicker(app) {
    app.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-special-deck-picker]");
      if (!trigger || getCardAnimating()) return;
      openSpecialDeckPicker(trigger.dataset.specialDeckPicker);
    });
  }

  return { bindSpecialDeckPicker, openSpecialDeckPicker };
}
