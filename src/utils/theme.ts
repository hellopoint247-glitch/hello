export type ThemeMode = 'dark';

export const THEME_STORAGE_KEY = 'hellopoint_theme_mode';

/**
 * Built-in eye-comfort soft dark theme (আলকা ডার্ক).
 * Eliminates screen glare for long hours of accounting work.
 */
export function getSavedThemeMode(): ThemeMode {
  return 'dark';
}

export function isDarkActive(_mode?: any): boolean {
  return true;
}

/**
 * Applies the built-in eye-comfort soft dark theme to documentElement.
 */
export function applyTheme(_mode?: any): boolean {
  if (typeof document === 'undefined') return true;
  const root = document.documentElement;
  root.classList.add('dark');
  root.setAttribute('data-theme', 'dark');
  root.removeAttribute('data-neon-style');

  // Update theme-color meta tag for mobile browsers (status bar)
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', '#1a2232');
  }

  return true;
}

export function saveThemeMode(_mode?: any): boolean {
  return applyTheme();
}
