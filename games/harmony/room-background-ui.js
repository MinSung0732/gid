const app = typeof document === "undefined" ? null : document.getElementById("app");

if (typeof document !== "undefined" && !document.querySelector('link[data-harmony-room-background-css]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./room-background-ui.css?v=20260918-3";
  link.dataset.harmonyRoomBackgroundCss = "1";
  document.head.append(link);
}

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

const ROOM_KIND = Object.freeze({
  battle: "battle",
  combat: "battle",
  elite: "elite",
  boss: "boss",
  shop: "shop",
  smuggler: "shop",
  rest: "rest",
  treasure: "treasure",
  golden: "treasure",
  gather: "gather",
  greenhouse: "gather",
  event: "event",
});

const STAGE_ART = Object.freeze([
  Object.freeze({ key: "act1", filename: "act1-battle-pc.avif" }),
  Object.freeze({ key: "act2", filename: "act2-battle-pc.avif" }),
  Object.freeze({ key: "act3", filename: "act3-battle-pc.avif" }),
  Object.freeze({ key: "act4", filename: "act4-battle-pc.avif" }),
  Object.freeze({ key: "act5", filename: "act5-battle-pc.avif" }),
  Object.freeze({ key: "act6", filename: "act6-battle-pc.avif" }),
  Object.freeze({ key: "act7", filename: "act7-battle-pc.avif" }),
]);

const ABYSS_ART = Object.freeze({
  key: "abyss",
  filename: "abyss-battle-pc.avif",
});

function normalizeRoomKind(roomId) {
  const key = String(roomId || "").toLowerCase();
  if (EVENT_ROOMS.has(key)) return "event";
  return ROOM_KIND[key] || null;
}

function currentRoomKind(run) {
  if (!run) return null;
  const node = Math.max(0, Math.min(11, Math.floor(Number(run.node) || 0)));
  if (node === 11) return "boss";
  const roomId =
    run.resolvedRooms?.[node] ||
    run.currentSubRoom ||
    run.route?.[node] ||
    null;
  return normalizeRoomKind(roomId) || (run.phase === "battle" ? "battle" : "event");
}

function stageArtForLoop(loop) {
  const index = Math.max(0, Math.floor(Number(loop) || 0));
  return STAGE_ART[index] || ABYSS_ART;
}

function clearRoomBackground(stage) {
  if (!stage) return;
  delete stage.dataset.harmonyRoomArt;
  delete stage.dataset.harmonyRoomAct;
  stage.style.removeProperty("--harmony-room-bg");
}

function syncRoomBackground(run) {
  if (!app || !run) return;
  const stageArt = stageArtForLoop(run.loop);
  app.dataset.harmonyStage = stageArt.key;

  const stage = app.querySelector(
    ".play-content > .battle, .play-content > .room, .battle, .room",
  );
  if (!stage) return;

  const kind = currentRoomKind(run);
  if (!kind) {
    clearRoomBackground(stage);
    return;
  }

  stage.dataset.harmonyRoomArt = kind;
  stage.dataset.harmonyRoomAct = stageArt.key;
  stage.style.setProperty(
    "--harmony-room-bg",
    `url("./assets/art/backgrounds/stages/${stageArt.filename}")`,
  );
}

export {
  clearRoomBackground,
  currentRoomKind,
  stageArtForLoop,
  syncRoomBackground,
};
