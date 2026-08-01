import { saveSettings } from '../settings.js';
import { reloadRuntimeSettings, settings } from '../state.js';
import { normalizeHandle } from '../utils/handle.js';
import { isAccountBlocked } from './filters.js';

export function getAutoAllowlist() {
  return Array.isArray(settings.autoAllowlist) ? [...settings.autoAllowlist] : [];
}

export function isInAutoAllowlist(handle) {
  const h = normalizeHandle(handle);
  if (!h) return false;
  return getAutoAllowlist().includes(h);
}

function persist(list, extras = {}) {
  saveSettings({
    ...settings,
    ...extras,
    autoAllowlist: [...new Set(list.map(normalizeHandle).filter(Boolean))].sort(),
  });
  reloadRuntimeSettings();
  return getAutoAllowlist();
}

export function setAutoAllowlist(list) {
  return persist(list);
}

export function addAutoAllowlistHandle(handle) {
  const h = normalizeHandle(handle);
  if (!h) return { ok: false, reason: 'invalid' };
  const list = getAutoAllowlist();
  if (list.includes(h)) return { ok: false, reason: 'exists', handle: h };
  persist([...list, h]);
  return { ok: true, handle: h, added: true };
}

export function removeAutoAllowlistHandle(handle) {
  const h = normalizeHandle(handle);
  if (!h) return { ok: false, reason: 'invalid' };
  const list = getAutoAllowlist().filter((item) => item !== h);
  persist(list);
  return { ok: true, handle: h, removed: true };
}

export function toggleAutoAllowlistHandle(handle) {
  if (isInAutoAllowlist(handle)) {
    return { ...removeAutoAllowlistHandle(handle), added: false };
  }
  return addAutoAllowlistHandle(handle);
}

/** Whether this author is eligible for automatic translation. */
export function isAutoTranslateAllowedForHandle(handle) {
  if (settings.translateMode !== 'auto') return false;
  if (isAccountBlocked(handle)) return false;
  if (settings.autoScope !== 'allowlist') return true;
  return isInAutoAllowlist(handle);
}
