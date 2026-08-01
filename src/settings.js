import {
  GM_getValue,
  GM_setValue,
} from '$';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from './constants.js';
import { isKnownProvider, mergeProviderConfig } from './providers/registry.js';
import { normalizeHandleList, normalizeLangList } from './utils/lists.js';

const REPLACE_REVEAL = new Set(['button', 'hover', 'split']);

function normalizeSettings(raw) {
  const base = raw && typeof raw === 'object' ? raw : {};
  const merged = { ...DEFAULT_SETTINGS, ...base };
  merged.provider = isKnownProvider(merged.provider) ? merged.provider : 'google';
  merged.providerConfig = mergeProviderConfig(base.providerConfig);
  merged.translateMode = merged.translateMode === 'auto' ? 'auto' : 'button';
  merged.displayMode = merged.displayMode === 'replace' ? 'replace' : 'panel';
  merged.replaceReveal = REPLACE_REVEAL.has(merged.replaceReveal)
    ? merged.replaceReveal
    : 'button';
  merged.autoScope = merged.autoScope === 'allowlist' ? 'allowlist' : 'all';
  merged.autoAllowlist = normalizeHandleList(merged.autoAllowlist);
  merged.accountBlocklist = normalizeHandleList(merged.accountBlocklist);
  merged.langAllowlist = normalizeLangList(merged.langAllowlist);
  merged.langBlocklist = normalizeLangList(merged.langBlocklist);
  delete merged.debugMode;
  delete merged.autoDetectSkipSameLang;
  return merged;
}

export function loadSettings() {
  try {
    const raw = GM_getValue(SETTINGS_KEY, null);
    return normalizeSettings(raw);
  } catch (_) {
    return normalizeSettings(null);
  }
}

export function saveSettings(next) {
  const merged = normalizeSettings(next);
  GM_setValue(SETTINGS_KEY, merged);
}
