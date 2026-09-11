import assert from "node:assert/strict";

const stored = new Map();
let playCount = 0;
let lastPlayer = null;

class FakeAudio {
  constructor(source) {
    this.source = source;
    this.currentTime = 4;
    this.muted = false;
    this.volume = 1;
    this.paused = true;
    lastPlayer = this;
  }
  load() {}
  addEventListener() {}
  pause() {
    this.paused = true;
  }
  play() {
    this.paused = false;
    playCount++;
    return Promise.resolve();
  }
}

global.Audio = FakeAudio;
global.window = {
  localStorage: {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
  },
};

const { SFX } = await import("../games/harmony/sound.js");
assert.equal(SFX.volume, 80, "file sounds start at the default volume");

SFX.draw();
SFX.draw();
assert.equal(playCount, 2, "each drawn card can play an overlapping sound");
assert.match(lastPlayer.source, /sounds\/card\/card-draw\.mp3$/);

SFX.cardPlay();
assert.equal(playCount, 3, "playing an active card uses its assigned sound");
assert.match(lastPlayer.source, /sounds\/card\/card-play\.mp3$/);

SFX.absorbCard();
assert.equal(playCount, 4, "playing an absorb card adds its assigned sound");
assert.match(lastPlayer.source, /sounds\/special\/absorption\.mp3$/);

SFX.coinGet();
assert.equal(playCount, 5, "showing a gold gain plays its assigned sound");
assert.match(lastPlayer.source, /sounds\/special\/coin_get\.mp3$/);

SFX.purchase();
assert.equal(playCount, 6, "showing a gold loss plays its assigned sound");
assert.match(lastPlayer.source, /sounds\/special\/item_buy\.mp3$/);

SFX.shieldCast();
assert.equal(playCount, 7, "a defense card shield gain uses its cast sound");
assert.match(lastPlayer.source, /sounds\/special\/shield_cast\.mp3$/);

SFX.defense();
assert.equal(playCount, 8, "a fully blocked attack uses its defense sound");
assert.match(lastPlayer.source, /sounds\/special\/defense\.mp3$/);

SFX.contactHit();
assert.equal(playCount, 9, "contact damage uses its assigned hit sound");
assert.match(lastPlayer.source, /sounds\/hit\/contact-hit\.mp3$/);

SFX.nonContactHit();
assert.equal(playCount, 10, "non-contact damage uses its assigned hit sound");
assert.match(lastPlayer.source, /sounds\/hit\/noncontact-hit\.mp3$/);

SFX.playerHit();
assert.equal(playCount, 11, "player health damage uses its assigned hurt sound");
assert.match(lastPlayer.source, /sounds\/special\/player_hurt\.mp3$/);

SFX.impurity();
assert.equal(playCount, 12, "drawing an impurity uses its warning sound");
assert.match(lastPlayer.source, /sounds\/special\/Impurities\.mp3$/);

SFX.monsterDeath("unknown");
assert.equal(playCount, 12, "materials without an assigned file stay silent");

SFX.monsterDeath("gas");
assert.equal(playCount, 13, "gas death plays its assigned audio file");
assert.match(lastPlayer.source, /sounds\/monster\/gas_death\.mp3$/);
assert.equal(lastPlayer.currentTime, 0, "repeated effects restart from the beginning");
assert.equal(lastPlayer.volume, 0.8, "master volume applies to file sounds");

SFX.monsterDeath("glass");
assert.equal(playCount, 14, "glass death plays its assigned audio file");
assert.match(lastPlayer.source, /sounds\/monster\/glass_death\.mp3$/);

SFX.monsterDeath("liquid");
assert.equal(playCount, 15, "liquid death plays its assigned audio file");
assert.match(lastPlayer.source, /sounds\/monster\/liquid_death\.mp3$/);

SFX.monsterDeath("spirit");
assert.equal(playCount, 16, "spirit death plays its assigned audio file");
assert.match(lastPlayer.source, /sounds\/monster\/spirit_death\.mp3$/);

SFX.monsterDeath("stone");
assert.equal(playCount, 17, "stone death plays its assigned audio file");
assert.match(lastPlayer.source, /sounds\/monster\/stone_death\.mp3$/);

SFX.potion();
assert.equal(playCount, 18, "drinking a potion uses its assigned sound");
assert.match(lastPlayer.source, /sounds\/special\/potion_drink\.mp3$/);

SFX.shuffle();
assert.equal(playCount, 19, "rebuilding the draw pile uses its assigned sound");
assert.match(lastPlayer.source, /sounds\/card\/card-shuffle\.mp3$/);

SFX.heal();
assert.equal(playCount, 20, "healing feedback uses its assigned sound");
assert.match(lastPlayer.source, /sounds\/special\/heal\.mp3$/);

SFX.setVolume(55);
assert.ok(Math.abs(lastPlayer.volume - 0.495) < 1e-9, "ambient heartbeat keeps its 90% mix level");
assert.equal(stored.get("harmony_sfx_volume"), "55");

SFX.toggleMute();
SFX.monsterDeath("gas");
assert.equal(playCount, 20, "muting prevents file playback");

console.log("PASS Harmony sound: cards, special effects, hits, deaths, volume and mute behavior.");
