import { languageDisplayName } from '../api/lang.js';
import { translateText } from '../api/translate.js';
import {
  AUTO_TRANSLATE_MAX_INFLIGHT,
  BTN_ATTR,
  NATIVE_AUTO_TRANSLATE_ICON_PATH,
  POST_ATTR,
  POST_TEXT_SELECTORS,
  QUOTE_HEADER_ROW_SELECTOR,
  RESULT_ATTR,
  TARGET_LANGUAGES,
  TOOLBAR_ATTR,
} from '../constants.js';
import { fmt, resolveTargetLang } from '../i18n/index.js';
import { locale, settings, t } from '../state.js';
import { escapeHtml } from '../utils/html.js';
import { extractLinkedText, hasTranslatablePlainText, restoreLinkedHtml } from '../utils/linked-text.js';
import { normalizeLangCode } from '../utils/lists.js';
import { ICONS } from '../ui/icons.js';
import { isAutoTranslateAllowedForHandle } from './allowlist.js';
import { getQuoteCard, getTweetArticle, resolvePostAuthorHandle } from './author.js';
import { getLanguageSkipReason, isAccountBlocked } from './filters.js';

/** Stop X’s post-open handlers without killing our own click. */
const QUIET_POINTER_EVENTS = [
  'auxclick',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'touchstart',
  'touchend',
];

const OBSERVED_ATTR = 'data-xt-observed';
const AUTO_DONE_ATTR = 'data-xt-auto-done';
const AUTO_QUEUED_ATTR = 'data-xt-auto-queued';
const ORIGINAL_HTML_ATTR = 'data-xt-original-html';
const TRANSLATED_HTML_ATTR = 'data-xt-translated-html';
const SOURCE_LANG_ATTR = 'data-xt-source-lang';
const PEEK_BOUND_ATTR = 'data-xt-peek-bound';

/** @type {IntersectionObserver | null} */
let visibilityObserver = null;
let autoInflight = 0;
/** @type {HTMLElement[]} */
const autoQueue = [];

function isAutoMode() {
  return settings.translateMode === 'auto';
}

function isReplaceMode() {
  return settings.displayMode === 'replace';
}

function replaceRevealMode() {
  const mode = settings.replaceReveal;
  if (mode === 'hover' || mode === 'split') return mode;
  return 'button';
}

/** Replace + hover: peek replaces Show original — hide the toolbar button while shown. */
function shouldHideShownReplaceButton() {
  return isReplaceMode() && replaceRevealMode() === 'hover';
}

function syncToolbarVisibility(postEl) {
  const bar = getToolbar(postEl);
  if (!bar) return;
  const btnInBar = bar.querySelector(`[${BTN_ATTR}]`);
  const hasResult = Boolean(bar.querySelector(`[${RESULT_ATTR}]`));
  const hideBar = Boolean(!btnInBar || btnInBar.hidden) && !hasResult;
  bar.classList.toggle('xt-toolbar--quiet', hideBar);
}

function clearButtonLoading(btn) {
  btn.classList.remove('is-loading');
  btn.disabled = false;
  btn.removeAttribute('aria-busy');
}

function applyShownButton(btn, postEl) {
  btn.dataset.xtState = 'shown';
  if (shouldHideShownReplaceButton()) {
    clearButtonLoading(btn);
    btn.hidden = true;
    syncToolbarVisibility(postEl);
    return;
  }
  btn.hidden = false;
  setButtonLabel(btn, isReplaceMode() ? t.btnShowOriginal : t.btnHide);
  syncToolbarVisibility(postEl);
}

function applyIdleButton(btn, postEl) {
  btn.dataset.xtState = '';
  btn.hidden = false;
  setButtonLabel(btn, t.btnTranslate);
  syncToolbarVisibility(postEl);
}

function shouldAutoTranslatePost(postEl) {
  if (!isAutoMode()) return false;
  if (shouldSkipForNativeAutoTranslate(postEl)) return false;
  const handle = resolvePostAuthorHandle(postEl);
  if (isAccountBlocked(handle)) return false;
  return isAutoTranslateAllowedForHandle(handle);
}

/** Aria-labels for X’s Show original / about-auto-translate (locale fallback). */
const NATIVE_AUTO_TRANSLATE_LABEL_RE =
  /^(show original|показать оригинал|mostrar (el )?original|afficher l['’]original|original anzeigen|mostra (l['’])?originale|オリジナルを表示|显示原文|顯示原文|mostrar original|about automatic translation|об автоматическом переводе|acerca de la traducci[oó]n autom[aá]tica|à propos de la traduction automatique|informationen zur automatischen [üu]bersetzung|informazioni sulla traduzione automatica|自動翻訳について|关于自动翻译|關於自動翻譯|sobre a tradu[cç][aã]o autom[aá]tica)$/i;

