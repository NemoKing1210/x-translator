import { BTN_ATTR, MENU_ATTR, NAV_BTN_ATTR, POST_ATTR, RESULT_ATTR, SCAN_DEBOUNCE_MS, TOOLBAR_ATTR } from '../constants.js';
import { debounce } from '../utils/debounce.js';
import { scanPosts } from './posts.js';
import { scanPostMenus } from './post-menu.js';
import { ensureNavSettingsButton } from './settings-panel.js';

export function isXtManagedElement(el) {
  if (!el || el.nodeType !== 1) return false;
  if (
    el.hasAttribute?.(POST_ATTR) ||
    el.hasAttribute?.(BTN_ATTR) ||
    el.hasAttribute?.(RESULT_ATTR) ||
    el.hasAttribute?.(TOOLBAR_ATTR) ||
    el.hasAttribute?.(NAV_BTN_ATTR) ||
    el.hasAttribute?.(MENU_ATTR) ||
    el.id === 'xt-toast-host' ||
    el.id === 'xt-settings-root'
  ) {
    return true;
  }
  return Boolean(
    el.classList?.contains('xt-btn') ||
      el.classList?.contains('xt-toolbar') ||
      el.classList?.contains('xt-result') ||
      el.classList?.contains('xt-nav-item') ||
      el.classList?.contains('xt-menu-item') ||
      el.classList?.contains('xt-toast-host') ||
      el.classList?.contains('xt-toast') ||
      el.classList?.contains('xt-settings-backdrop') ||
      el.closest?.(
        `[${POST_ATTR}], [${BTN_ATTR}], [${RESULT_ATTR}], [${TOOLBAR_ATTR}], [${NAV_BTN_ATTR}], [${MENU_ATTR}], .xt-settings-backdrop, #xt-toast-host`
      )
  );
}

export function shouldIgnoreDomMutations(mutations) {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (!isXtManagedElement(node)) return false;
    }
  }
  return true;
}

export function observeDom(onChange) {
  const scheduled = debounce(onChange, SCAN_DEBOUNCE_MS);
  const observer = new MutationObserver((mutations) => {
    if (shouldIgnoreDomMutations(mutations)) return;
    scheduled();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return observer;
}

/** X/Twitter is a client-side SPA — poll href + listen to history. */
export function bindSpaNavigation(onNavigate) {
  const run = debounce(onNavigate, 80);
  ['popstate', 'pushstate', 'replacestate'].forEach((evt) => {
    window.addEventListener(evt, run, true);
  });

  const wrap = (type) => {
    const orig = history[type];
    if (typeof orig !== 'function') return;
    history[type] = function patched(...args) {
      const ret = orig.apply(this, args);
      window.dispatchEvent(new Event(type.toLowerCase()));
      return ret;
    };
  };
  wrap('pushState');
  wrap('replaceState');

  let prev = location.href;
  setInterval(() => {
    if (location.href !== prev) {
      prev = location.href;
      run();
    }
  }, 500);
}

export function isXHost() {
  return /^(www\.)?(x|twitter)\.com$/i.test(location.hostname);
}

export function scanPage() {
  ensureNavSettingsButton();
  scanPosts();
  scanPostMenus();
}
