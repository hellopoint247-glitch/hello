export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'hellopoint_theme_mode';

/**
 * Reads the stored theme mode or returns 'system' as default.
 */
export function getSavedThemeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch (e) {
    console.warn('Unable to read theme mode from storage', e);
  }
  return 'system';
}

/**
 * Calculates whether dark theme is effectively active.
 */
export function isDarkActive(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

/**
 * Applies the theme to documentElement with appropriate classes and data attributes.
 */
export function applyTheme(mode: ThemeMode): boolean {
  const isDark = isDarkActive(mode);
  const root = document.documentElement;
  
  if (isDark) {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  }

  // Update theme-color meta tag for mobile browsers (status bar)
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', isDark ? '#29384A' : '#6244a6');
  }

  return isDark;
}

/**
 * Saves and applies a theme mode.
 */
export function saveThemeMode(mode: ThemeMode): boolean {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch (e) {
    console.warn('Unable to save theme mode to storage', e);
  }
  const isDark = applyTheme(mode);
  window.dispatchEvent(new CustomEvent('hellopoint_theme_change', { detail: { mode, isDark } }));
  return isDark;
}