function isOurTranslateChrome(el) {
  return Boolean(
    el?.closest?.(
      `[${TOOLBAR_ATTR}], [${BTN_ATTR}], [${RESULT_ATTR}], .xt-header-action, .xt-btn`
    )
  );
}

/** Native auto-translate bar lives as a sibling under a shared parent with tweet text. */
function isNativeAutoTranslateChrome(root) {
  if (!root || !(root instanceof Element) || isOurTranslateChrome(root)) return false;
  // Never treat another tweet body / nested quote as this post’s bar.
  if (root.getAttribute?.('data-testid') === 'tweetText') return false;
  if (root.querySelector?.(':scope > [data-testid="tweetText"]')) return false;
  if (root.matches?.('[data-testid="quoteTweet"]')) return false;

  for (const path of root.querySelectorAll('svg path[d]')) {
    if (isOurTranslateChrome(path)) continue;
    if ((path.getAttribute('d') || '').includes(NATIVE_AUTO_TRANSLATE_ICON_PATH)) {
      return true;
    }
  }

  for (const btn of root.querySelectorAll('button[aria-label]')) {
    if (isOurTranslateChrome(btn)) continue;
    const label = (btn.getAttribute('aria-label') || '').trim();
    if (NATIVE_AUTO_TRANSLATE_LABEL_RE.test(label)) return true;
  }
  return false;
}

/**
 * Collect previous/next element siblings of `node` (near tweet text only).
 * X places its auto-translate bar as a *previous* sibling of tweetText;
 * Grok in the header reuses the same SVG glyph — do not scan the whole article.
 */
function eachNearbySibling(node, visit) {
  for (const prop of ['previousElementSibling', 'nextElementSibling']) {
    let sib = node[prop];
    while (sib) {
      if (visit(sib) === true) return true;
      sib = sib[prop];
    }
  }
  return false;
}

/**
 * X already shows its machine-translation bar for this post/reply.
 */
function hasNativeXAutoTranslate(postEl) {
  const quote = getQuoteCard(postEl);
  const article = getTweetArticle(postEl);
  const boundary = quote || article;
  if (!boundary) return false;

  let node = postEl;
  for (let depth = 0; depth < 6 && node && boundary.contains(node); depth += 1) {
    const hit = eachNearbySibling(node, (sib) => {
      if (sib === postEl || sib.contains?.(postEl)) return false;
      if (sib.getAttribute?.('data-testid') === 'tweetText') return false;
      if (!quote && sib.matches?.('[data-testid="quoteTweet"]')) return false;
      // Stay in the text column — skip header chrome (Grok uses the same glyph).
      if (sib.querySelector?.('[data-testid="User-Name"], [data-testid="caret"]')) {
        return false;
      }
      return isNativeAutoTranslateChrome(sib);
    });
    if (hit) return true;
    if (node === boundary) break;
    node = node.parentElement;
  }
  return false;
}

function shouldSkipForNativeAutoTranslate(postEl) {
  return settings.skipNativeAutoTranslate !== false && hasNativeXAutoTranslate(postEl);
}

function findPostTextRoots(root = document) {
  const seen = new Set();
  const nodes = [];
  const primarySel = POST_TEXT_SELECTORS[0];
  for (const sel of POST_TEXT_SELECTORS) {
    root.querySelectorAll(sel).forEach((el) => {
      if (seen.has(el)) return;
      // Only real timeline / thread tweets — skip composer and other chrome.
      if (!el.closest?.('article[data-testid="tweet"]')) return;
      const nestedParent = el.parentElement?.closest?.(primarySel);
      if (nestedParent && nestedParent !== el) return;
      seen.add(el);
      nodes.push(el);
    });
  }
  return nodes;
}

function isInQuoteEmbed(el, article) {
  if (!el || !article) return false;
  const quote = el.closest('[data-testid="quoteTweet"]');
  return Boolean(quote && article.contains(quote));
}

/**
 * Quote embeds have no Grok / caret — append the control as a *direct child*
 * of the quote header row (avatar | User-Name).
 * @returns {{ row: Element, before: Element | null } | null}
 */
