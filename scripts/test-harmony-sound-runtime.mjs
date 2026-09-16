import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createSoundRuntime } from "../games/harmony/sound-runtime.js";

const soundSource = await readFile(new URL("../games/harmony/sound.js", import.meta.url), "utf8");
assert.match(soundSource, /createSoundRuntime/);
assert.doesNotMatch(soundSource, /window\.localStorage|new Audio\(/);

const MUTE_KEY = "harmony_sfx_muted";
const VOLUME_KEY = "harmony_sfx_volume";

const stored = new Map([
  [MUTE_KEY, "true"],
  [VOLUME_KEY, "55"],
]);
const created = [];
const storage = {
  getItem(key) {
    return stored.get(key) ?? null;
  },
  setItem(key, value) {
    stored.set(key, value);
  },
};
const runtime = createSoundRuntime({
  storage,
  createAudio(source) {
    const player = { source };
    created.push(player);
    return player;
  },
});

assert.deepEqual(
  runtime.loadSettings({ muteKey: MUTE_KEY, volumeKey: VOLUME_KEY }),
  { muted: true, volume: 55 },
  "stored mute and volume settings load through the runtime boundary",
);

runtime.storeMuted(MUTE_KEY, false);
runtime.storeVolume(VOLUME_KEY, 72);
assert.equal(stored.get(MUTE_KEY), "false");
assert.equal(stored.get(VOLUME_KEY), "72");

const player = runtime.createPlayer("effect.mp3");
assert.equal(player.source, "effect.mp3");
assert.equal(created.length, 1, "audio construction is delegated to the runtime factory");

stored.set(VOLUME_KEY, "not-a-number");
assert.deepEqual(
  runtime.loadSettings({ muteKey: MUTE_KEY, volumeKey: VOLUME_KEY, defaultVolume: 80 }),
  { muted: false, volume: 80 },
  "invalid stored volume falls back without changing mute semantics",
);

const unavailable = createSoundRuntime({ storage: null, createAudio: null });
assert.deepEqual(
  unavailable.loadSettings({ muteKey: MUTE_KEY, volumeKey: VOLUME_KEY, defaultVolume: 64 }),
  { muted: false, volume: 64 },
  "missing browser storage keeps safe in-memory defaults",
);
assert.equal(unavailable.createPlayer("silent.mp3"), null);
unavailable.storeMuted(MUTE_KEY, true);
unavailable.storeVolume(VOLUME_KEY, 10);

const throwingStorage = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
};
const restricted = createSoundRuntime({ storage: throwingStorage });
assert.deepEqual(
  restricted.loadSettings({ muteKey: MUTE_KEY, volumeKey: VOLUME_KEY }),
  { muted: false, volume: 80 },
  "restricted storage is treated as unavailable",
);
restricted.storeMuted(MUTE_KEY, true);
restricted.storeVolume(VOLUME_KEY, 25);

console.log("PASS Harmony sound runtime: storage and Audio browser dependencies stay behind one boundary.");
