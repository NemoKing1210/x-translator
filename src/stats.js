import {
  GM_getValue,
  GM_setValue,
} from '$';
import { STATS_KEY } from './constants.js';

/** @typedef {{ translations: number, cacheHits: number, cacheMisses: number }} TranslateStats */

/** @returns {TranslateStats} */
function emptyStats() {
  return { translations: 0, cacheHits: 0, cacheMisses: 0 };
}

/** @param {unknown} raw @returns {TranslateStats} */
function normalizeStats(raw) {
  const base = raw && typeof raw === 'object' ? raw : {};
  const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? Math.floor(x) : 0;
  };
  return {
    translations: n(base.translations),
    cacheHits: n(base.cacheHits),
    cacheMisses: n(base.cacheMisses),
  };
}

/** @returns {TranslateStats} */
export function getTranslateStats() {
  try {
    return normalizeStats(GM_getValue(STATS_KEY, null));
  } catch {
    return emptyStats();
  }
}

/** @param {TranslateStats} next */
function writeStats(next) {
  try {
    GM_setValue(STATS_KEY, normalizeStats(next));
  } catch {
    /* ignore */
  }
}

/** @param {{ fromCache: boolean }} info */
export function recordTranslation(info) {
  const stats = getTranslateStats();
  stats.translations += 1;
  if (info.fromCache) stats.cacheHits += 1;
  else stats.cacheMisses += 1;
  writeStats(stats);
  return stats;
}

export function resetTranslateStats() {
  writeStats(emptyStats());
  return emptyStats();
}

/** @param {TranslateStats} [stats] */
export function getCacheHitRate(stats = getTranslateStats()) {
  const total = stats.cacheHits + stats.cacheMisses;
  if (total <= 0) return 0;
  return Math.round((stats.cacheHits / total) * 1000) / 10;
}