function findQuoteHeaderActionsSlot(postEl) {
  const quote = getQuoteCard(postEl);
  if (!quote) return null;

  const isQuoteHeaderRow = (el) =>
    Boolean(
      el?.querySelector?.('[data-testid="Tweet-User-Avatar"]') &&
        el?.querySelector?.('[data-testid="User-Name"]') &&
        !el.querySelector?.('[data-testid="tweetText"]')
    );

  const bySelector = [...quote.querySelectorAll(QUOTE_HEADER_ROW_SELECTOR)].find(
    isQuoteHeaderRow
  );
  if (bySelector) return { row: bySelector, before: null };

  // Structural fallback when X renames atomic row classes.
  const userName = quote.querySelector('[data-testid="User-Name"]');
  if (!userName) return null;
  let node = userName.parentElement;
  while (node && node !== quote) {
    if (isQuoteHeaderRow(node)) {
      const style = getComputedStyle(node);
      const isRow =
        (style.display === 'flex' || style.display === 'inline-flex') &&
        String(style.flexDirection || 'row').startsWith('row');
      if (isRow) return { row: node, before: null };
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Tweet header actions row: Grok + caret (More).
 * Insert our control as a sibling before Grok (or before caret if no Grok).
 * Quote embeds: end of the quote header row (avatar + name).
 * @returns {{ row: Element, before: Element | null } | null}
 */
function findHeaderActionsSlot(postEl) {
  const quoteSlot = findQuoteHeaderActionsSlot(postEl);
  if (quoteSlot) return quoteSlot;

  if (getQuoteCard(postEl)) return null;

  const article = getTweetArticle(postEl);
  if (!article) return null;

  let grokBtn = null;
  for (const btn of article.querySelectorAll('button[aria-label]')) {
    if (isInQuoteEmbed(btn, article)) continue;
    if (/grok/i.test(btn.getAttribute('aria-label') || '')) {
      grokBtn = btn;
      break;
    }
  }

  if (grokBtn?.parentElement?.parentElement) {
    const wrap = grokBtn.parentElement;
    const row = wrap.parentElement;
    if (row && article.contains(row)) {
      return { row, before: wrap };
    }
  }

  const caret = [...article.querySelectorAll('[data-testid="caret"]')].find(
    (el) => !isInQuoteEmbed(el, article)
  );
  if (!caret) return null;

  let node = caret;
  while (node.parentElement && node.parentElement !== article) {
    const parent = node.parentElement;
    const style = getComputedStyle(parent);
    const isRow =
      (style.display === 'flex' || style.display === 'inline-flex') &&
      String(style.flexDirection || '').startsWith('row');
    if (isRow && parent.children.length >= 1 && parent.children.length <= 4) {
      const before = [...parent.children].find((child) => child.contains(caret));
      if (before) return { row: parent, before };
    }
    node = parent;
  }
  return null;
}

/**
 * Toolbar (result panel) placement:
 * - normal posts / replies: sibling after the text node
 * - quote embeds: last child of the quote card so media stays under the text
 */
function getToolbar(postEl) {
  const child = postEl.querySelector(`[${TOOLBAR_ATTR}]`);
  if (child) return child;
  const sib = postEl.nextElementSibling;
  if (sib?.hasAttribute?.(TOOLBAR_ATTR)) return sib;
  const quote = getQuoteCard(postEl);
  if (quote) {
    const owned = quote.querySelector(`[${TOOLBAR_ATTR}]`);
    if (owned) return owned;
  }
  return null;
}

function getTranslateButton(postEl) {
  const bar = getToolbar(postEl);
  const inBar = bar?.querySelector(`[${BTN_ATTR}]`);
  if (inBar) return inBar;

  const quote = getQuoteCard(postEl);
  if (quote) {
    return (
      quote.querySelector(`.xt-header-action [${BTN_ATTR}]`) ||
      quote.querySelector(`[${BTN_ATTR}][data-xt-header="1"]`)
    );
  }

  const article = getTweetArticle(postEl);
  if (!article) return null;
  return (
    article.querySelector(`.xt-header-action [${BTN_ATTR}]`) ||
    article.querySelector(`[${BTN_ATTR}][data-xt-header="1"]`)
  );
}

function placeToolbar(postEl, bar) {
  const quote = getQuoteCard(postEl);
  if (quote) {
    if (bar.parentElement !== quote || quote.lastElementChild !== bar) {
      quote.appendChild(bar);
    }
    return;
  }
  if (postEl.nextElementSibling !== bar) {
    postEl.insertAdjacentElement('afterend', bar);
  }
}

function placeTranslateButton(postEl, btn) {
  const slot = findHeaderActionsSlot(postEl);
  if (slot) {
    btn.classList.add('xt-btn--header');
    btn.setAttribute('data-xt-header', '1');

    let wrap = btn.closest('.xt-header-action');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'xt-header-action';
      wrap.appendChild(btn);
    } else if (btn.parentElement !== wrap) {
      wrap.appendChild(btn);
    }
    const inQuote = Boolean(getQuoteCard(postEl));
    wrap.classList.toggle('xt-header-action--quote', inQuote);

    // Quotes: always append as last *direct* child of the header row.
    if (inQuote || !slot.before) {
      if (wrap.parentElement !== slot.row || slot.row.lastElementChild !== wrap) {
        slot.row.appendChild(wrap);
      }
    } else if (
      wrap.parentElement !== slot.row ||
      wrap.nextElementSibling !== slot.before
    ) {
      slot.row.insertBefore(wrap, slot.before);
    }
    const label = btn.getAttribute('aria-label');
    if (label) btn.title = label;
    return;
  }

  // Fallback: under tweet text (missing header chrome).
  btn.classList.remove('xt-btn--header');
  btn.removeAttribute('data-xt-header');
  const orphanWrap = btn.closest('.xt-header-action');
  const bar = ensureToolbar(postEl);
  if (orphanWrap) {
    orphanWrap.replaceWith(btn);
  }
  if (btn.parentElement !== bar) {
    bar.insertBefore(btn, bar.firstChild);
  }
}

/** Clone of post text with toolbar chrome stripped (uses stored original when replaced). */
function clonePostContent(el) {
  const stored = el.getAttribute(ORIGINAL_HTML_ATTR);
  if (stored != null) {
    const tmp = document.createElement('div');
    tmp.innerHTML = stored;
    return tmp;
  }

  const clone = el.cloneNode(true);
  clone
    .querySelectorAll(`[${TOOLBAR_ATTR}], [${BTN_ATTR}], [${RESULT_ATTR}]`)
    .forEach((n) => n.remove());
  return clone;
}

/** Plain text for translate APIs, with anchors turned into stable tokens. */
function extractPostForTranslate(el) {
  return extractLinkedText(clonePostContent(el));
}

function postHasTranslatableContent(el) {
  const { text } = extractPostForTranslate(el);
  return hasTranslatablePlainText(text);
}

function teardownPostUi(el) {
  clearDisplay(el);
  const btn = getTranslateButton(el);
  const headerWrap = btn?.closest?.('.xt-header-action');
  getToolbar(el)?.remove();
  if (headerWrap) headerWrap.remove();
  else if (btn?.getAttribute?.('data-xt-header') === '1') btn.remove();
  el.removeAttribute(POST_ATTR);
  el.removeAttribute(OBSERVED_ATTR);
  el.removeAttribute(AUTO_DONE_ATTR);
  el.removeAttribute(AUTO_QUEUED_ATTR);
  try {
    visibilityObserver?.unobserve(el);
  } catch {
    /* ignore */
  }
}

function restoreOriginalText(postEl) {
  hideFloatingPeekBadge(postEl);
  const stored = postEl.getAttribute(ORIGINAL_HTML_ATTR);
  if (stored == null) return;
  postEl.innerHTML = stored;
  postEl.removeAttribute(ORIGINAL_HTML_ATTR);
  postEl.removeAttribute(TRANSLATED_HTML_ATTR);
  postEl.removeAttribute(SOURCE_LANG_ATTR);
  postEl.classList.remove(
    'xt-text--translated',
    'xt-text--split',
    'xt-text--peeking',
    'xt-text--hover-peek',
    'xt-text--translating',
    'xt-text--blur-ready'
  );
}

function resolveSourceLangRow(code) {
  const c = normalizeLangCode(code);
  if (!c) return null;
  return (
    TARGET_LANGUAGES.find((lang) => normalizeLangCode(lang.code) === c) ||
    TARGET_LANGUAGES.find((lang) => c.startsWith(`${normalizeLangCode(lang.code)}-`)) ||
    (c.startsWith('zh')
      ? TARGET_LANGUAGES.find((lang) => lang.code === 'zh-CN')
      : null) ||
    null
  );
}

function formatPeekLangLabel(code) {
  const row = resolveSourceLangRow(code);
  if (row) return `${row.flag} ${row.code}`;
  const name = languageDisplayName(code, locale);
  if (name) return name;
  const normalized = normalizeLangCode(code);
  return normalized ? normalized.toUpperCase() : '';
}

/** @type {WeakMap<HTMLElement, { badge: HTMLElement, onMove: () => void }>} */
const peekUiByPost = new WeakMap();

function syncFloatingPeekBadge(postEl) {
  const ui = peekUiByPost.get(postEl);
  if (!ui) return;
  const rect = postEl.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) {
    ui.badge.hidden = true;
    return;
  }
  ui.badge.hidden = false;
  ui.badge.style.top = `${Math.max(4, rect.top - 6)}px`;
  ui.badge.style.left = `${rect.right}px`;
  ui.badge.style.transform = 'translate(-100%, -100%)';
}

function hideFloatingPeekBadge(postEl) {
  const ui = peekUiByPost.get(postEl);
  if (!ui) return;
  window.removeEventListener('scroll', ui.onMove, true);
  window.removeEventListener('resize', ui.onMove);
  ui.badge.remove();
  peekUiByPost.delete(postEl);
}

function showFloatingPeekBadge(postEl, code) {
  hideFloatingPeekBadge(postEl);
  const label = formatPeekLangLabel(code);
  if (!label) return;

  const badge = document.createElement('div');
  badge.className = 'xt-peek-badge';
  badge.textContent = label;
  badge.title = fmt(t.detectedLang, { lang: label });
  badge.setAttribute('aria-hidden', 'true');
  document.body.appendChild(badge);

  const onMove = () => syncFloatingPeekBadge(postEl);
  peekUiByPost.set(postEl, { badge, onMove });
  syncFloatingPeekBadge(postEl);
  window.addEventListener('scroll', onMove, true);
  window.addEventListener('resize', onMove);
}

function setTranslatingBlur(postEl, on) {
  if (on) {
    postEl.setAttribute('aria-busy', 'true');
    postEl.classList.add('xt-text--blur-ready');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!postEl.isConnected) return;
        if (postEl.getAttribute('aria-busy') !== 'true') return;
        postEl.classList.add('xt-text--translating');
      });
    });
    return;
  }
  postEl.classList.remove('xt-text--translating', 'xt-text--blur-ready');
  postEl.removeAttribute('aria-busy');
}

