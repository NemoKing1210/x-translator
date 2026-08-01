/**
 * Translation provider registry: ids, labels, and settings fields.
 * Field `type`: text | password | url | select
 */

export const PROVIDER_IDS = Object.freeze([
  'google',
  'deepl',
  'microsoft',
  'openai',
  'yandex',
  'libretranslate',
]);

/** @typedef {{ name: string, key: string, value: string }} ProviderSelectOption */
/** @typedef {{
 *   key: string,
 *   type: 'text' | 'password' | 'url' | 'select',
 *   labelKey: string,
 *   hintKey?: string,
 *   placeholder?: string,
 *   required?: boolean,
 *   options?: ProviderSelectOption[],
 * }} ProviderField */

/** @type {ReadonlyArray<{
 *   id: string,
 *   name: string,
 *   badge: string,
 *   hintKey: string,
 *   fields: ProviderField[],
 * }>} */
export const TRANSLATION_PROVIDERS = Object.freeze([
  {
    id: 'google',
    name: 'Google Translate',
    badge: 'Google',
    hintKey: 'providerHintGoogle',
    fields: [],
  },
  {
    id: 'deepl',
    name: 'DeepL',
    badge: 'DeepL',
    hintKey: 'providerHintDeepl',
    fields: [
      {
        key: 'apiKey',
        type: 'password',
        labelKey: 'providerFieldApiKey',
        hintKey: 'providerHintDeeplKey',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx',
        required: true,
      },
      {
        key: 'plan',
        type: 'select',
        labelKey: 'providerFieldDeeplPlan',
        options: [
          { value: 'free', labelKey: 'providerDeeplPlanFree' },
          { value: 'pro', labelKey: 'providerDeeplPlanPro' },
        ],
      },
    ],
  },
  {
    id: 'microsoft',
    name: 'Microsoft Translator',
    badge: 'Azure',
    hintKey: 'providerHintMicrosoft',
    fields: [
      {
        key: 'apiKey',
        type: 'password',
        labelKey: 'providerFieldApiKey',
        required: true,
      },
      {
        key: 'region',
        type: 'text',
        labelKey: 'providerFieldRegion',
        hintKey: 'providerHintMicrosoftRegion',
        placeholder: 'global',
        required: true,
      },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    badge: 'OpenAI',
    hintKey: 'providerHintOpenai',
    fields: [
      {
        key: 'apiKey',
        type: 'password',
        labelKey: 'providerFieldApiKey',
        required: true,
      },
      {
        key: 'model',
        type: 'text',
        labelKey: 'providerFieldModel',
        placeholder: 'gpt-4o-mini',
      },
      {
        key: 'baseUrl',
        type: 'url',
        labelKey: 'providerFieldBaseUrl',
        hintKey: 'providerHintOpenaiBase',
        placeholder: 'https://api.openai.com/v1',
      },
    ],
  },
  {
    id: 'yandex',
    name: 'Yandex Translate',
    badge: 'Yandex',
    hintKey: 'providerHintYandex',
    fields: [
      {
        key: 'apiKey',
        type: 'password',
        labelKey: 'providerFieldApiKey',
        required: true,
      },
      {
        key: 'folderId',
        type: 'text',
        labelKey: 'providerFieldFolderId',
        hintKey: 'providerHintYandexFolder',
        required: true,
      },
    ],
  },
  {
    id: 'libretranslate',
    name: 'LibreTranslate',
    badge: 'Libre',
    hintKey: 'providerHintLibre',
    fields: [
      {
        key: 'apiUrl',
        type: 'url',
        labelKey: 'providerFieldApiUrl',
        placeholder: 'https://libretranslate.com',
        required: true,
      },
      {
        key: 'apiKey',
        type: 'password',
        labelKey: 'providerFieldApiKeyOptional',
      },
    ],
  },
]);

export const DEFAULT_PROVIDER_CONFIG = Object.freeze({
  google: {},
  deepl: { apiKey: '', plan: 'free' },
  microsoft: { apiKey: '', region: 'global' },
  openai: {
    apiKey: '',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
  },
  yandex: { apiKey: '', folderId: '' },
  libretranslate: {
    apiUrl: 'https://libretranslate.com',
    apiKey: '',
  },
});

export function getProvider(id) {
  return TRANSLATION_PROVIDERS.find((p) => p.id === id) || TRANSLATION_PROVIDERS[0];
}

export function isKnownProvider(id) {
  return PROVIDER_IDS.includes(id);
}

/** Merge saved providerConfig over defaults (per-provider shallow merge). */
export function mergeProviderConfig(raw) {
  const out = {};
  for (const id of PROVIDER_IDS) {
    out[id] = {
      ...DEFAULT_PROVIDER_CONFIG[id],
      ...(raw && typeof raw[id] === 'object' && raw[id] ? raw[id] : {}),
    };
  }
  return out;
}
