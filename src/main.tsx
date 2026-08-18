// Safe Guard for access-denied/sandboxed localStorage and sessionStorage
(function() {
  if (typeof window !== 'undefined') {
    let localStorageSafe = false;
    try {
      if (window.localStorage) {
        const test = '__safetest__';
        window.localStorage.setItem(test, test);
        window.localStorage.removeItem(test);
        localStorageSafe = true;
      }
    } catch (e) {
      localStorageSafe = false;
    }

    if (!localStorageSafe) {
      const store: Record<string, string> = {};
      const mockStorage = {
        getItem: (key: string): string | null => (key in store ? store[key] : null),
        setItem: (key: string, value: string): void => { store[key] = String(value); },
        removeItem: (key: string): void => { delete store[key]; },
        clear: (): void => { for (const k in store) delete store[k]; },
        key: (idx: number): string | null => Object.keys(store)[idx] || null,
        get length(): number { return Object.keys(store).length; }
      };
      try {
        Object.defineProperty(window, 'localStorage', { value: mockStorage, configurable: true, writable: true });
      } catch (err) {
        try {
          (window as any).localStorage = mockStorage;
        } catch (err2) {
          console.warn('Unable to polyfill localStorage', err2);
        }
      }
    }

    let sessionStorageSafe = false;
    try {
      if (window.sessionStorage) {
        const test = '__safetest_sess__';
        window.sessionStorage.setItem(test, test);
        window.sessionStorage.removeItem(test);
        sessionStorageSafe = true;
      }
    } catch (e) {
      sessionStorageSafe = false;
    }

    if (!sessionStorageSafe) {
      const store: Record<string, string> = {};
      const mockSessionStorage = {
        getItem: (key: string): string | null => (key in store ? store[key] : null),
        setItem: (key: string, value: string): void => { store[key] = String(value); },
        removeItem: (key: string): void => { delete store[key]; },
        clear: (): void => { for (const k in store) delete store[k]; },
        key: (idx: number): string | null => Object.keys(store)[idx] || null,
        get length(): number { return Object.keys(store).length; }
      };
      try {
        Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage, configurable: true, writable: true });
      } catch (err) {
        try {
          (window as any).sessionStorage = mockSessionStorage;
        } catch (err2) {
          console.warn('Unable to polyfill sessionStorage', err2);
        }
      }
    }
  }
})();

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
