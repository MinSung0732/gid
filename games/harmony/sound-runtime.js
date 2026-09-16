function browserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function browserAudioFactory(source) {
  if (typeof Audio === "undefined") return null;
  return new Audio(source);
}

export function createSoundRuntime({
  storage = browserStorage(),
  createAudio = browserAudioFactory,
} = {}) {
  function storedValue(key) {
    try {
      return storage?.getItem?.(key) ?? null;
    } catch {
      return null;
    }
  }

  function storeValue(key, value) {
    try {
      storage?.setItem?.(key, String(value));
    } catch {
      // Runtime settings remain active in memory when storage is unavailable.
    }
  }

  return {
    loadSettings({ muteKey, volumeKey, defaultVolume = 80 }) {
      const storedVolume = storedValue(volumeKey),
        parsedVolume = Number(storedVolume);
      return {
        muted: storedValue(muteKey) === "true",
        volume: storedVolume !== null
          && Number.isFinite(parsedVolume)
          && parsedVolume >= 0
          && parsedVolume <= 100
          ? parsedVolume
          : defaultVolume,
      };
    },
    storeMuted(key, muted) {
      storeValue(key, Boolean(muted));
    },
    storeVolume(key, volume) {
      storeValue(key, volume);
    },
    createPlayer(source) {
      return typeof createAudio === "function" ? createAudio(source) : null;
    },
  };
}
