const STORAGE_PREFIX = "harmony";
export const GUEST_SCOPE = "guest";

export function storageNamespace(scope = GUEST_SCOPE) {
  return `${STORAGE_PREFIX}:${scope || GUEST_SCOPE}:`;
}

export function scopedKey(scope, key) {
  return `${storageNamespace(scope)}${key}`;
}

export function createScopedStorage(storage, scope = GUEST_SCOPE) {
  const prefix = storageNamespace(scope);
  return Object.freeze({
    scope,
    prefix,
    getItem(key) {
      return storage.getItem(`${prefix}${key}`);
    },
    setItem(key, value) {
      storage.setItem(`${prefix}${key}`, String(value));
    },
    removeItem(key) {
      storage.removeItem(`${prefix}${key}`);
    },
    clear() {
      const keys = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key?.startsWith(prefix)) keys.push(key);
      }
      for (const key of keys) storage.removeItem(key);
    },
    key(index) {
      const keys = [];
      for (let cursor = 0; cursor < storage.length; cursor += 1) {
        const key = storage.key(cursor);
        if (key?.startsWith(prefix)) keys.push(key.slice(prefix.length));
      }
      return keys[index] ?? null;
    },
    get length() {
      let count = 0;
      for (let index = 0; index < storage.length; index += 1)
        if (storage.key(index)?.startsWith(prefix)) count += 1;
      return count;
    },
  });
}

export function migrateUnscopedGuestSave(storage, saveKeys) {
  const guest = createScopedStorage(storage, GUEST_SCOPE);
  let copied = 0;
  for (const key of saveKeys) {
    if (guest.getItem(key) !== null) continue;
    const legacy = storage.getItem(key);
    if (legacy === null) continue;
    guest.setItem(key, legacy);
    copied += 1;
  }
  return copied;
}
