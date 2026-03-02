const memoryStore = new Map<string, string>();

export function safeGetItem(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) {
      return value;
    }
  } catch {
    // Ignore storage access errors.
  }
  return memoryStore.get(key) ?? null;
}

export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    memoryStore.delete(key);
    return true;
  } catch {
    memoryStore.set(key, value);
    return false;
  }
}

export function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    memoryStore.delete(key);
    return true;
  } catch {
    memoryStore.delete(key);
    return false;
  }
}

export function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__ip_watch_storage_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}
