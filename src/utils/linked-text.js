import { escapeAttr, escapeHtml } from './html.js';

/** Private-use markers — MT engines usually leave them intact. */
const TOKEN_START = '\uE000';
const TOKEN_END = '\uE001';
const TOKEN_RE = /\uE000\s*(\d+)\s*\uE001/g;

/**
 * @typedef {{ href: string, text: string, target: string, rel: string }} LinkedAnchor
 */

/**
 * @param {string} href
 * @returns {string | null}
 */
export function sanitizeHref(href) {
  const raw = String(href || '').trim();
  if (!raw) return null;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  if (raw.startsWith('#')) return raw;
  try {
    const url = new URL(raw, location.origin);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
  } catch {
    return null;
  }
  return null;
}

/**
 * @param {LinkedAnchor} link
 * @returns {string}
 */
export function renderSafeLink(link) {
  const href = sanitizeHref(link.href);
  const label = escapeHtml(link.text || link.href || '');
  if (!href) return label;

  const attrs = [`href="${escapeAttr(href)}"`];
  const target = String(link.target || '').trim();
  const rel = String(link.rel || '').trim();
  if (target) attrs.push(`target="${escapeAttr(target)}"`);
  if (rel) attrs.push(`rel="${escapeAttr(rel)}"`);
  else if (href.startsWith('http')) {
    attrs.push('target="_blank"', 'rel="noopener noreferrer"');
  }
  return `<a ${attrs.join(' ')}>${label}</a>`;
}

/**
 * Replace anchors with stable tokens so translators do not mangle URLs.
 * @param {ParentNode} root
 * @returns {{ text: string, links: LinkedAnchor[] }}
 */
export function extractLinkedText(root) {
  const links = [];
  const anchors = [...root.querySelectorAll('a[href]')];
  for (const a of anchors) {
    const id = links.length;
    links.push({
      href: a.getAttribute('href') || '',
      text: String(a.innerText || a.textContent || '')
        .replace(/\u00a0/g, ' ')
        .trim(),
      target: a.getAttribute('target') || '',
      rel: a.getAttribute('rel') || '',
    });
    a.replaceWith(document.createTextNode(`${TOKEN_START}${id}${TOKEN_END}`));
  }

  const text = String(root.innerText || root.textContent || '')
    .replace(/\u00a0/g, ' ')
    .trim();
  return { text, links };
}

/**
 * Text left after removing link placeholders (and whitespace).
 * Empty ⇒ nothing worth translating (links / hashtags only).
 * @param {string} text
 * @returns {string}
 */
export function plainTextWithoutLinkTokens(text) {
  return String(text || '')
    .replace(TOKEN_RE, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function hasTranslatablePlainText(text) {
  return Boolean(plainTextWithoutLinkTokens(text));
}

/**
 * Turn translated text (with tokens) into safe HTML, restoring original anchors.
 * @param {string} translated
 * @param {LinkedAnchor[]} links
 * @param {{ multiline?: boolean }} [opts]
 * @returns {string}
 */
export function restoreLinkedHtml(translated, links, { multiline = true } = {}) {
  const source = String(translated || '');
  if (!links?.length) {
    const escaped = escapeHtml(source);
    return multiline ? escaped.replace(/\n/g, '<br>') : escaped;
  }

  let html = '';
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  let match;
  const used = new Set();

  while ((match = TOKEN_RE.exec(source))) {
    html += formatPlainChunk(source.slice(last, match.index), multiline);
    const id = Number(match[1]);
    const link = links[id];
    if (link) {
      html += renderSafeLink(link);
      used.add(id);
    } else {
      html += formatPlainChunk(match[0], multiline);
    }
    last = match.index + match[0].length;
  }

  html += formatPlainChunk(source.slice(last), multiline);

  // If the model dropped a token, append remaining links so they are not lost.
  for (let i = 0; i < links.length; i += 1) {
    if (used.has(i)) continue;
    html += (html ? ' ' : '') + renderSafeLink(links[i]);
  }

  return html;
}

/**
 * @param {string} chunk
 * @param {boolean} multiline
 */
function formatPlainChunk(chunk, multiline) {
  const escaped = escapeHtml(chunk);
  return multiline ? escaped.replace(/\n/g, '<br>') : escaped;
}
