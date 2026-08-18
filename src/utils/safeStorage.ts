/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let isLocalStorageAvailable = false;
let realLocalStorage: Storage | null = null;

try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const testKey = '__safestorage_check__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    realLocalStorage = window.localStorage;
    isLocalStorageAvailable = true;
  }
} catch (e) {
  isLocalStorageAvailable = false;
}

const memoryStore: Record<string, string> = {};

export const safeLocalStorage = {
  getItem(key: string): string | null {
    if (isLocalStorageAvailable && realLocalStorage) {
      try {
        return realLocalStorage.getItem(key);
      } catch (e) {
        // Fallback
      }
    }
    return key in memoryStore ? memoryStore[key] : null;
  },

  setItem(key: string, value: string): void {
    if (isLocalStorageAvailable && realLocalStorage) {
      try {
        realLocalStorage.setItem(key, value);
        return;
      } catch (e) {
        // Fallback
      }
    }
    memoryStore[key] = String(value);
  },

  removeItem(key: string): void {
    if (isLocalStorageAvailable && realLocalStorage) {
      try {
        realLocalStorage.removeItem(key);
        return;
      } catch (e) {
        // Fallback
      }
    }
    delete memoryStore[key];
  },

  clear(): void {
    if (isLocalStorageAvailable && realLocalStorage) {
      try {
        realLocalStorage.clear();
        return;
      } catch (e) {
        // Fallback
      }
    }
    for (const k in memoryStore) {
      delete memoryStore[k];
    }
  },

  key(index: number): string | null {
    if (isLocalStorageAvailable && realLocalStorage) {
      try {
        return realLocalStorage.key(index);
      } catch (e) {
        // Fallback
      }
    }
    return Object.keys(memoryStore)[index] || null;
  },

  get length(): number {
    if (isLocalStorageAvailable && realLocalStorage) {
      try {
        return realLocalStorage.length;
      } catch (e) {
        // Fallback
      }
    }
    return Object.keys(memoryStore).length;
  }
};
