import pkg from '../package.json' with { type: 'json' };
import { mergeProviderConfig } from './providers/registry.js';

export const REPO_URL = 'https://github.com/NemoKing1210/x-translator';
export const AUTHOR_NAME = 'NemoKing';
export const AUTHOR_HANDLE = 'NemoKing1210';
export const AUTHOR_EMAIL = 'nemoking1210@gmail.com';
export const AUTHOR_URL = 'https://github.com/NemoKing1210';
export const AUTHOR_AVATAR_URL =
  'https://avatars.githubusercontent.com/u/58397369?v=4';
export const SCRIPT_VERSION = pkg.version;
export const SETTINGS_KEY = 'xt_settings';
export const CACHE_KEY = 'xt_cache_v1';
export const ROOT_ATTR = 'data-xt-root';
export const POST_ATTR = 'data-xt-post';
export const BTN_ATTR = 'data-xt-btn';
export const RESULT_ATTR = 'data-xt-result';
export const TOOLBAR_ATTR = 'data-xt-toolbar';
export const NAV_BTN_ATTR = 'data-xt-nav';
export const MENU_ATTR = 'data-xt-menu';

export const SCAN_DEBOUNCE_MS = 350;
export const CACHE_HOURS_MAX = 168;
/** Soft advisory budget for the settings meter (GM storage has no fixed quota). */
export const CACHE_SOFT_LIMIT_BYTES = 2 * 1024 * 1024;
/** Max parallel auto-translations while scrolling the feed. */
export const AUTO_TRANSLATE_MAX_INFLIGHT = 2;

/** Google Translate free endpoint (no API key). */
export const GOOGLE_TRANSLATE_URL =
  'https://translate.googleapis.com/translate_a/single';

/**
 * X/Twitter tweet body nodes (posts + replies/comments share the same test id).
 * Prefer stable data-testid; the web client DOM changes often — adjust here
 * when selectors break.
 *
 * Quoted tweets nest another `[data-testid="tweetText"]` inside the outer
 * article; each gets its own toolbar.
 */
export const POST_TEXT_SELECTORS = [
  '[data-testid="tweetText"]',
];

/**
 * Target languages for post translation (Google Translate codes).
 * `name` is the native / common full label shown in Settings.
 */
export const TARGET_LANGUAGES = Object.freeze([
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'be', name: 'Беларуская', flag: '🇧🇾' },
  { code: 'zh-CN', name: '中文（简体）', flag: '🇨🇳' },
  { code: 'zh-TW', name: '中文（繁體）', flag: '🇹🇼' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'he', name: 'עברית', flag: '🇮🇱' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'bn', name: 'বাংলা', flag: '🇧🇩' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'no', name: 'Norsk', flag: '🇳🇴' },
  { code: 'da', name: 'Dansk', flag: '🇩🇰' },
  { code: 'fi', name: 'Suomi', flag: '🇫🇮' },
  { code: 'cs', name: 'Čeština', flag: '🇨🇿' },
  { code: 'sk', name: 'Slovenčina', flag: '🇸🇰' },
  { code: 'ro', name: 'Română', flag: '🇷🇴' },
  { code: 'hu', name: 'Magyar', flag: '🇭🇺' },
  { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'bg', name: 'Български', flag: '🇧🇬' },
  { code: 'sr', name: 'Српски', flag: '🇷🇸' },
  { code: 'hr', name: 'Hrvatski', flag: '🇭🇷' },
  { code: 'lt', name: 'Lietuvių', flag: '🇱🇹' },
  { code: 'lv', name: 'Latviešu', flag: '🇱🇻' },
  { code: 'et', name: 'Eesti', flag: '🇪🇪' },
  { code: 'fa', name: 'فارسی', flag: '🇮🇷' },
]);

export const DEFAULT_SETTINGS = {
  cacheHours: 24,
  uiLocale: 'auto',
  targetLang: 'auto',
  /** 'button' = Translate on click; 'auto' = translate when post enters the viewport */
  translateMode: 'button',
  /** 'panel' = result below post; 'replace' = swap post text in place */
  displayMode: 'panel',
  /**
   * When displayMode is replace:
   * 'button' = Show original only;
   * 'hover' = peek original on hover;
   * 'split' = original + translation together
   */
  replaceReveal: 'button',
  /** 'all' = every visible post; 'allowlist' = only listed accounts */
  autoScope: 'all',
  autoAllowlist: [],
  /** Never show Translate / never auto-translate these accounts */
  accountBlocklist: [],
  /** If non-empty, only translate when detected source is in this list */
  langAllowlist: [],
  /** Skip translation when detected source is in this list */
  langBlocklist: [],
  provider: 'google',
  providerConfig: mergeProviderConfig(null),
};
