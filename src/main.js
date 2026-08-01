import {
  GM_registerMenuCommand,
} from '$';
import './styles/main.css';
import { ROOT_ATTR } from './constants.js';
import { openSettings, ensureNavSettingsButton } from './features/settings-panel.js';
import { observePostMenus } from './features/post-menu.js';
import {
  bindSpaNavigation,
  isXHost,
  observeDom,
  scanPage,
} from './features/spa.js';
import { reloadRuntimeSettings, t } from './state.js';
import { observePageTheme } from './theme.js';

function init() {
  if (document.documentElement.hasAttribute(ROOT_ATTR)) return;
  document.documentElement.setAttribute(ROOT_ATTR, '1');

  reloadRuntimeSettings();
  observePageTheme(() => {
    ensureNavSettingsButton();
  });

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand(t.menuSettings, openSettings);
  }

  if (!isXHost()) return;

  scanPage();
  observeDom(scanPage);
  observePostMenus();
  bindSpaNavigation(scanPage);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
