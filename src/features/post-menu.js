import { MENU_ATTR } from '../constants.js';
import { fmt } from '../i18n/index.js';
import { settings, t } from '../state.js';
import { debounce } from '../utils/debounce.js';
import { escapeHtml } from '../utils/html.js';
import {
  isInAutoAllowlist,
  toggleAutoAllowlistHandle,
} from './allowlist.js';
import { formatHandleDisplay, resolveHandleFromDropdownTrigger } from './author.js';
import {
  isAccountBlocked,
  toggleAccountBlocklistHandle,
} from './filters.js';
import { scanPosts } from './posts.js';
import { showToast } from './toast.js';

const MENU_ICON_TRANSLATE = `<svg fill="none" viewBox="0 0 24 24" width="18.75" height="18.75" aria-hidden="true"><path fill="currentColor" d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`;

const MENU_ICON_BLOCK = `<svg fill="none" viewBox="0 0 24 24" width="18.75" height="18.75" aria-hidden="true"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/></svg>`;

/** Heuristic: open tweet “…” menus on X. */
function isTweetActionMenu(menu) {
  if (!(menu instanceof Element)) return false;
  if (menu.querySelector(`[${MENU_ATTR}]`)) return true;

  const items = menu.querySelectorAll('[role="menuitem"], [data-testid]');
  if (!items.length) return false;

  const text = (menu.textContent || '').toLowerCase();
  const signals = [
    'delete',
    'embed',
    'mute',
    'block',
    'report',
    'not interested',
    'follow',
    'unfollow',
    'bookmark',
    'add/remove',
    'view post',
    'copy link',
    'удалить',
    'встроить',
    'игнорировать',
    'пожаловаться',
    'читать',
  ];
  if (signals.some((s) => text.includes(s))) return true;

  // Fallback: caret was expanded nearby.
  return Boolean(
    document.querySelector(
      'article[data-testid="tweet"] [data-testid="caret"][aria-expanded="true"]'
    )
  );
}

function buildMenuShell(kind, label, iconHtml, onClick) {
  const item = document.createElement('div');
  item.setAttribute(MENU_ATTR, kind);
  item.setAttribute('role', 'menuitem');
  item.setAttribute('tabindex', '0');
  item.setAttribute('aria-label', label);
  item.className = 'xt-menu-item';
  item.style.cssText =
    'display: flex; flex-direction: row; align-items: center; gap: 12px; padding: 12px 16px; outline: 0; cursor: pointer; color: inherit;';
  item.innerHTML =
    `<div class="xt-menu-item__icon" style="display:flex;width:18.75px;height:18.75px;align-items:center;justify-content:center;">${iconHtml}</div>` +
    `<div dir="auto" class="xt-menu-item__label" style="font-size: 15px; line-height: 20px; font-weight: 700; flex: 1 1 0%;">${escapeHtml(label)}</div>`;

  item.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    },
    true
  );
  return item;
}

function buildAutoMenuItem(handle) {
  const inList = isInAutoAllowlist(handle);
  const label = inList ? t.menuRemoveAutoAccount : t.menuAddAutoAccount;
  return buildMenuShell('auto', label, MENU_ICON_TRANSLATE, () => {
    const result = toggleAutoAllowlistHandle(handle);
    if (!result.ok && result.reason === 'invalid') {
      showToast(t.allowlistInvalid, { type: 'warning' });
      return;
    }
    const display = formatHandleDisplay(result.handle || handle);
    if (result.added) {
      showToast(fmt(t.allowlistAdded, { handle: display }), { type: 'success' });
    } else {
      showToast(fmt(t.allowlistRemoved, { handle: display }), { type: 'info' });
    }
    scanPosts();
    closeOpenMenus();
  });
}

function buildBlockMenuItem(handle) {
  const blocked = isAccountBlocked(handle);
  const label = blocked ? t.menuUnblockAccount : t.menuBlockAccount;
  return buildMenuShell('block', label, MENU_ICON_BLOCK, () => {
    const result = toggleAccountBlocklistHandle(handle);
    if (!result.ok && result.reason === 'invalid') {
      showToast(t.allowlistInvalid, { type: 'warning' });
      return;
    }
    const display = formatHandleDisplay(result.handle || handle);
    if (result.added) {
      showToast(fmt(t.blocklistAdded, { handle: display }), { type: 'success' });
    } else {
      showToast(fmt(t.blocklistRemoved, { handle: display }), { type: 'info' });
    }
    scanPosts();
    closeOpenMenus();
  });
}

function findOpenPostMenus() {
  return [...document.querySelectorAll('[role="menu"]')].filter(isTweetActionMenu);
}

function findOpenDropdownTrigger() {
  return (
    document.querySelector(
      'article[data-testid="tweet"] [data-testid="caret"][aria-expanded="true"]'
    ) ||
    document.querySelector(
      'article[data-testid="tweet"] [data-testid="caret"][aria-pressed="true"]'
    ) ||
    document.querySelector('article[data-testid="tweet"] [data-testid="caret"]')
  );
}

function closeOpenMenus() {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  );
}

function menuItemHost(menu) {
  const firstItem =
    menu.querySelector('[role="menuitem"]') ||
    menu.querySelector('[data-testid]');
  return firstItem?.parentElement || menu;
}

function injectItem(menu, item, afterEl) {
  const host = afterEl?.parentElement || menuItemHost(menu);

  if (afterEl && afterEl.parentElement === host) {
    afterEl.insertAdjacentElement('afterend', item);
  } else {
    host.appendChild(item);
  }
}

function injectIntoMenu(menu, handle) {
  const existingAuto = menu.querySelector(`[${MENU_ATTR}="auto"]`);
  const existingBlock = menu.querySelector(`[${MENU_ATTR}="block"]`);

  if (settings.translateMode === 'auto') {
    if (!existingAuto) {
      const first =
        menu.querySelector('[role="menuitem"]') ||
        menu.querySelector('[data-testid]');
      injectItem(menu, buildAutoMenuItem(handle), null);
      // Prefer top of menu when possible
      if (first?.parentElement) {
        first.parentElement.insertBefore(
          menu.querySelector(`[${MENU_ATTR}="auto"]`),
          first
        );
      }
    }
  } else {
    existingAuto?.remove();
  }

  if (!existingBlock) {
    const after = menu.querySelector(`[${MENU_ATTR}="auto"]`);
    injectItem(menu, buildBlockMenuItem(handle), after);
  }
}

export function scanPostMenus() {
  const trigger = findOpenDropdownTrigger();
  const handle = resolveHandleFromDropdownTrigger(trigger);
  if (!handle) return;

  for (const menu of findOpenPostMenus()) {
    injectIntoMenu(menu, handle);
  }
}

/** Watch portaled tweet menus; keep latency low so the item appears with the menu. */
export function observePostMenus() {
  const run = debounce(scanPostMenus, 40);
  const observer = new MutationObserver(run);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scanPostMenus();
  return observer;
}
