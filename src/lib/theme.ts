export type Theme = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'matlogg.theme';
const COLORS = { light: '#f4f5f2', dark: '#0e1110' } as const;

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
  }
  return 'auto';
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function resolvedTheme(theme: Theme = getTheme()): 'light' | 'dark' {
  if (theme !== 'auto') return theme;
  return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

// One theme-color tag with the resolved color: some Android browsers ignore `media` on theme-color,
// so the system bars would otherwise stay on the light color in dark mode.
export function applyTheme(theme: Theme = getTheme()) {
  const root = document.documentElement;
  if (theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = theme;
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  metas.forEach((m, i) => i > 0 && m.remove());
  let meta = metas[0];
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  meta.removeAttribute('media');
  meta.content = COLORS[resolvedTheme(theme)];
}

let watching = false;

// Follow live system light/dark switches while the theme is on Auto.
export function watchSystemTheme() {
  if (watching || typeof matchMedia !== 'function') return;
  watching = true;
  matchMedia(DARK_QUERY).addEventListener('change', () => {
    if (getTheme() === 'auto') applyTheme('auto');
  });
}

export function setTheme(theme: Theme) {
  try {
    if (theme === 'auto') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
  }
  applyTheme(theme);
}
