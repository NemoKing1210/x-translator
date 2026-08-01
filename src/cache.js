import {
  GM_getValue,
  GM_setValue,
} from '$';
import {
  CACHE_HOURS_MAX,
  CACHE_KEY,
  CACHE_SOFT_LIMIT_BYTES,
} from './constants.js';
import { fmt } from './i18n/index.js';
import {
  cachePersistTimer,
  cacheStore,
  setCachePersistTimer,
  setCacheStore,
  settings,
  t,
} from './state.js';
import { escapeAttr, escapeHtml } from './utils/html.js';

export function readCacheStore() {
  if (cacheStore) return cacheStore;
  try {
    const raw = GM_getValue(CACHE_KEY, null);
    setCacheStore(raw && typeof raw === 'object' ? raw : {});
  } catch (_) {
    setCacheStore({});
  }
  return cacheStore;
}

export function persistCacheSoon() {
  clearTimeout(cachePersistTimer);
  setCachePersistTimer(
    setTimeout(() => {
      try {
        pruneExpiredCache();
        evictCacheToBudget();
        GM_setValue(CACHE_KEY, readCacheStore());
      } catch (_) {
        /* ignore */
      }
    }, 400)
  );
}

export function cacheTtlMs() {
  const hours = Number(settings.cacheHours);
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.min(hours, CACHE_HOURS_MAX) * 3600 * 1000;
}

export function getCached(key) {
  const store = readCacheStore();
  const entry = store[key];
  if (!entry || typeof entry !== 'object') return null;
  const ttl = cacheTtlMs();
  if (ttl <= 0) return null;
  const age = Date.now() - (entry.at || 0);
  if (age > ttl) {
    delete store[key];
    persistCacheSoon();
    return null;
  }
  entry.at = Date.now();
  persistCacheSoon();
  return entry.value;
}

export function setCached(key, value) {
  if (cacheTtlMs() <= 0) return;
  const store = readCacheStore();
  store[key] = { value, at: Date.now() };
  persistCacheSoon();
}

export function clearCache() {
  setCacheStore({});
  try {
    GM_setValue(CACHE_KEY, {});
  } catch (_) {
    /* ignore */
  }
}

export function pruneExpiredCache() {
  const store = readCacheStore();
  const ttl = cacheTtlMs();
  if (ttl <= 0) {
    for (const key of Object.keys(store)) delete store[key];
    return;
  }
  const now = Date.now();
  for (const [key, entry] of Object.entries(store)) {
    if (!entry || typeof entry !== 'object') {
      delete store[key];
      continue;
    }
    if (now - (entry.at || 0) > ttl) delete store[key];
  }
}

function approxBytes(store) {
  try {
    return JSON.stringify(store).length * 2;
  } catch (_) {
    return 0;
  }
}

function cacheEntryByteSize(key, entry) {
  try {
    return (JSON.stringify(key).length + JSON.stringify(entry).length) * 2;
  } catch (_) {
    return 0;
  }
}

export function evictCacheToBudget() {
  const store = readCacheStore();
  let size = approxBytes(store);
  if (size <= CACHE_SOFT_LIMIT_BYTES) return;
  const entries = Object.entries(store).sort(
    (a, b) => (a[1]?.at || 0) - (b[1]?.at || 0)
  );
  for (const [key] of entries) {
    delete store[key];
    size = approxBytes(store);
    if (size <= CACHE_SOFT_LIMIT_BYTES * 0.85) break;
  }
}

export function formatCacheBytes(n) {
  const bytes = Math.max(0, Number(n) || 0);
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getCacheUsageStats() {
  const store = readCacheStore();
  let usedBytes = 0;
  let entryCount = 0;
  for (const key of Object.keys(store)) {
    usedBytes += cacheEntryByteSize(key, store[key]);
    entryCount += 1;
  }
  const limitBytes = CACHE_SOFT_LIMIT_BYTES;
  const freeBytes = Math.max(0, limitBytes - usedBytes);
  const pct = limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0;
  const ttlHours = Number(settings.cacheHours);
  const enabled = Number.isFinite(ttlHours) && ttlHours > 0;
  return {
    usedBytes,
    freeBytes,
    limitBytes,
    entryCount,
    pct,
    ttlHours: enabled ? Math.min(ttlHours, CACHE_HOURS_MAX) : 0,
    enabled,
  };
}

/**
 * Soft fill level for progress bar coloring.
 * @returns {'ok' | 'warn' | 'high' | 'off'}
 */
export function cacheFillLevel(stats) {
  const s = stats || getCacheUsageStats();
  if (!s.enabled) return 'off';
  if (s.pct >= 85) return 'high';
  if (s.pct >= 60) return 'warn';
  return 'ok';
}

export function buildCacheMeterHtml(stats) {
  const s = stats || getCacheUsageStats();
  const level = cacheFillLevel(s);
  const pctLabel = `${s.pct < 10 && s.pct > 0 ? s.pct.toFixed(1) : Math.round(s.pct)}%`;
  const usedLine = fmt(t.cacheMeterUsed, {
    used: formatCacheBytes(s.usedBytes),
    limit: formatCacheBytes(s.limitBytes),
  });
  const entriesLine = fmt(t.cacheMeterEntries, { count: s.entryCount });
  const ttlLine = s.enabled
    ? fmt(t.cacheMeterTtl, { hours: s.ttlHours })
    : t.cacheMeterDisabled;
  const freeLine = fmt(t.cacheMeterFree, { free: formatCacheBytes(s.freeBytes) });
  const aria = fmt(t.cacheMeterAria, {
    used: formatCacheBytes(s.usedBytes),
    limit: formatCacheBytes(s.limitBytes),
    pct: pctLabel,
    count: s.entryCount,
  });

  return `
    <div class="xt-cache-meter" data-xt-cache-meter data-level="${escapeAttr(level)}">
      <div class="xt-cache-meter__top">
        <div class="xt-cache-meter__title">${escapeHtml(t.cacheMeterTitle)}</div>
        <div class="xt-cache-meter__pct">${escapeHtml(pctLabel)}</div>
      </div>
      <div class="xt-cache-meter__used">${escapeHtml(usedLine)}</div>
      <div
        class="xt-cache-meter__bar"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="${escapeAttr(String(Math.round(s.pct)))}"
        aria-label="${escapeAttr(aria)}"
      >
        <span class="xt-cache-meter__fill" style="width:${Math.max(s.pct > 0 ? 1.5 : 0, s.pct)}%"></span>
      </div>
      <div class="xt-cache-meter__meta">
        <span>${escapeHtml(entriesLine)}</span>
        <span class="xt-cache-meter__dot" aria-hidden="true">·</span>
        <span>${escapeHtml(ttlLine)}</span>
        <span class="xt-cache-meter__dot" aria-hidden="true">·</span>
        <span>${escapeHtml(freeLine)}</span>
      </div>
      <p class="xt-cache-meter__hint">${escapeHtml(t.cacheMeterHint)}</p>
    </div>
  `;
}

export function paintCacheMeter(root) {
  const current = root?.querySelector?.('[data-xt-cache-meter]');
  if (!current) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = buildCacheMeterHtml(getCacheUsageStats()).trim();
  const next = wrap.firstElementChild;
  if (next) current.replaceWith(next);
}
