import { TRANSLATIONS } from './translations.js';

export { TRANSLATIONS };

export const SUPPORTED_LOCALES = ['en', 'ru', 'zh', 'es', 'pt', 'de', 'fr', 'ja'];

export const LOCALE_NATIVE_NAMES = {
  en: 'English',
  ru: 'Русский',
  zh: '中文',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
  fr: 'Français',
  ja: '日本語',
};

/** Representative country flags for the UI language picker (emoji). */
export const LOCALE_FLAGS = {
  en: '🇺🇸',
  ru: '🇷🇺',
  zh: '🇨🇳',
  es: '🇪🇸',
  pt: '🇧🇷',
  de: '🇩🇪',
  fr: '🇫🇷',
  ja: '🇯🇵',
};

export const LOCALE_FLAG_AUTO = '🌐';

export function detectLocale() {
  const raw = String(navigator.language || 'en').toLowerCase();
  const short = raw.slice(0, 2);
  return SUPPORTED_LOCALES.includes(short) ? short : 'en';
}

export function resolveLocale(pref) {
  const value = pref || 'auto';
  if (value !== 'auto' && SUPPORTED_LOCALES.includes(value)) return value;
  return detectLocale();
}

export function fmt(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] == null ? '' : String(vars[k])
  );
}

/** Resolve translation target: settings override or UI/browser locale. */
export function resolveTargetLang(pref, uiLocale) {
  if (pref && pref !== 'auto') {
    // Legacy settings stored bare `zh` before zh-CN / zh-TW split.
    if (pref === 'zh') return 'zh-CN';
    return pref;
  }
  const fromUi = uiLocale && uiLocale !== 'auto' ? uiLocale : detectLocale();
  if (fromUi === 'zh') return 'zh-CN';
  return fromUi || 'en';
}
