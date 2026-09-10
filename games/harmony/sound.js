// sound.js - Zero-Download Web Audio Procedural SFX Engine
let audioCtx = null;
let masterGain = null;
let isMuted = false;
let volume = 80;
try {
  isMuted = window.localStorage.getItem("harmony_sfx_muted") === "true";
  const storedVolume = window.localStorage.getItem("harmony_sfx_volume"),
    savedVolume = Number(storedVolume);
  if (storedVolume !== null && Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 100)
    volume = savedVolume;
} catch {
  // Keep sound available when browser storage is blocked.
}

function getContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    try {
      if (AudioContext) audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function output(ctx) {
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
  }
  masterGain.gain.setValueAtTime(volume / 50, ctx.currentTime);
  return masterGain;
}

export const SFX = {
  get muted() { return isMuted; },
  get volume() { return volume; },
  setVolume(value) {
    volume = Math.max(0, Math.min(100, Number(value) || 0));
    if (audioCtx && masterGain)
      masterGain.gain.setValueAtTime(volume / 50, audioCtx.currentTime);
    try {
      window.localStorage.setItem("harmony_sfx_volume", String(volume));
    } catch {
      // The setting remains valid for this page session.
    }
    return volume;
  },
  toggleMute() {
    isMuted = !isMuted;
    try {
      window.localStorage.setItem("harmony_sfx_muted", String(isMuted));
    } catch {
      // The setting remains valid for this page session.
    }
    return isMuted;
  },
  unlock() {
    if (!isMuted) getContext();
  },

  // 1. 카드 드로우 (종이가 스치는 부드러운 화이트 노이즈 펄럭임)
  draw() {
    if (isMuted) return;
    const ctx = getContext();
    if (!ctx) return;
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    noise.connect(filter).connect(gain).connect(output(ctx));
    noise.start();
  },

  // 2. 카드 사용/터치 (경쾌하고 쫀득한 팝 사운드)
  play() {
    if (isMuted) return;
    const ctx = getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.connect(gain).connect(output(ctx));
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  },
  cardPlay() {
    this.play();
  },

  // 3. 접촉 타격 (무겁게 내리꽂히는 둔탁한 육탄 충격음)
  hitContact() {
    if (isMuted) return;
    const ctx = getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    osc.connect(gain).connect(output(ctx));
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  },
  enemyHit() {
    this.hitContact();
  },
  playerHit() {
    this.hitContact();
  },

  // 4. 비접촉 타격 (바람을 가르며 스며드는 날카로운 스위시 & 틱)
  hitNonContact() {
    if (isMuted) return;
    const ctx = getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain).connect(output(ctx));
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  },

  // 5. 방패 방어막 획득 (웅장하고 안정적인 실드 캐스팅음)
  shieldGain() {
    if (isMuted) return;
    const ctx = getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain).connect(output(ctx));
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  },

  // 6. 방패로 막기 (챙! 튕겨내는 청명한 금속성 클랭크음)
  shieldBlock() {
    if (isMuted) return;
    const ctx = getContext();
    if (!ctx) return;
    [680, 920].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2 - idx * 0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain).connect(output(ctx));
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    });
  },

  // 7. 흡수 충전 (스포이트로 향액을 빨아올리는 찰랑 물방울음)
  absorb() {
    if (isMuted) return;
    const ctx = getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(380, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(760, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain).connect(output(ctx));
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  },

  // 8. 하모니 완성! (향수의 피라미드가 맺어지는 영롱한 3중 크리스탈 차임)
  harmony() {
    if (isMuted) return;
    const ctx = getContext();
    if (!ctx) return;
    const chords = [523.25, 659.25, 783.99, 1046.50]; // 도-미-솔-높은도
    chords.forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
      osc.connect(gain).connect(output(ctx));
      osc.start(start);
      osc.stop(start + 0.46);
    });
  },

  // 9. 회복약 / 물약 치유 (반짝이는 글리산도 요정음)
  heal() {
    if (isMuted) return;
    const ctx = getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.22);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain).connect(output(ctx));
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  },

  // 10. 몬스터 처치 / 보스 승리 (묵직한 소멸 진동)
  monsterDeath() {
    if (isMuted) return;
    const ctx = getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(output(ctx));
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  },

  // 11. 일반 UI 클릭 / 턴 종료
  click() {
    if (isMuted) return;
    const ctx = getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(540, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain).connect(output(ctx));
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  },
  confirm() {
    this.click();
  },
  purchase() {
    this.click();
  }
};
