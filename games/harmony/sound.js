const STORAGE_KEY = "harmony_sfx_muted";

let context = null;
let muted = readMuted();

function readMuted() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function audioContext() {
  if (muted || typeof window === "undefined") return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  try {
    context ||= new AudioContext();
    return context;
  } catch {
    return null;
  }
}

function withContext(play) {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === "running") {
    play(ctx);
    return;
  }
  void ctx.resume().then(() => play(ctx)).catch(() => {});
}

function tone(frequency, duration, volume, options = {}) {
  withContext((ctx) => {
    const start = ctx.currentTime + (options.delay || 0),
      oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.type = options.type || "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    if (options.endFrequency)
      oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  });
}

function noise(duration, volume, startFrequency, endFrequency) {
  withContext((ctx) => {
    const length = Math.ceil(ctx.sampleRate * duration),
      buffer = ctx.createBuffer(1, length, ctx.sampleRate),
      samples = buffer.getChannelData(0),
      source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain(),
      start = ctx.currentTime;
    for (let index = 0; index < length; index++) samples[index] = Math.random() * 2 - 1;
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(startFrequency, start);
    filter.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(start);
  });
}

export const SFX = {
  get muted() { return muted; },
  toggleMute() {
    muted = !muted;
    try {
      if (typeof window !== "undefined")
        window.localStorage.setItem(STORAGE_KEY, String(muted));
    } catch {
      // Sound still works for this session when storage is unavailable.
    }
    return muted;
  },
  unlock() {
    const ctx = audioContext();
    if (ctx?.state === "suspended") void ctx.resume().catch(() => {});
  },
  confirm() { tone(620, 0.09, 0.1, { endFrequency: 880 }); },
  draw() { noise(0.075, 0.035, 700, 2100); },
  cardPlay() { tone(330, 0.085, 0.08, { type: "triangle", endFrequency: 150 }); },
  enemyHit() { tone(170, 0.14, 0.14, { type: "triangle", endFrequency: 42 }); },
  playerHit() { tone(120, 0.19, 0.13, { type: "sawtooth", endFrequency: 38 }); },
  shieldBlock() {
    tone(720, 0.14, 0.11, { type: "triangle", endFrequency: 480 });
    tone(980, 0.12, 0.07, { type: "triangle", endFrequency: 650, delay: 0.015 });
  },
  shieldGain() { tone(240, 0.17, 0.08, { endFrequency: 520 }); },
  absorb() { tone(390, 0.16, 0.09, { endFrequency: 760 }); },
  harmony() {
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) =>
      tone(frequency, 0.38, 0.085, { delay: index * 0.065 }),
    );
  },
  heal() { tone(440, 0.2, 0.08, { type: "triangle", endFrequency: 880 }); },
  monsterDeath() { tone(145, 0.4, 0.14, { type: "sawtooth", endFrequency: 32 }); },
  purchase() {
    [[1180, 0, 0.07, 0.055], [1560, 0.065, 0.08, 0.05], [1960, 0.14, 0.12, 0.06], [740, 0.25, 0.09, 0.07], [988, 0.34, 0.18, 0.065]]
      .forEach(([frequency, delay, duration, volume], index) =>
        tone(frequency, duration, volume, { delay, type: index < 3 ? "sine" : "triangle" }),
      );
  },
};
