const TOTAL_ROOMS = 12;

const ROOM_PRESENTATION = Object.freeze({
  battle: Object.freeze({ kind: "battle", label: "전투", icon: "⚔" }),
  combat: Object.freeze({ kind: "battle", label: "전투", icon: "⚔" }),
  elite: Object.freeze({ kind: "elite", label: "엘리트", icon: "◆" }),
  shop: Object.freeze({ kind: "shop", label: "상점", icon: "◈" }),
  smuggler: Object.freeze({ kind: "shop", label: "상점", icon: "◈" }),
  rest: Object.freeze({ kind: "rest", label: "휴식", icon: "☾" }),
  treasure: Object.freeze({ kind: "treasure", label: "보물", icon: "◇" }),
  golden: Object.freeze({ kind: "treasure", label: "보물", icon: "◇" }),
  gather: Object.freeze({ kind: "gather", label: "채집", icon: "❧" }),
  greenhouse: Object.freeze({ kind: "gather", label: "채집", icon: "❧" }),
  boss: Object.freeze({ kind: "boss", label: "보스", icon: "♛" }),
  event: Object.freeze({ kind: "event", label: "이벤트", icon: "✧" }),
});

const EVENT_ROOMS = new Set([
  "mystery",
  "curse_pit",
  "lab",
  "mercury_still",
  "blood_altar",
  "dice_altar",
  "purify_furnace",
  "mirror_doppel",
]);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function roomPresentation(roomId) {
  if (EVENT_ROOMS.has(roomId)) return ROOM_PRESENTATION.event;
  return ROOM_PRESENTATION[roomId] || ROOM_PRESENTATION.event;
}

function resolvedRoomId(run, engine, index) {
  if (run?.resolvedRooms?.[index]) return run.resolvedRooms[index];
  if (index === run?.node && run?.currentSubRoom) return run.currentSubRoom;
  const route = engine?.routeFor?.(run) || run?.route || [];
  return route[index] || (index === TOTAL_ROOMS - 1 ? "boss" : "combat");
}

export function pcRouteViewModel(run, engine) {
  const currentIndex = Math.max(
      0,
      Math.min(TOTAL_ROOMS - 1, Math.floor(Number(run?.node) || 0)),
    ),
    nodes = Array.from({ length: TOTAL_ROOMS }, (_, index) => {
      const state = index < currentIndex
? "done"
: index === currentIndex
  ? "current"
  : index === currentIndex + 1
    ? "next"
    : "future",
        forceBoss = index === TOTAL_ROOMS - 1,
        sourceId = forceBoss ? "boss" : resolvedRoomId(run, engine, index),
        room = roomPresentation(sourceId),
        revealed = state !== "future" || forceBoss;
      return {
        index,
        number: String(index + 1).padStart(2, "0"),
        state,
        kind: revealed ? room.kind : "hidden",
        roomId: revealed ? sourceId : null,
        label: revealed ? room.label : "미공개",
        icon: revealed ? room.icon : "?",
        boss: forceBoss,
      };
    });
  return {
    room: currentIndex + 1,
    total: TOTAL_ROOMS,
    current: nodes[currentIndex],
    next: nodes[currentIndex + 1] || null,
    nodes,
  };
}

function summaryRoom(label, room, role) {
  if (!room)
    return `<span class="pc-route-summary pc-route-summary-${role}"><small>${label}</small><i aria-hidden="true">—</i><span class="sr-only">없음</span></span>`;
  return `<span class="pc-route-summary pc-route-summary-${role}"><small>${label}</small><i class="pc-route-summary-icon pc-route-kind-${room.kind}" aria-hidden="true">${room.icon}</i><span class="sr-only">${escapeHtml(room.label)}</span></span>`;
}

function nodeMarkup(node) {
  const stateLabel = node.state === "current"
    ? "현재"
    : node.state === "next"
      ? "다음"
      : node.state === "done"
        ? "완료"
        : "";
  return `<span class="pc-route-node pc-route-${node.state} pc-route-kind-${node.kind}${node.boss ? " pc-route-boss" : ""}" role="listitem" data-pc-route-node="${node.index}" data-state="${node.state}" data-room-kind="${node.kind}" title="${node.number}. ${escapeHtml(node.label)}${stateLabel ? ` · ${stateLabel}` : ""}"><span class="pc-route-node-icon" aria-hidden="true">${node.icon}</span><small class="pc-route-node-number">${node.number}</small>${stateLabel ? `<em>${stateLabel}</em>` : ""}<span class="sr-only">${escapeHtml(node.label)}${stateLabel ? `, ${stateLabel}` : ""}</span></span>`;
}

function closeRoute(shell, returnFocus = false) {
  if (!shell?.classList.contains("is-open")) return false;
  const trigger = shell.querySelector("[data-pc-route-toggle]"),
    popover = shell.querySelector("[data-pc-route-popover]");
  shell.classList.remove("is-open");
  trigger?.setAttribute("aria-expanded", "false");
  if (popover) popover.hidden = true;
  if (returnFocus && trigger?.isConnected)
    queueMicrotask(() => trigger.focus({ preventScroll: true }));
  return true;
}

function openRoute(shell) {
  const trigger = shell?.querySelector("[data-pc-route-toggle]"),
    popover = shell?.querySelector("[data-pc-route-popover]");
  if (!trigger || !popover) return false;
  document.querySelectorAll(".pc-route-shell.is-open").forEach((other) => {
    if (other !== shell) closeRoute(other, false);
  });
  shell.classList.add("is-open");
  trigger.setAttribute("aria-expanded", "true");
  popover.hidden = false;
  return true;
}

let handlersInstalled = false;
function installRouteHandlers() {
  if (handlersInstalled || typeof document === "undefined") return;
  handlersInstalled = true;
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest?.("[data-pc-route-toggle]");
    if (trigger) {
      const shell = trigger.closest(".pc-route-shell");
      if (shell?.classList.contains("is-open")) closeRoute(shell, false);
      else openRoute(shell);
      return;
    }
    const open = document.querySelector(".pc-route-shell.is-open");
    if (open && !open.contains(event.target)) closeRoute(open, false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const open = document.querySelector(".pc-route-shell.is-open");
    if (!open) return;
    event.preventDefault();
    closeRoute(open, true);
  });
}

export function renderPcRoute(routeElement, run, engine) {
  if (!routeElement || !run) return null;
  installRouteHandlers();
  const model = pcRouteViewModel(run, engine),
    popoverId = "pc-dungeon-route-popover";
  routeElement.classList.add("pc-route-shell");
  routeElement.dataset.pcRouteEnhanced = "true";
  routeElement.setAttribute("aria-label", "던전 진행 경로");
  routeElement.innerHTML = `<button type="button" class="pc-route-compact" data-pc-route-toggle aria-expanded="false" aria-controls="${popoverId}"><strong>ROOM ${String(model.room).padStart(2, "0")} / ${model.total}</strong><span class="pc-route-dot" aria-hidden="true">·</span>${summaryRoom("현재", model.current, "current")}<span class="pc-route-dot" aria-hidden="true">·</span>${summaryRoom("다음", model.next, "next")}<span class="pc-route-chevron" aria-hidden="true">⌄</span></button><div id="${popoverId}" class="pc-route-popover" data-pc-route-popover hidden><div class="pc-route-popover-head"><span>JOURNEY ROUTE</span><small>현재와 다음 경로를 확인합니다.</small></div><div class="pc-route-track" role="list" aria-label="12개 방 진행 경로">${model.nodes.map(nodeMarkup).join("")}</div></div>`;
  return model;
}
