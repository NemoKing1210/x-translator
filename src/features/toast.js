import { t } from '../state.js';
import { escapeAttr, escapeHtml } from '../utils/html.js';

const HOST_ID = 'xt-toast-host';
const DEFAULT_MS = 4200;
const MAX_VISIBLE = 4;

const TOAST_ICONS = {
  success:
    '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 10.5 8.2 13.7 15 6.5" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.25" stroke="currentColor" stroke-width="1.8"/><path d="M10 9v4.5M10 6.5h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  warning:
    '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3.5 17.5 16H2.5L10 3.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10 8v4M10 14h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  error:
    '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.25" stroke="currentColor" stroke-width="1.8"/><path d="m7.2 7.2 5.6 5.6M12.8 7.2l-5.6 5.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
};

function ensureHost() {
  let host = document.getElementById(HOST_ID);
  if (host?.isConnected) return host;
  host = document.createElement('div');
  host.id = HOST_ID;
  host.className = 'xt-toast-host';
  host.setAttribute('aria-live', 'polite');
  host.setAttribute('aria-relevant', 'additions');
  (document.body || document.documentElement).appendChild(host);
  return host;
}

function dismissToast(el) {
  if (!el || el.dataset.xtLeaving === '1') return;
  el.dataset.xtLeaving = '1';
  el.classList.add('is-leaving');
  const done = () => el.remove();
  el.addEventListener('transitionend', done, { once: true });
  setTimeout(done, 320);
}

function normalizeType(type) {
  return ['info', 'success', 'warning', 'error'].includes(type) ? type : 'info';
}

function defaultTitle(type) {
  if (type === 'success') return t.toastTitleSuccess || 'Success';
  if (type === 'warning') return t.toastTitleWarning || 'Notice';
  if (type === 'error') return t.toastTitleError || 'Error';
  return t.toastTitleInfo || 'Info';
}

export function showToast(messageOrOpts, options = {}) {
  let title = '';
  let message = '';
  let opts = options;

  if (messageOrOpts && typeof messageOrOpts === 'object' && !Array.isArray(messageOrOpts)) {
    opts = { ...messageOrOpts, ...options };
    title = opts.title || '';
    message = opts.message || opts.description || '';
  } else {
    message = String(messageOrOpts || '');
    title = options.title || '';
  }

  const type = normalizeType(opts.type);
  title = String(title || '').trim() || defaultTitle(type);
  message = String(message || '').trim();
  if (!title && !message) return null;

  const duration =
    Number.isFinite(opts.duration) && opts.duration > 0 ? opts.duration : DEFAULT_MS;

  const host = ensureHost();
  while (host.children.length >= MAX_VISIBLE) {
    dismissToast(host.firstElementChild);
  }

  const dismissLabel = t.toastDismiss || 'Dismiss';
  const el = document.createElement('div');
  el.className = `xt-toast xt-toast--${type}`;
  el.setAttribute('role', 'status');
  el.innerHTML =
    `<span class="xt-toast__icon" aria-hidden="true">${TOAST_ICONS[type]}</span>` +
    `<span class="xt-toast__body">` +
    (title ? `<span class="xt-toast__title">${escapeHtml(title)}</span>` : '') +
    (message ? `<span class="xt-toast__text">${escapeHtml(message)}</span>` : '') +
    `</span>` +
    `<button type="button" class="xt-toast__close" aria-label="${escapeAttr(dismissLabel)}">` +
    `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4 4 12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>` +
    `</button>` +
    `<span class="xt-toast__bar" style="animation-duration:${duration}ms"></span>`;

  el.querySelector('.xt-toast__close')?.addEventListener('click', () => dismissToast(el));
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => dismissToast(el), duration);
  return el;
}