function beginTranslateUi(postEl, btn) {
  if (shouldHideShownReplaceButton()) {
    setTranslatingBlur(postEl, true);
    btn.hidden = true;
    btn.classList.add('is-loading');
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    syncToolbarVisibility(postEl);
    return;
  }
  btn.hidden = false;
  syncToolbarVisibility(postEl);
  setButtonLabel(btn, t.translating, { loading: true });
}

function paintTranslatedBody(postEl, translatedHtml) {
  const reveal = replaceRevealMode();
  const original = postEl.getAttribute(ORIGINAL_HTML_ATTR) || '';
  postEl.setAttribute(TRANSLATED_HTML_ATTR, translatedHtml);
  postEl.classList.remove(
    'xt-text--peeking',
    'xt-text--split',
    'xt-text--hover-peek',
    'xt-text--translating',
    'xt-text--blur-ready'
  );
  postEl.removeAttribute('aria-busy');

  if (reveal === 'split') {
    postEl.innerHTML =
      `<div class="xt-split" data-xt-split="1">` +
      `<div class="xt-split__pane">` +
      `<div class="xt-split__label">${escapeHtml(t.originalLabel)}</div>` +
      `<div class="xt-split__body">${original}</div>` +
      `</div>` +
      `<div class="xt-split__pane xt-split__pane--translated">` +
      `<div class="xt-split__label">${escapeHtml(t.translationLabel)}</div>` +
      `<div class="xt-split__body">${translatedHtml}</div>` +
      `</div>` +
      `</div>`;
    postEl.classList.add('xt-text--translated', 'xt-text--split');
    return;
  }

  postEl.innerHTML = translatedHtml;
  postEl.classList.add('xt-text--translated');
  if (reveal === 'hover') {
    postEl.classList.add('xt-text--hover-peek');
    bindReplaceHover(postEl);
  }
}

