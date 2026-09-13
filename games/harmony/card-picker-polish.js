function putHealFirst(summary) {
  const rows = [...summary.querySelectorAll(":scope > .card-summary-row")];
  if (rows.length < 2) return;
  const healRow = rows.find((row) => row.textContent.trim().startsWith("회복"));
  const shieldRow = rows.find((row) => row.textContent.trim().startsWith("방어막"));
  if (!healRow || !shieldRow) return;
  if (rows.indexOf(healRow) > rows.indexOf(shieldRow)) {
    summary.insertBefore(healRow, shieldRow);
  }
}

function polishCardPicker(root = document) {
  root
    .querySelectorAll?.(".card.card-category-heal .card-effect-main.card-effect-compact")
    .forEach(putHealFirst);

  root
    .querySelectorAll?.("#deck-replace .deck-card-picker-action")
    .forEach((button) => {
      if (button.textContent.trim() !== "교체하기") button.textContent = "교체하기";
    });
}

let polishScheduled = false;
function schedulePolish() {
  if (polishScheduled) return;
  polishScheduled = true;
  requestAnimationFrame(() => {
    polishScheduled = false;
    polishCardPicker();
  });
}

polishCardPicker();
new MutationObserver(schedulePolish).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
