/**
 * X sets theme via color-scheme / background on <html>, and sometimes
 * `data-color-mode` / class tokens. Mirror into data-xt-theme for our UI.
 */

const THEME_ATTR = 'data-xt-theme';

function luminanceFromRgb(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function parseBgLuminance(bg) {
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return null;
  const rgb = bg.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!rgb) return null;
  return luminanceFromRgb(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
}

/** @returns {'light' | 'dark'} */
export function detectPageTheme() {
  const root = document.documentElement;
  const body = document.body;

  const explicit =
    root.getAttribute('data-color-mode') ||
    root.getAttribute('data-theme') ||
    body?.getAttribute?.('data-color-mode') ||
    body?.getAttribute?.('data-theme');
  if (explicit === 'light' || explicit === 'dark') return explicit;

  const scheme = getComputedStyle(root).colorScheme || '';
  if (/\blight\b/i.test(scheme) && !/\bdark\b/i.test(scheme)) return 'light';
  if (/\bdark\b/i.test(scheme) && !/\blight\b/i.test(scheme)) return 'dark';

  for (const el of [body, root]) {
    if (!el) continue;
    const lum = parseBgLuminance(getComputedStyle(el).backgroundColor);
    if (lum == null) continue;
    return lum > 0.55 ? 'light' : 'dark';
  }

  if (window.matchMedia?.('(prefers-color-scheme: light)')?.matches) return 'light';
  return 'dark';
}

export function applyPageTheme(theme = detectPageTheme()) {
  const next = theme === 'light' ? 'light' : 'dark';
  if (document.documentElement.getAttribute(THEME_ATTR) !== next) {
    document.documentElement.setAttribute(THEME_ATTR, next);
  }
  return next;
}

/** Watch X theme flips on <html>/<body>. */
export function observePageTheme(onChange) {
  let last = applyPageTheme();
  onChange?.(last);

  const run = () => {
    const next = applyPageTheme();
    if (next !== last) {
      last = next;
      onChange?.(next);
    }
  };

  const observer = new MutationObserver(run);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-color-mode', 'data-theme'],
  });
  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-color-mode', 'data-theme'],
    });
  }

  const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
  mql?.addEventListener?.('change', run);

  return () => {
    observer.disconnect();
    mql?.removeEventListener?.('change', run);
  };
}
