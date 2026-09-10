import assert from "node:assert/strict";

let oscillatorStarts = 0;
const parameter = {
  setValueAtTime() {},
  exponentialRampToValueAtTime() {},
};
class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 48000;
    this.state = "suspended";
    this.destination = {};
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  createOscillator() {
    return {
      frequency: parameter,
      connect() { return this; },
      start() { oscillatorStarts++; },
      stop() {},
    };
  }
  createGain() {
    return { gain: parameter, connect() { return this; } };
  }
  createBuffer(_channels, length) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    return { connect() { return this; }, start() { oscillatorStarts++; } };
  }
  createBiquadFilter() {
    return { frequency: parameter, connect() { return this; } };
  }
}

const stored = new Map();
global.window = {
  AudioContext: FakeAudioContext,
  localStorage: {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
  },
};

const { SFX } = await import("../games/harmony/sound.js");
SFX.cardPlay();
await Promise.resolve();
assert.equal(oscillatorStarts, 1, "suspended audio resumes before playback");

SFX.toggleMute();
SFX.enemyHit();
assert.equal(oscillatorStarts, 1, "muted sound does not create playback");
assert.equal(stored.get("harmony_sfx_muted"), "true", "mute preference persists");

SFX.toggleMute();
SFX.confirm();
assert.equal(oscillatorStarts, 2, "unmuting can play a confirmation sound");

console.log("PASS Harmony sound: mobile resume, mute persistence and confirmation playback.");
