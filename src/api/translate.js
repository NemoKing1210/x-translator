import { getCached, setCached } from '../cache.js';
import { getProvider, isKnownProvider } from '../providers/registry.js';
import { inflight, settings } from '../state.js';
import { translateWithDeepL } from './providers/deepl.js';
import { translateWithGoogle } from './providers/google.js';
import { translateWithLibreTranslate } from './providers/libretranslate.js';
import { translateWithMicrosoft } from './providers/microsoft.js';
import { translateWithOpenAI } from './providers/openai.js';
import { translateWithYandex } from './providers/yandex.js';

function cacheKey(providerId, text, targetLang) {
  return `tr:${providerId}:${targetLang}:${text}`;
}

function providerConfig(providerId) {
  const cfg = settings.providerConfig?.[providerId];
  return cfg && typeof cfg === 'object' ? cfg : {};
}

async function callProvider(providerId, text, targetLang) {
  const cfg = providerConfig(providerId);
  switch (providerId) {
    case 'deepl':
      return translateWithDeepL(text, targetLang, cfg);
    case 'microsoft':
      return translateWithMicrosoft(text, targetLang, cfg);
    case 'openai':
      return translateWithOpenAI(text, targetLang, cfg);
    case 'yandex':
      return translateWithYandex(text, targetLang, cfg);
    case 'libretranslate':
      return translateWithLibreTranslate(text, targetLang, cfg);
    case 'google':
    default:
      return translateWithGoogle(text, targetLang);
  }
}

/**
 * Translate text via the configured provider.
 * @param {string} text
 * @param {string} targetLang
 * @returns {Promise<{ text: string, detectedSourceLang: string | null, fromCache: boolean, provider: string }>}
 */
export async function translateText(text, targetLang) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    throw new Error('empty');
  }

  const providerId = isKnownProvider(settings.provider)
    ? settings.provider
    : getProvider('google').id;

  const key = cacheKey(providerId, trimmed, targetLang);
  const hit = getCached(key);
  if (hit && typeof hit === 'object' && hit.text) {
    return {
      text: hit.text,
      detectedSourceLang: hit.detectedSourceLang || null,
      fromCache: true,
      provider: providerId,
    };
  }

  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    const raw = await callProvider(providerId, trimmed, targetLang);
    const result = {
      text: raw.text,
      detectedSourceLang: raw.detectedSourceLang || null,
      fromCache: false,
      provider: providerId,
    };
    setCached(key, {
      text: result.text,
      detectedSourceLang: result.detectedSourceLang,
    });
    return result;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}
