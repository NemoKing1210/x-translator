import { t } from '../state.js';
import { escapeAttr, escapeHtml } from '../utils/html.js';

const HOST_ID = 'xt-toast-host';
const DEFAULT_MS = 4200;
const MAX_VISIBLE = 4;

const TOAST_ICONS = {
  success:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9.2 16.2 5.5 12.5l1.4-1.4 2.3 2.3 7-7 1.4 1.4-8.4 8.4Z" fill="currentColor"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.75a9.25 9.25 0 1 1 0 18.5 9.25 9.25 0 0 1 0-18.5Zm0 8.25a1 1 0 0 0-1 1v4.5a1 1 0 1 0 2 0V12a1 1 0 0 0-1-1Zm0-3.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z" fill="currentColor"/></svg>',
  warning:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12.87 4.5c-.38-.68-1.36-.68-1.74 0L3.4 18.25c-.37.66.11 1.5.87 1.5h15.46c.76 0 1.24-.84.87-1.5L12.87 4.5ZM11 10.5h2v4h-2v-4Zm0 5.5h2v2h-2v-2Z" fill="currentColor"/></svg>',
  error:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.75a9.25 9.25 0 1 1 0 18.5 9.25 9.25 0 0 1 0-18.5Zm3.03 6.22-1.41-1.41L12 10.59 9.38 7.97 7.97 9.38 10.59 12l-2.62 2.62 1.41 1.41L12 13.41l2.62 2.62 1.41-1.41L13.41 12l2.62-2.62Z" fill="currentColor"/></svg>',
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
  setTimeout(done, 280);
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
    `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10.59 12 5.3 6.7l1.4-1.4L12 10.59l5.3-5.3 1.4 1.4L13.41 12l5.3 5.3-1.4 1.4L12 13.41l-5.3 5.3-1.4-1.4L10.59 12Z" fill="currentColor"/></svg>` +
    `</button>` +
    `<span class="xt-toast__bar" style="animation-duration:${duration}ms"></span>`;

  el.querySelector('.xt-toast__close')?.addEventListener('click', () => dismissToast(el));
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => dismissToast(el), duration);
  return el;
}