function applyReplacedText(postEl, translated, links = [], detected = null) {
  if (!postEl.hasAttribute(ORIGINAL_HTML_ATTR)) {
    postEl.setAttribute(ORIGINAL_HTML_ATTR, postEl.innerHTML);
  }
  const lang = normalizeLangCode(detected);
  if (lang) postEl.setAttribute(SOURCE_LANG_ATTR, lang);
  else postEl.removeAttribute(SOURCE_LANG_ATTR);
  paintTranslatedBody(postEl, restoreLinkedHtml(translated, links));
}

function bindReplaceHover(postEl) {
  if (postEl.getAttribute(PEEK_BOUND_ATTR) === '1') return;
  postEl.setAttribute(PEEK_BOUND_ATTR, '1');

  postEl.addEventListener('mouseenter', () => {
    if (!isReplaceMode() || replaceRevealMode() !== 'hover') return;
    if (!postEl.classList.contains('xt-text--translated')) return;
    if (postEl.classList.contains('xt-text--split')) return;
    if (postEl.classList.contains('xt-text--translating')) return;
    const original = postEl.getAttribute(ORIGINAL_HTML_ATTR);
    if (original == null) return;
    postEl.innerHTML = original;
    postEl.classList.add('xt-text--peeking');
    const lang = postEl.getAttribute(SOURCE_LANG_ATTR);
    if (lang) showFloatingPeekBadge(postEl, lang);
  });

  postEl.addEventListener('mouseleave', () => {
    if (!postEl.classList.contains('xt-text--peeking')) return;
    hideFloatingPeekBadge(postEl);
    const translated = postEl.getAttribute(TRANSLATED_HTML_ATTR);
    if (translated == null) {
      postEl.classList.remove('xt-text--peeking');
      return;
    }
    postEl.innerHTML = translated;
    postEl.classList.remove('xt-text--peeking');
    postEl.classList.add('xt-text--translated', 'xt-text--hover-peek');
  });
}

