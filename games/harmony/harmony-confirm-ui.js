function defaultDocument() {
  return typeof document !== "undefined" ? document : null;
}

export function createHarmonyConfirmUi({ documentRef = defaultDocument() } = {}) {
  let dialog = null,
    pending = null,
    returnFocus = null;

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = documentRef?.getElementById?.("harmony-confirm");
    if (!dialog) {
      dialog = documentRef.createElement("dialog");
      dialog.id = "harmony-confirm";
      dialog.className = "harmony-confirm-dialog";
      dialog.setAttribute("aria-labelledby", "harmony-confirm-title");
      dialog.setAttribute("aria-describedby", "harmony-confirm-description");
      dialog.innerHTML = `<div class="dialog-head"><div><small id="harmony-confirm-eyebrow">CONFIRM</small><h2 id="harmony-confirm-title">확인</h2></div><button type="button" data-harmony-confirm-close aria-label="닫기">×</button></div><div class="harmony-confirm-body"><p id="harmony-confirm-description"></p></div><div class="harmony-confirm-actions"><button type="button" data-harmony-confirm-cancel>취소</button><button type="button" class="primary" data-harmony-confirm-primary>확인</button></div>`;
      documentRef.body.append(dialog);
    }

    const close = () => dialog.close();
    dialog.querySelector("[data-harmony-confirm-close]")?.addEventListener("click", close);
    dialog.querySelector("[data-harmony-confirm-cancel]")?.addEventListener("click", close);
    dialog.querySelector("[data-harmony-confirm-primary]")?.addEventListener("click", () => {
      if (!pending) return;
      const primary = dialog.querySelector("[data-harmony-confirm-primary]");
      if (primary.disabled) return;
      primary.disabled = true;
      pending.result = true;
      dialog.close();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      const current = pending;
      pending = null;
      if (current) current.resolve(Boolean(current.result));
      const focusTarget = returnFocus;
      returnFocus = null;
      focusTarget?.focus?.();
    });
    return dialog;
  }

  function openHarmonyConfirm({
    eyebrow = "CONFIRM",
    title,
    description,
    primaryLabel = "확인",
    secondaryLabel = "취소",
    tone = "default",
    trigger = null,
  } = {}) {
    const modal = ensureDialog();
    if (pending) return pending.promise;

    returnFocus = trigger || documentRef?.activeElement || null;
    const primary = modal.querySelector("[data-harmony-confirm-primary]"),
      cancel = modal.querySelector("[data-harmony-confirm-cancel]");
    modal.dataset.tone = tone;
    modal.querySelector("#harmony-confirm-eyebrow").textContent = eyebrow;
    modal.querySelector("#harmony-confirm-title").textContent = title || "확인";
    modal.querySelector("#harmony-confirm-description").textContent = description || "";
    primary.textContent = primaryLabel;
    primary.disabled = false;
    cancel.textContent = secondaryLabel;

    let resolvePromise;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    pending = { promise, resolve: resolvePromise, result: false };

    globalThis.window?.dispatchEvent?.(
      new CustomEvent("harmony:overlay-opening", { detail: { trigger: returnFocus } }),
    );
    modal.showModal();
    primary.focus?.();
    return promise;
  }

  return { openHarmonyConfirm };
}
