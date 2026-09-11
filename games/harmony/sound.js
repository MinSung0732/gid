const MUTE_KEY = "harmony_sfx_muted";
const VOLUME_KEY = "harmony_sfx_volume";
const MONSTER_DEATH_SOUNDS = {
  gas: new URL("./sounds/monster/gas_death.mp3", import.meta.url).href,
  glass: new URL("./sounds/monster/glass_death.mp3", import.meta.url).href,
  liquid: new URL("./sounds/monster/liquid_death.mp3", import.meta.url).href,
  spirit: new URL("./sounds/monster/spirit_death.mp3", import.meta.url).href,
  stone: new URL("./sounds/monster/stone_death.mp3", import.meta.url).href,
};
const ACTION_SOUNDS = {
  draw: new URL("./sounds/card/card-draw.mp3", import.meta.url).href,
  shuffle: new URL("./sounds/card/card-shuffle.mp3", import.meta.url).href,
  cardPlay: new URL("./sounds/card/card-play.mp3", import.meta.url).href,
  contactHit: new URL("./sounds/hit/contact-hit.mp3", import.meta.url).href,
  nonContactHit: new URL("./sounds/hit/noncontact-hit.mp3", import.meta.url)
    .href,
  absorbCard: new URL("./sounds/special/absorption.mp3", import.meta.url).href,
  coinGet: new URL("./sounds/special/coin_get.mp3", import.meta.url).href,
  defense: new URL("./sounds/special/defense.mp3", import.meta.url).href,
  purchase: new URL("./sounds/special/item_buy.mp3", import.meta.url).href,
  shieldCast: new URL("./sounds/special/shield_cast.mp3", import.meta.url).href,
  playerHurt: new URL("./sounds/special/player_hurt.mp3", import.meta.url).href,
  impurity: new URL("./sounds/special/Impurities.mp3", import.meta.url).href,
  potion: new URL("./sounds/special/potion_drink.mp3", import.meta.url).href,
  heal: new URL("./sounds/special/heal.mp3", import.meta.url).href,
};
const AMBIENT_SOUNDS = {
  criticalHeartbeat: new URL("./sounds/special/heartbeat.mp3", import.meta.url).href,
};

const players = new Map();
const activePlayers = new Set();
let isMuted = false;
let volume = 80;
let criticalHeartbeatRequested = false;
let audioUnlocked = false;

try {
  isMuted = window.localStorage.getItem(MUTE_KEY) === "true";
  const storedVolume = window.localStorage.getItem(VOLUME_KEY),
    parsedVolume = Number(storedVolume);
  if (
    storedVolume !== null &&
    Number.isFinite(parsedVolume) &&
    parsedVolume >= 0 &&
    parsedVolume <= 100
  )
    volume = parsedVolume;
} catch {
  // Browser storage can be unavailable in private or restricted contexts.
}

function playerFor(source) {
  if (typeof Audio === "undefined") return null;
  if (!players.has(source)) {
    const player = new Audio(source);
    player.preload = "auto";
    players.set(source, player);
  }
  return players.get(source);
}

function syncPlayers() {
  for (const player of [...players.values(), ...activePlayers]) {
    player.muted = isMuted;
    player.volume = volume / 100;
  }
}

function syncCriticalHeartbeat() {
  const player = playerFor(AMBIENT_SOUNDS.criticalHeartbeat);
  if (!player) return;
  player.loop = true;
  player.muted = isMuted;
  player.volume = (volume / 100) * 0.9;
  if (!criticalHeartbeatRequested || isMuted || volume <= 0) {
    player.pause();
    if (!criticalHeartbeatRequested) player.currentTime = 0;
    return;
  }
  if (player.paused) void player.play().catch(() => {});
}

function playFile(source, overlap = false) {
  if (!source || isMuted || volume <= 0) return;
  const player = overlap && typeof Audio !== "undefined"
    ? new Audio(source)
    : playerFor(source);
  if (!player) return;
  player.muted = false;
  player.volume = volume / 100;
  player.currentTime = 0;
  if (overlap) {
    activePlayers.add(player);
    player.addEventListener?.("ended", () => activePlayers.delete(player), {
      once: true,
    });
  }
  void player.play().catch(() => {});
}

function noSoundAssigned() {}

export const SFX = {
  get muted() {
    return isMuted;
  },
  get volume() {
    return volume;
  },
  toggleMute() {
    isMuted = !isMuted;
    syncPlayers();
    syncCriticalHeartbeat();
    try {
      window.localStorage.setItem(MUTE_KEY, String(isMuted));
    } catch {
      // The setting still applies until this page closes.
    }
    return isMuted;
  },
  setVolume(value) {
    volume = Math.max(0, Math.min(100, Number(value) || 0));
    syncPlayers();
    syncCriticalHeartbeat();
    try {
      window.localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      // The setting still applies until this page closes.
    }
    return volume;
  },
  unlock() {
    if (!audioUnlocked) {
      for (const source of [
        ...Object.values(MONSTER_DEATH_SOUNDS),
        ...Object.values(ACTION_SOUNDS),
        ...Object.values(AMBIENT_SOUNDS),
      ]) {
        const player = playerFor(source);
        if (player) player.load();
      }
      audioUnlocked = true;
    }
    syncCriticalHeartbeat();
  },
  setCriticalHeartbeat(active) {
    criticalHeartbeatRequested = Boolean(active);
    syncCriticalHeartbeat();
  },
  monsterDeath(material) {
    playFile(MONSTER_DEATH_SOUNDS[material]);
  },
  draw() {
    playFile(ACTION_SOUNDS.draw, true);
  },
  shuffle() {
    playFile(ACTION_SOUNDS.shuffle, true);
  },
  cardPlay() {
    playFile(ACTION_SOUNDS.cardPlay, true);
  },
  absorbCard() {
    playFile(ACTION_SOUNDS.absorbCard, true);
  },
  coinGet() {
    playFile(ACTION_SOUNDS.coinGet, true);
  },
  defense() {
    playFile(ACTION_SOUNDS.defense, true);
  },
  purchase() {
    playFile(ACTION_SOUNDS.purchase, true);
  },
  shieldCast() {
    playFile(ACTION_SOUNDS.shieldCast, true);
  },
  contactHit() {
    playFile(ACTION_SOUNDS.contactHit, true);
  },
  nonContactHit() {
    playFile(ACTION_SOUNDS.nonContactHit, true);
  },
  playerHit() {
    playFile(ACTION_SOUNDS.playerHurt, true);
  },
  impurity() {
    playFile(ACTION_SOUNDS.impurity, true);
  },
  potion() {
    playFile(ACTION_SOUNDS.potion, true);
  },
  heal() {
    playFile(ACTION_SOUNDS.heal, true);
  },

  // These actions stay silent until their audio files are supplied.
  enemyHit: noSoundAssigned,
  shieldBlock: noSoundAssigned,
  shieldGain: noSoundAssigned,
  absorb: noSoundAssigned,
  harmony: noSoundAssigned,
  confirm: noSoundAssigned,
};