function clearDisplay(postEl) {
  restoreOriginalText(postEl);
  hideResult(postEl, { remove: true });
}

function buttonIconForLabel(label) {
  if (label === t.btnShowOriginal) return ICONS.original;
  if (label === t.btnHide) return ICONS.hide;
  if (label === t.btnRetry) return ICONS.retry;
  return ICONS.translate;
}

/**
 * One delegated capture handler on the toolbar:
 * - pointer events: stopPropagation only (so the post doesn’t open)
 * - click: handle Translate / Retry, then stopPropagation
 *
 * Do NOT use stopImmediatePropagation on the toolbar — it blocked the button handler.
 */
function bindToolbar(bar, postEl) {
  if (bar.dataset.xtBound === '1') return;
  bar.dataset.xtBound = '1';

  const quiet = (event) => {
    event.stopPropagation();
  };
  for (const type of QUIET_POINTER_EVENTS) {
    bar.addEventListener(type, quiet, true);
  }

  bar.addEventListener(
    'click',
    (event) => {
      event.stopPropagation();

      // Let translation-panel links navigate; only block post-open bubbling.
      const anchor = event.target.closest?.('a[href]');
      if (anchor && bar.contains(anchor)) return;

      event.preventDefault();

      const retry = event.target.closest?.('[data-xt-retry]');
      if (retry && bar.contains(retry)) {
        const translateBtn = getTranslateButton(postEl);
        if (translateBtn) {
          postEl.removeAttribute(AUTO_DONE_ATTR);
          runTranslate(postEl, translateBtn);
        }
        return;
      }
    },
    true
  );
}

function ensureToolbar(postEl) {
  let bar = getToolbar(postEl);
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'xt-toolbar';
    bar.setAttribute(TOOLBAR_ATTR, '1');
  }
  placeToolbar(postEl, bar);
  bindToolbar(bar, postEl);
  return bar;
}

function bindTranslateButton(btn, postEl) {
  if (btn.dataset.xtBound === '1') return;
  btn.dataset.xtBound = '1';

  const quiet = (event) => {
    event.stopPropagation();
  };
  for (const type of QUIET_POINTER_EVENTS) {
    btn.addEventListener(type, quiet, true);
  }

  btn.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      onTranslateClick(postEl, btn);
    },
    true
  );
}

function ensureButton(postEl) {
  let btn = getTranslateButton(postEl);
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'xt-btn';
    btn.setAttribute(BTN_ATTR, '1');
    setButtonLabel(btn, t.btnTranslate);
  }
  placeTranslateButton(postEl, btn);
  bindTranslateButton(btn, postEl);
  syncToolbarVisibility(postEl);
  return btn;
}

function ensureResult(postEl) {
  const bar = ensureToolbar(postEl);
  let box = bar.querySelector(`[${RESULT_ATTR}]`);
  if (box) return box;
  box = document.createElement('div');
  box.className = 'xt-result';
  box.setAttribute(RESULT_ATTR, '1');
  box.innerHTML = '<div class="xt-result__clip"><div class="xt-result__inner"></div></div>';
  bar.appendChild(box);
  return box;
}

function buildResultInnerHtml({ translated, detected, error, links }) {
  if (error) {
    return (
      `<div class="xt-result__error">${escapeHtml(error)}</div>` +
      `<button type="button" class="xt-btn xt-btn--retry" data-xt-retry="1">${ICONS.retry}<span class="xt-btn__label">${escapeHtml(t.btnRetry)}</span></button>`
    );
  }

  const metaParts = [];
  if (detected) metaParts.push(fmt(t.detectedLang, { lang: detected }));

  const body = restoreLinkedHtml(translated, links || []);

  return (
    `<div class="xt-result__label">${escapeHtml(t.translationLabel)}</div>` +
    (metaParts.length
      ? `<div class="xt-result__meta">${escapeHtml(metaParts.join(' · '))}</div>`
      : '') +
    `<div class="xt-result__text">${body}</div>`
  );
}

/** Reveal translation: separate panel, or replace post text in place. */
function showResult(postEl, payload) {
  const useReplace =
    isReplaceMode() &&
    !payload.error &&
    !payload.panelOnly &&
    payload.translated != null;

  if (useReplace) {
    hideResult(postEl, { remove: true });
    applyReplacedText(
      postEl,
      payload.translated,
      payload.links || [],
      payload.detected
    );
    return null;
  }

  // Panel mode (and errors / notices in replace mode).
  restoreOriginalText(postEl);
  const box = ensureResult(postEl);
  const inner = box.querySelector('.xt-result__inner');
  if (!inner) return box;

  inner.innerHTML = buildResultInnerHtml(payload);
  box.classList.remove('is-open', 'is-closing');
  void box.offsetHeight;
  requestAnimationFrame(() => {
    box.classList.add('is-open');
  });
  return box;
}

function hideResult(postEl, { remove = false } = {}) {
  const box = getToolbar(postEl)?.querySelector(`[${RESULT_ATTR}]`);
  if (!box) return;

  const finish = () => {
    box.classList.remove('is-closing');
    if (remove) box.remove();
    else {
      const inner = box.querySelector('.xt-result__inner');
      if (inner) inner.innerHTML = '';
    }
  };

  if (!box.classList.contains('is-open')) {
    finish();
    return;
  }

  box.classList.remove('is-open');
  box.classList.add('is-closing');
  const onEnd = (event) => {
    if (event.target !== box.querySelector('.xt-result__clip')) return;
    box.removeEventListener('transitionend', onEnd);
    finish();
  };
  box.addEventListener('transitionend', onEnd);
  setTimeout(() => {
    box.removeEventListener('transitionend', onEnd);
    finish();
  }, 360);
}

function setButtonLabel(btn, label, { loading = false } = {}) {
  const header = btn.classList.contains('xt-btn--header');
  btn.classList.toggle('is-loading', loading);
  btn.disabled = loading;
  btn.setAttribute('aria-label', label);
  if (loading) {
    btn.setAttribute('aria-busy', 'true');
    btn.innerHTML =
      `<span class="xt-btn__spinner" aria-hidden="true"></span>` +
      `<span class="xt-btn__label">${escapeHtml(label)}</span>`;
    return;
  }
  btn.removeAttribute('aria-busy');
  btn.innerHTML =
    `${buttonIconForLabel(label)}` +
    `<span class="xt-btn__label">${escapeHtml(label)}</span>`;
  if (header) btn.title = label;
  else btn.removeAttribute('title');
}

async function runTranslate(postEl, btn) {
  const { text, links } = extractPostForTranslate(postEl);
  if (!hasTranslatablePlainText(text)) {
    setTranslatingBlur(postEl, false);
    teardownPostUi(postEl);
    return;
  }

  const targetLang = resolveTargetLang(settings.targetLang, locale);
  clearDisplay(postEl);
  beginTranslateUi(postEl, btn);

  try {
    const result = await translateText(text, targetLang);
    setTranslatingBlur(postEl, false);
    const langSkip = getLanguageSkipReason(result.detectedSourceLang);
    if (langSkip) {
      showResult(postEl, {
        translated: langSkip === 'blocked' ? t.langSkippedBlocked : t.langSkippedNotAllowed,
        detected: result.detectedSourceLang,
        fromCache: result.fromCache,
        panelOnly: true,
      });
      btn.hidden = false;
      setButtonLabel(btn, t.btnHide);
      btn.dataset.xtState = 'shown';
      syncToolbarVisibility(postEl);
    } else if (
      result.detectedSourceLang &&
      result.detectedSourceLang.toLowerCase() === targetLang.toLowerCase() &&
      result.text.trim() === text.trim()
    ) {
      // Already in target language — stay quiet, no panel.
      hideResult(postEl, { remove: true });
      applyIdleButton(btn, postEl);
    } else {
      showResult(postEl, {
        translated: result.text,
        detected: result.detectedSourceLang,
        fromCache: result.fromCache,
        links,
      });
      applyShownButton(btn, postEl);
    }
    postEl.setAttribute(AUTO_DONE_ATTR, '1');
  } catch (err) {
    setTranslatingBlur(postEl, false);
    const msg =
      err?.message === 'missing-config' ? t.errProviderConfig : t.errNetwork;
    showResult(postEl, { error: msg });
    applyIdleButton(btn, postEl);
    postEl.setAttribute(AUTO_DONE_ATTR, '1');
  }
}

function onTranslateClick(postEl, btn) {
  if (btn.classList.contains('is-loading')) return;
  if (btn.dataset.xtState === 'shown') {
    clearDisplay(postEl);
    applyIdleButton(btn, postEl);
    postEl.setAttribute(AUTO_DONE_ATTR, '1');
    return;
  }
  postEl.removeAttribute(AUTO_DONE_ATTR);
  runTranslate(postEl, btn);
}

function stopAutoTranslate() {
  autoQueue.length = 0;
  autoInflight = 0;
  if (visibilityObserver) {
    visibilityObserver.disconnect();
    visibilityObserver = null;
  }
  document.querySelectorAll(`[${OBSERVED_ATTR}]`).forEach((el) => {
    el.removeAttribute(OBSERVED_ATTR);
  });
}

function pumpAutoQueue() {
  while (autoInflight < AUTO_TRANSLATE_MAX_INFLIGHT && autoQueue.length) {
    const postEl = autoQueue.shift();
    if (!postEl || !document.contains(postEl)) continue;
    postEl.removeAttribute(AUTO_QUEUED_ATTR);
    if (!shouldAutoTranslatePost(postEl)) continue;
    if (postEl.getAttribute(AUTO_DONE_ATTR) === '1') continue;

    const btn = getTranslateButton(postEl);
    if (!btn || btn.classList.contains('is-loading') || btn.dataset.xtState === 'shown') {
      if (btn?.dataset.xtState === 'shown') postEl.setAttribute(AUTO_DONE_ATTR, '1');
      continue;
    }

    autoInflight += 1;
    Promise.resolve(runTranslate(postEl, btn))
      .catch(() => {})
      .finally(() => {
        autoInflight = Math.max(0, autoInflight - 1);
        pumpAutoQueue();
      });
  }
}

function enqueueAutoTranslate(postEl) {
  if (!shouldAutoTranslatePost(postEl)) return;
  if (postEl.getAttribute(AUTO_DONE_ATTR) === '1') return;
  if (postEl.getAttribute(AUTO_QUEUED_ATTR) === '1') return;
  const btn = getTranslateButton(postEl);
  if (!btn || btn.classList.contains('is-loading') || btn.dataset.xtState === 'shown') {
    if (btn?.dataset.xtState === 'shown') postEl.setAttribute(AUTO_DONE_ATTR, '1');
    return;
  }
  postEl.setAttribute(AUTO_QUEUED_ATTR, '1');
  autoQueue.push(postEl);
  pumpAutoQueue();
}

function ensureVisibilityObserver() {
  if (visibilityObserver) return visibilityObserver;
  visibilityObserver = new IntersectionObserver(
    (entries) => {
      if (!isAutoMode()) return;
      for (const entry of entries) {
        // Any visible pixel is enough (“хоть чуть-чуть”).
        if (!entry.isIntersecting) continue;
        if (!(entry.target instanceof HTMLElement)) continue;
        enqueueAutoTranslate(entry.target);
      }
    },
    { root: null, rootMargin: '0px', threshold: 0 }
  );
  return visibilityObserver;
}

function observeForAuto(postEl) {
  if (!shouldAutoTranslatePost(postEl)) return;
  const obs = ensureVisibilityObserver();
  if (postEl.getAttribute(OBSERVED_ATTR) === '1') return;
  postEl.setAttribute(OBSERVED_ATTR, '1');
  obs.observe(postEl);
}

function enhancePost(el) {
  const handle = resolvePostAuthorHandle(el);
  if (isAccountBlocked(handle)) {
    teardownPostUi(el);
    return;
  }

  if (shouldSkipForNativeAutoTranslate(el)) {
    teardownPostUi(el);
    return;
  }

  if (!postHasTranslatableContent(el)) {
    teardownPostUi(el);
    return;
  }

  if (el.hasAttribute(POST_ATTR)) {
    // Re-place chrome if X re-rendered the tweet header / text tree.
    const bar = getToolbar(el);
    if (bar) {
      placeToolbar(el, bar);
      bindToolbar(bar, el);
    }
    const btn = getTranslateButton(el);
    if (btn) {
      placeTranslateButton(el, btn);
      bindTranslateButton(btn, el);
    } else {
      ensureButton(el);
    }
    observeForAuto(el);
    return;
  }

  el.setAttribute(POST_ATTR, '1');
  ensureButton(el);
  observeForAuto(el);
}

export function scanPosts() {
  if (!isAutoMode()) {
    stopAutoTranslate();
  }

  findPostTextRoots().forEach(enhancePost);

  // Re-queue visible allowlisted posts after settings / DOM rescans.
  if (isAutoMode()) {
    document.querySelectorAll(`[${POST_ATTR}]`).forEach((el) => {
      if (shouldAutoTranslatePost(el)) enqueueAutoTranslate(el);
    });
  }

  document.querySelectorAll(`[${POST_ATTR}]`).forEach((postEl) => {
    const btn = getTranslateButton(postEl);
    if (!btn || btn.classList.contains('is-loading')) return;
    if (btn.dataset.xtState === 'shown') applyShownButton(btn, postEl);
    else applyIdleButton(btn, postEl);
  });
}
