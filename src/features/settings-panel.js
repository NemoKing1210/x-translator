import { buildCacheMeterHtml, cacheFillLevel, clearCache, getCacheUsageStats, paintCacheMeter } from '../cache.js';
import {
  AUTHOR_AVATAR_URL,
  AUTHOR_EMAIL,
  AUTHOR_HANDLE,
  AUTHOR_NAME,
  AUTHOR_URL,
  CACHE_HOURS_MAX,
  DEFAULT_SETTINGS,
  NAV_BTN_ATTR,
  REPO_URL,
  SCRIPT_VERSION,
  TARGET_LANGUAGES,
} from '../constants.js';
import { fmt, LOCALE_FLAG_AUTO, LOCALE_FLAGS, LOCALE_NATIVE_NAMES, SUPPORTED_LOCALES } from '../i18n/index.js';
import { getProvider, TRANSLATION_PROVIDERS } from '../providers/registry.js';
import { saveSettings } from '../settings.js';
import { reloadRuntimeSettings, settings, t } from '../state.js';
import { formatHandleDisplay, normalizeHandle } from '../utils/handle.js';
import { escapeAttr, escapeHtml } from '../utils/html.js';
import { normalizeLangCode } from '../utils/lists.js';
import { scanPosts } from './posts.js';
import { showToast } from './toast.js';

const ROOT_ID = 'xt-settings-root';

const SETTINGS_TABS = [
  { id: 'general', labelKey: 'sectionGeneral' },
  { id: 'providers', labelKey: 'sectionProviders' },
  { id: 'cache', labelKey: 'sectionCache' },
  { id: 'about', labelKey: 'sectionAbout' },
];

const NAV_ICON_PATH =
  'M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z';

/** X adds this on the pill via JS on hover (not CSS :hover). May change with client builds. */
let navHoverClass = 'r-1hdo0pc';

function findSideNavs() {
  const bars = [
    ...document.querySelectorAll('[data-testid="AppTabBar"]'),
    ...document.querySelectorAll('nav[role="navigation"]'),
  ];
  const seen = new Set();
  return bars.filter((nav) => {
    if (seen.has(nav)) return false;
    seen.add(nav);
    return Boolean(
      nav.querySelector('[data-testid="AppTabBar_More_Menu"]') ||
        nav.querySelector('a[href="/settings"]') ||
        nav.querySelector('a[href*="/settings"]') ||
        nav.querySelector('a[data-testid="AppTabBar_Home_Link"]')
    );
  });
}

function navLabelWeight(el) {
  const label = el?.querySelector?.('div[dir]');
  if (!label) return null;
  const raw = getComputedStyle(label).fontWeight;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n)) return n;
  if (raw === 'bold') return 700;
  if (raw === 'normal') return 400;
  return null;
}

/**
 * Learn the live hover class from native rows (X renames r-* hashes over time).
 */
function observeNativeNavHoverClass(nav) {
  if (nav.dataset.xtHoverObs === '1') return;
  nav.dataset.xtHoverObs = '1';
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type !== 'attributes' || m.attributeName !== 'class') continue;
      const el = m.target;
      if (!(el instanceof Element)) continue;
      if (el.closest(`[${NAV_BTN_ATTR}]`)) continue;
      if (!nav.contains(el)) continue;
      const parent = el.parentElement;
      if (!parent || parent.parentElement !== nav) continue;
      if (parent.getAttribute('role') !== 'link' && parent.getAttribute('role') !== 'button') {
        continue;
      }
      const prev = new Set(String(m.oldValue || '').split(/\s+/).filter(Boolean));
      const added = [...el.classList].filter(
        (c) => !prev.has(c) && /^r-[a-z0-9]+$/i.test(c)
      );
      if (added.length === 1) navHoverClass = added[0];
    }
  });
  obs.observe(nav, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
    attributeOldValue: true,
  });
}

function navHoverPill(btn) {
  return btn?.firstElementChild instanceof HTMLElement ? btn.firstElementChild : null;
}

/** Mirror X: toggle hover outline class on the inner pill (React does this for native rows). */
function bindNavHoverChrome(btn) {
  if (!(btn instanceof HTMLElement) || btn.dataset.xtNavHover === '1') return;
  btn.dataset.xtNavHover = '1';

  const setHover = (on) => {
    const pill = navHoverPill(btn);
    if (!pill || !navHoverClass) return;
    pill.classList.toggle(navHoverClass, on);
  };

  btn.addEventListener('pointerenter', () => setHover(true));
  btn.addEventListener('pointerleave', () => setHover(false));
  btn.addEventListener('focusin', () => setHover(true));
  btn.addEventListener('focusout', (e) => {
    if (e.relatedTarget instanceof Node && btn.contains(e.relatedTarget)) return;
    setHover(false);
  });
}

/**
 * Clone an *inactive* native row so we get normal weight + hover pill.
 * Prefer More (never a selected route). Never prefer Home first — it’s often active/bold.
 */
function findNavTemplate(nav) {
  const more = nav.querySelector('[data-testid="AppTabBar_More_Menu"]');
  if (more?.querySelector('svg') && more.querySelector('div[dir]')) return more;

  const links = [...nav.querySelectorAll('a[role="link"], a[href]')].filter(
    (a) =>
      !a.hasAttribute(NAV_BTN_ATTR) &&
      a.querySelector('svg') &&
      a.querySelector('div[dir]')
  );

  const inactive = links.find((a) => {
    if (a.getAttribute('aria-current') === 'page') return false;
    const w = navLabelWeight(a);
    return w == null || w < 600;
  });
  if (inactive) return inactive;

  return (
    nav.querySelector('a[data-testid="AppTabBar_Explore_Link"]') ||
    nav.querySelector('a[data-testid="AppTabBar_Profile_Link"]') ||
    links[0] ||
    null
  );
}

function findNavInsertBefore(nav) {
  return (
    nav.querySelector('[data-testid="AppTabBar_More_Menu"]') ||
    nav.querySelector('a[href="/settings"]') ||
    nav.querySelector('a[href*="/settings"]') ||
    null
  );
}

function syncNavButtonLabels(btn) {
  btn.setAttribute('aria-label', t.navSettings);
  const label =
    btn.querySelector('[data-xt-nav-label]') ||
    btn.querySelector('div[dir] > span') ||
    null;
  if (label) label.textContent = t.navSettings;
}

function stripNavBadges(root) {
  root
    .querySelectorAll(
      '[aria-live], [aria-label*="непрочит" i], [aria-label*="unread" i], [aria-label*="Количество" i]'
    )
    .forEach((el) => el.remove());
}

function applyNavIcon(svg) {
  if (!(svg instanceof SVGElement)) return;
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  // Keep X’s svg class list (size / fill via r-*); only swap the glyph.
  svg.innerHTML = `<g><path d="${NAV_ICON_PATH}"></path></g>`;
}

function applyNavLabel(root, text) {
  const labelDiv = [...root.querySelectorAll('div[dir]')].find(
    (el) => el.querySelector(':scope > span') && !el.querySelector('svg')
  );
  if (labelDiv) {
    const spans = [...labelDiv.querySelectorAll(':scope > span')];
    if (spans[0]) {
      spans[0].textContent = text;
      spans[0].setAttribute('data-xt-nav-label', '1');
    }
    // Keep trailing spacer span(s) as X renders them.
    return;
  }
  const anySpan = root.querySelector('span');
  if (anySpan) {
    anySpan.textContent = text;
    anySpan.setAttribute('data-xt-nav-label', '1');
  }
}

/** Deep-clone template into an <a>, preserving every native class (hover pill, type). */
function buildNavButton(template) {
  let btn;
  if (template instanceof HTMLAnchorElement) {
    btn = template.cloneNode(true);
  } else {
    btn = document.createElement('a');
    btn.className = template.className;
    btn.innerHTML = template.innerHTML;
  }

  btn.href = '#';
  btn.setAttribute(NAV_BTN_ATTR, '1');
  btn.setAttribute('role', 'link');
  btn.removeAttribute('data-testid');
  btn.removeAttribute('type');
  btn.removeAttribute('aria-expanded');
  btn.removeAttribute('aria-haspopup');
  btn.removeAttribute('aria-describedby');
  btn.removeAttribute('aria-current');
  btn.setAttribute('aria-label', t.navSettings);
  btn.tabIndex = 0;
  // Do not touch style on descendants — X sets label color inline.

  stripNavBadges(btn);
  applyNavIcon(btn.querySelector('svg'));
  applyNavLabel(btn, t.navSettings);
  bindNavHoverChrome(btn);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openSettings();
  });
  return btn;
}

function navButtonNeedsRebuild(btn) {
  const html = btn.innerHTML || '';
  if (/gap:\s*20px/i.test(html) || /width:\s*26\.25px/i.test(html)) return true;
  if (!btn.querySelector('svg') || !btn.querySelector('div[dir]')) return true;
  // Cloned from active Home → bold label; force rebuild from inactive template.
  const w = navLabelWeight(btn);
  if (w != null && w >= 600) return true;
  // Old builds added xt-nav-item and custom hover CSS that broke native pill hover.
  if (btn.classList.contains('xt-nav-item')) return true;
  // Need hover-class mirror (X applies r-1hdo0pc via JS, not :hover).
  if (btn.dataset.xtNavHover !== '1') return true;
  return false;
}

/**
 * Inject a Translator settings row into X’s left AppTabBar,
 * immediately before More / Settings.
 */
export function ensureNavSettingsButton() {
  for (const nav of findSideNavs()) {
    observeNativeNavHoverClass(nav);
    const existing = nav.querySelector(`[${NAV_BTN_ATTR}]`);
    const template = findNavTemplate(nav);
    if (!template) continue;

    if (existing) {
      if (navButtonNeedsRebuild(existing)) {
        existing.replaceWith(buildNavButton(template));
      } else {
        syncNavButtonLabels(existing);
        bindNavHoverChrome(existing);
      }
      continue;
    }

    const insertBefore = findNavInsertBefore(nav);
    const btn = buildNavButton(template);
    if (insertBefore) {
      insertBefore.insertAdjacentElement('beforebegin', btn);
    } else if (template.parentElement === nav) {
      template.insertAdjacentElement('beforebegin', btn);
    } else {
      nav.appendChild(btn);
    }
  }
}

function langOptions(selected) {
  const opts = [
    `<option value="auto"${selected === 'auto' ? ' selected' : ''}>${LOCALE_FLAG_AUTO} ${escapeHtml(t.langAuto)}</option>`,
  ];
  for (const { code, name, flag } of TARGET_LANGUAGES) {
    const label = `${flag} ${name}`;
    // Migrate legacy bare codes (e.g. zh → zh-CN) when matching selection.
    const isSelected =
      selected === code ||
      (selected === 'zh' && code === 'zh-CN');
    opts.push(
      `<option value="${escapeAttr(code)}"${isSelected ? ' selected' : ''}>${escapeHtml(label)}</option>`
    );
  }
  return opts.join('');
}

function localeOptions(selected) {
  const opts = [
    `<option value="auto"${selected === 'auto' ? ' selected' : ''}>${LOCALE_FLAG_AUTO} ${escapeHtml(t.localeAuto)}</option>`,
  ];
  for (const code of SUPPORTED_LOCALES) {
    const flag = LOCALE_FLAGS[code] || '';
    const name = LOCALE_NATIVE_NAMES[code] || code;
    const label = flag ? `${flag} ${name}` : name;
    opts.push(
      `<option value="${escapeAttr(code)}"${selected === code ? ' selected' : ''}>${escapeHtml(label)}</option>`
    );
  }
  return opts.join('');
}

function resolveTargetLangEntry(code) {
  if (!code || code === 'auto') return null;
  return (
    TARGET_LANGUAGES.find((lang) => lang.code === code) ||
    (code === 'zh' ? TARGET_LANGUAGES.find((lang) => lang.code === 'zh-CN') : null) ||
    null
  );
}

function translationBadgeLabel(targetLang) {
  if (!targetLang || targetLang === 'auto') {
    return `${LOCALE_FLAG_AUTO} ${t.badgeLangAuto}`;
  }
  const lang = resolveTargetLangEntry(targetLang);
  if (!lang) return targetLang;
  return `${lang.flag} ${lang.code}`;
}

function cacheBadgeLabel(stats) {
  const s = stats || getCacheUsageStats();
  if (!s.enabled) return t.badgeCacheOff;
  const pct = s.pct < 10 && s.pct > 0 ? s.pct.toFixed(1) : String(Math.round(s.pct));
  return `${pct}%`;
}

function providerBadgeLabel(providerId) {
  return getProvider(providerId || settings.provider).badge;
}

function providerOptions(selected) {
  return TRANSLATION_PROVIDERS.map((p) => {
    const on = p.id === selected;
    return `<option value="${escapeAttr(p.id)}"${on ? ' selected' : ''}>${escapeHtml(p.name)}</option>`;
  }).join('');
}

function providerFieldControl(providerId, field, value) {
  const name = `provider.${providerId}.${field.key}`;
  if (field.type === 'select') {
    const opts = (field.options || [])
      .map((opt) => {
        const on = String(value ?? '') === String(opt.value);
        const label = t[opt.labelKey] || opt.value;
        return `<option value="${escapeAttr(opt.value)}"${on ? ' selected' : ''}>${escapeHtml(label)}</option>`;
      })
      .join('');
    return `<select name="${escapeAttr(name)}">${opts}</select>`;
  }

  const inputType =
    field.type === 'password' ? 'password' : field.type === 'url' ? 'url' : 'text';
  const autocomplete = field.type === 'password' ? 'off' : 'off';
  return (
    `<input name="${escapeAttr(name)}" type="${inputType}" autocomplete="${autocomplete}" ` +
    `spellcheck="false" value="${escapeAttr(String(value ?? ''))}"` +
    (field.placeholder ? ` placeholder="${escapeAttr(field.placeholder)}"` : '') +
    ` />`
  );
}

function buildProviderFieldsHtml(activeId) {
  return TRANSLATION_PROVIDERS.map((provider) => {
    const active = provider.id === activeId;
    const cfg = settings.providerConfig?.[provider.id] || {};
    const fields =
      provider.fields.length === 0
        ? `<p class="xt-hint">${escapeHtml(t[provider.hintKey] || '')}</p>`
        : provider.fields
            .map((field) => {
              const hint = field.hintKey
                ? `<p class="xt-hint">${escapeHtml(t[field.hintKey] || '')}</p>`
                : '';
              return `
                <label class="xt-field">
                  <span>${escapeHtml(t[field.labelKey] || field.key)}</span>
                  ${providerFieldControl(provider.id, field, cfg[field.key])}
                </label>
                ${hint}
              `;
            })
            .join('') +
          `<p class="xt-hint">${escapeHtml(t[provider.hintKey] || '')}</p>`;

    return `
      <div
        class="xt-provider-fields${active ? ' is-active' : ''}"
        data-xt-provider-fields="${escapeAttr(provider.id)}"
        ${active ? '' : 'hidden'}
      >${fields}</div>
    `;
  }).join('');
}

function syncProviderFields(dialog, providerId) {
  const id = providerId || 'google';
  dialog.querySelectorAll('[data-xt-provider-fields]').forEach((block) => {
    const on = block.getAttribute('data-xt-provider-fields') === id;
    block.classList.toggle('is-active', on);
    block.hidden = !on;
  });
}

function tabBadgeHtml(id) {
  if (id === 'general') {
    return `<span class="xt-settings__badge" data-xt-tab-badge="general">${escapeHtml(translationBadgeLabel(settings.targetLang))}</span>`;
  }
  if (id === 'providers') {
    return `<span class="xt-settings__badge" data-xt-tab-badge="providers">${escapeHtml(providerBadgeLabel(settings.provider))}</span>`;
  }
  if (id === 'cache') {
    const stats = getCacheUsageStats();
    const level = cacheFillLevel(stats);
    return `<span class="xt-settings__badge xt-settings__badge--cache" data-xt-tab-badge="cache" data-level="${escapeAttr(level)}">${escapeHtml(cacheBadgeLabel(stats))}</span>`;
  }
  return '';
}

function buildTabsHtml(activeId) {
  const tabs = SETTINGS_TABS.map(({ id, labelKey }) => {
    const active = id === activeId;
    return `
      <button
        type="button"
        class="xt-settings__tab${active ? ' is-active' : ''}"
        role="tab"
        id="xt-tab-${escapeAttr(id)}"
        data-xt-tab="${escapeAttr(id)}"
        aria-selected="${active ? 'true' : 'false'}"
        aria-controls="xt-panel-${escapeAttr(id)}"
        tabindex="${active ? '0' : '-1'}"
      ><span class="xt-settings__tab-label">${escapeHtml(t[labelKey])}</span>${tabBadgeHtml(id)}</button>
    `;
  }).join('');
  return `<span class="xt-settings__tab-ink" aria-hidden="true"></span>${tabs}`;
}

function syncTabBadges(dialog, draft = {}) {
  const providerBadge = dialog.querySelector('[data-xt-tab-badge="providers"]');
  if (providerBadge) {
    providerBadge.textContent = providerBadgeLabel(draft.provider ?? settings.provider);
  }

  const targetLang = draft.targetLang ?? settings.targetLang;
  const generalBadge = dialog.querySelector('[data-xt-tab-badge="general"]');
  if (generalBadge) generalBadge.textContent = translationBadgeLabel(targetLang);

  const prevHours = settings.cacheHours;
  if (draft.cacheHours != null && Number.isFinite(draft.cacheHours)) {
    settings.cacheHours = draft.cacheHours;
  }
  const stats = getCacheUsageStats();
  settings.cacheHours = prevHours;

  const cacheBadge = dialog.querySelector('[data-xt-tab-badge="cache"]');
  if (cacheBadge) {
    cacheBadge.textContent = cacheBadgeLabel(stats);
    cacheBadge.dataset.level = cacheFillLevel(stats);
  }
  syncTabInk(dialog);
}

function panelAttrs(id, activeId) {
  const active = id === activeId;
  return `class="xt-settings__panel${active ? ' is-active' : ''}" id="xt-panel-${escapeAttr(id)}" role="tabpanel" aria-labelledby="xt-tab-${escapeAttr(id)}"${active ? '' : ' hidden'}`;
}

function syncTabInk(dialog) {
  const tabs = dialog.querySelector('.xt-settings__tabs');
  const ink = dialog.querySelector('.xt-settings__tab-ink');
  const active = dialog.querySelector('.xt-settings__tab.is-active');
  if (!tabs || !ink || !active) return;
  ink.style.width = `${active.offsetWidth}px`;
  ink.style.transform = `translateX(${active.offsetLeft}px)`;
}

function activateSettingsTab(dialog, tabId) {
  if (!SETTINGS_TABS.some((tab) => tab.id === tabId)) return;
  dialog.querySelectorAll('[data-xt-tab]').forEach((btn) => {
    const on = btn.getAttribute('data-xt-tab') === tabId;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
    btn.tabIndex = on ? 0 : -1;
  });
  dialog.querySelectorAll('[role="tabpanel"]').forEach((panel) => {
    const on = panel.id === `xt-panel-${tabId}`;
    panel.classList.toggle('is-active', on);
    panel.hidden = !on;
  });
  syncTabInk(dialog);
  dialog.querySelector('.xt-settings__tab.is-active')?.scrollIntoView({
    inline: 'nearest',
    block: 'nearest',
    behavior: 'smooth',
  });
}

function sectionHtml(title, body, { desc = '', className = '' } = {}) {
  const descHtml = desc
    ? `<p class="xt-section__desc">${escapeHtml(desc)}</p>`
    : '';
  return `
    <section class="xt-section${className ? ` ${className}` : ''}">
      <header class="xt-section__head">
        <h3 class="xt-section__title">${escapeHtml(title)}</h3>
        ${descHtml}
      </header>
      <div class="xt-section__body">${body}</div>
    </section>
  `;
}

function fieldHtml(label, control, hint = '') {
  return `
    <label class="xt-field">
      <span class="xt-field__label">${escapeHtml(label)}</span>
      ${control}
      ${hint ? `<span class="xt-field__hint">${escapeHtml(hint)}</span>` : ''}
    </label>
  `;
}

function listEditorHtml({
  title,
  hint,
  inputHtml,
  addAttr,
  hostAttr,
  hostHtml,
  addLabel,
}) {
  return `
    <div class="xt-list-editor">
      <div class="xt-list-editor__head">
        <div class="xt-list-editor__title">${escapeHtml(title)}</div>
        ${hint ? `<p class="xt-list-editor__hint">${escapeHtml(hint)}</p>` : ''}
      </div>
      <div class="xt-allowlist-add">
        ${inputHtml}
        <button type="button" class="xt-settings__ghost xt-settings__ghost--compact" ${addAttr}>${escapeHtml(addLabel || t.allowlistAdd)}</button>
      </div>
      <div class="xt-list-editor__host" ${hostAttr}>${hostHtml}</div>
    </div>
  `;
}

function buildGeneralPanelHtml() {
  const replaceHidden = settings.displayMode === 'replace' ? '' : ' hidden';
  const autoHidden = settings.translateMode === 'auto' ? '' : ' hidden';
  const allowHidden =
    settings.translateMode === 'auto' && settings.autoScope === 'allowlist'
      ? ''
      : 'hidden';

  const interfaceBody = fieldHtml(
    t.settingsUiLocale,
    `<select name="uiLocale">${localeOptions(settings.uiLocale)}</select>`
  );

  const translateBody = `
    <div class="xt-grid">
      ${fieldHtml(
        t.settingsTargetLang,
        `<select name="targetLang">${langOptions(settings.targetLang)}</select>`
      )}
      ${fieldHtml(
        t.settingsTranslateMode,
        `<select name="translateMode">
          <option value="button"${settings.translateMode !== 'auto' ? ' selected' : ''}>${escapeHtml(t.translateModeButton)}</option>
          <option value="auto"${settings.translateMode === 'auto' ? ' selected' : ''}>${escapeHtml(t.translateModeAuto)}</option>
        </select>`,
        t.settingsTranslateModeHint
      )}
      ${fieldHtml(
        t.settingsDisplayMode,
        `<select name="displayMode">
          <option value="panel"${settings.displayMode !== 'replace' ? ' selected' : ''}>${escapeHtml(t.displayModePanel)}</option>
          <option value="replace"${settings.displayMode === 'replace' ? ' selected' : ''}>${escapeHtml(t.displayModeReplace)}</option>
        </select>`,
        t.settingsDisplayModeHint
      )}
      <div class="xt-replace-options" data-xt-replace-options${replaceHidden}>
        ${fieldHtml(
          t.settingsReplaceReveal,
          `<select name="replaceReveal">
            <option value="button"${settings.replaceReveal !== 'hover' && settings.replaceReveal !== 'split' ? ' selected' : ''}>${escapeHtml(t.replaceRevealButton)}</option>
            <option value="hover"${settings.replaceReveal === 'hover' ? ' selected' : ''}>${escapeHtml(t.replaceRevealHover)}</option>
            <option value="split"${settings.replaceReveal === 'split' ? ' selected' : ''}>${escapeHtml(t.replaceRevealSplit)}</option>
          </select>`,
          t.settingsReplaceRevealHint
        )}
      </div>
    </div>
    <div class="xt-auto-options" data-xt-auto-options${autoHidden}>
      ${fieldHtml(
        t.settingsAutoScope,
        `<select name="autoScope">
          <option value="all"${settings.autoScope !== 'allowlist' ? ' selected' : ''}>${escapeHtml(t.autoScopeAll)}</option>
          <option value="allowlist"${settings.autoScope === 'allowlist' ? ' selected' : ''}>${escapeHtml(t.autoScopeAllowlist)}</option>
        </select>`,
        t.settingsAutoScopeHint
      )}
      <div class="xt-allowlist-panel" data-xt-allowlist-panel ${allowHidden}>
        ${listEditorHtml({
          title: t.autoScopeAllowlist,
          hint: t.settingsAllowlistHint,
          inputHtml: `<input name="allowlistInput" type="text" autocomplete="off" spellcheck="false" placeholder="${escapeAttr(t.allowlistPlaceholder)}" />`,
          addAttr: 'data-xt-allowlist-add="1"',
          hostAttr: 'data-xt-allowlist-host',
          hostHtml: buildHandleListHtml(settings.autoAllowlist, 'allowlistEmpty'),
        })}
      </div>
    </div>
    <label class="xt-check xt-check--card">
      <span class="xt-check__text">
        <span class="xt-check__title">${escapeHtml(t.settingsSkipNative)}</span>
        <span class="xt-check__hint">${escapeHtml(t.settingsSkipNativeHint)}</span>
      </span>
      <input name="skipNativeAutoTranslate" type="checkbox"${settings.skipNativeAutoTranslate !== false ? ' checked' : ''} />
      <span class="xt-check__track" aria-hidden="true"></span>
    </label>
  `;

  const accountsBody = listEditorHtml({
    title: t.settingsAccountBlocklist,
    hint: t.settingsAccountBlocklistHint,
    inputHtml: `<input name="blocklistInput" type="text" autocomplete="off" spellcheck="false" placeholder="${escapeAttr(t.allowlistPlaceholder)}" />`,
    addAttr: 'data-xt-blocklist-add="1"',
    hostAttr: 'data-xt-blocklist-host',
    hostHtml: buildHandleListHtml(settings.accountBlocklist, 'blocklistEmpty'),
  });

  const languagesBody = `
    <div class="xt-grid">
      ${listEditorHtml({
        title: t.settingsLangAllowlist,
        hint: t.settingsLangAllowlistHint,
        inputHtml: `<select name="langAllowInput">${langPickerOptions(settings.langAllowlist)}</select>`,
        addAttr: 'data-xt-lang-allow-add="1"',
        hostAttr: 'data-xt-lang-allow-host',
        hostHtml: buildLangListHtml(settings.langAllowlist, 'langListEmpty'),
        addLabel: t.langListAdd,
      })}
      ${listEditorHtml({
        title: t.settingsLangBlocklist,
        hint: t.settingsLangBlocklistHint,
        inputHtml: `<select name="langBlockInput">${langPickerOptions(settings.langBlocklist)}</select>`,
        addAttr: 'data-xt-lang-block-add="1"',
        hostAttr: 'data-xt-lang-block-host',
        hostHtml: buildLangListHtml(settings.langBlocklist, 'langListEmpty'),
        addLabel: t.langListAdd,
      })}
    </div>
  `;

  return (
    sectionHtml(t.settingsSectionInterface, interfaceBody) +
    sectionHtml(t.settingsSectionTranslate, translateBody) +
    sectionHtml(t.settingsSectionAccounts, accountsBody) +
    sectionHtml(t.settingsSectionLanguages, languagesBody)
  );
}

function langLabel(code) {
  const normalized = normalizeLangCode(code);
  const row = TARGET_LANGUAGES.find(
    (l) => normalizeLangCode(l.code) === normalized
  );
  if (!row) return code;
  return `${row.flag} ${row.name}`;
}

function buildHandleListHtml(list, emptyKey) {
  const handles = Array.isArray(list) ? list : [];
  if (!handles.length) {
    return `<p class="xt-empty">${escapeHtml(t[emptyKey] || t.allowlistEmpty)}</p>`;
  }
  return `
    <ul class="xt-allowlist">
      ${handles
        .map(
          (handle) => `
        <li class="xt-allowlist__item" data-xt-handle-item data-handle="${escapeAttr(handle)}">
          <span class="xt-allowlist__handle">${escapeHtml(formatHandleDisplay(handle))}</span>
          <button type="button" class="xt-allowlist__remove" data-xt-handle-remove="${escapeAttr(handle)}" aria-label="${escapeAttr(t.allowlistRemove)}">×</button>
        </li>`
        )
        .join('')}
    </ul>
  `;
}

function buildLangListHtml(list, emptyKey) {
  const codes = Array.isArray(list) ? list : [];
  if (!codes.length) {
    return `<p class="xt-empty">${escapeHtml(t[emptyKey] || t.langListEmpty)}</p>`;
  }
  return `
    <ul class="xt-allowlist">
      ${codes
        .map(
          (code) => `
        <li class="xt-allowlist__item" data-xt-lang-item data-code="${escapeAttr(code)}">
          <span class="xt-allowlist__handle">${escapeHtml(langLabel(code))}</span>
          <button type="button" class="xt-allowlist__remove" data-xt-lang-remove="${escapeAttr(code)}" aria-label="${escapeAttr(t.allowlistRemove)}">×</button>
        </li>`
        )
        .join('')}
    </ul>
  `;
}

function readHandleListFromHost(form, hostSel) {
  return [...form.querySelectorAll(`${hostSel} [data-xt-handle-item]`)]
    .map((el) => normalizeHandle(el.getAttribute('data-handle')))
    .filter(Boolean);
}

function readLangListFromHost(form, hostSel) {
  return [...form.querySelectorAll(`${hostSel} [data-xt-lang-item]`)]
    .map((el) => normalizeLangCode(el.getAttribute('data-code')))
    .filter(Boolean);
}

function paintHandleList(form, hostSel, list, emptyKey) {
  const host = form.querySelector(hostSel);
  if (!host) return;
  host.innerHTML = buildHandleListHtml(list, emptyKey);
}

function paintLangList(form, hostSel, list, emptyKey) {
  const host = form.querySelector(hostSel);
  if (!host) return;
  host.innerHTML = buildLangListHtml(list, emptyKey);
}

function langPickerOptions(exclude = []) {
  const blocked = new Set(exclude.map(normalizeLangCode));
  return TARGET_LANGUAGES.map((l) => {
    const code = normalizeLangCode(l.code);
    if (blocked.has(code)) return '';
    return `<option value="${escapeAttr(code)}">${escapeHtml(`${l.flag} ${l.name}`)}</option>`;
  }).join('');
}

function syncOptionVisibility(dialog) {
  const form = dialog?.querySelector('form');
  if (!form) return;
  const mode = form.translateMode?.value === 'auto' ? 'auto' : 'button';
  const scope = form.autoScope?.value === 'allowlist' ? 'allowlist' : 'all';
  const display = form.displayMode?.value === 'replace' ? 'replace' : 'panel';
  const autoOpts = form.querySelector('[data-xt-auto-options]');
  const allowPanel = form.querySelector('[data-xt-allowlist-panel]');
  const replaceOpts = form.querySelector('[data-xt-replace-options]');
  if (autoOpts) autoOpts.hidden = mode !== 'auto';
  if (allowPanel) allowPanel.hidden = !(mode === 'auto' && scope === 'allowlist');
  if (replaceOpts) replaceOpts.hidden = display !== 'replace';
}

function readForm(form) {
  const cacheHours = Number(form.cacheHours.value);
  const provider = form.provider?.value || 'google';
  const providerConfig = { ...settings.providerConfig };

  for (const p of TRANSLATION_PROVIDERS) {
    const next = { ...(providerConfig[p.id] || {}) };
    for (const field of p.fields) {
      const el = form.querySelector(`[name="provider.${p.id}.${field.key}"]`);
      if (!el) continue;
      next[field.key] = String(el.value ?? '').trim();
    }
    providerConfig[p.id] = next;
  }

  return {
    ...settings,
    provider,
    providerConfig,
    targetLang: form.targetLang.value || 'auto',
    uiLocale: form.uiLocale.value || 'auto',
    cacheHours:
      Number.isFinite(cacheHours) && cacheHours >= 0
        ? Math.min(cacheHours, CACHE_HOURS_MAX)
        : DEFAULT_SETTINGS.cacheHours,
    translateMode: form.translateMode?.value === 'auto' ? 'auto' : 'button',
    displayMode: form.displayMode?.value === 'replace' ? 'replace' : 'panel',
    replaceReveal:
      form.replaceReveal?.value === 'hover' || form.replaceReveal?.value === 'split'
        ? form.replaceReveal.value
        : 'button',
    autoScope: form.autoScope?.value === 'allowlist' ? 'allowlist' : 'all',
    skipNativeAutoTranslate: Boolean(form.skipNativeAutoTranslate?.checked),
    autoAllowlist: readHandleListFromHost(form, '[data-xt-allowlist-host]'),
    accountBlocklist: readHandleListFromHost(form, '[data-xt-blocklist-host]'),
    langAllowlist: readLangListFromHost(form, '[data-xt-lang-allow-host]'),
    langBlocklist: readLangListFromHost(form, '[data-xt-lang-block-host]'),
  };
}

function lockPageScroll() {
  const html = document.documentElement;
  const body = document.body;
  if (!body || html.classList.contains('xt-scroll-lock')) return;

  const scrollY = window.scrollY || html.scrollTop || 0;
  body.dataset.xtScrollY = String(scrollY);
  html.classList.add('xt-scroll-lock');
  body.classList.add('xt-scroll-lock');
  body.style.top = `-${scrollY}px`;
}

function unlockPageScroll() {
  const html = document.documentElement;
  const body = document.body;
  if (!body || !html.classList.contains('xt-scroll-lock')) return;

  const scrollY = Number(body.dataset.xtScrollY || 0);
  html.classList.remove('xt-scroll-lock');
  body.classList.remove('xt-scroll-lock');
  body.style.top = '';
  delete body.dataset.xtScrollY;
  window.scrollTo(0, scrollY);
}

function closeSettings() {
  document.getElementById(ROOT_ID)?.remove();
  unlockPageScroll();
}

export function openSettings() {
  closeSettings();
  reloadRuntimeSettings();

  const activeTab = 'general';
  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.className = 'xt-settings-backdrop';
  root.innerHTML = `
    <div class="xt-settings" role="dialog" aria-modal="true" aria-labelledby="xt-settings-title">
      <header class="xt-settings__header">
        <button type="button" class="xt-settings__x" data-xt-close="1" aria-label="${escapeAttr(t.settingsClose)}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10.59 12 4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z"/></svg>
        </button>
        <div class="xt-settings__heading">
          <h2 id="xt-settings-title">${escapeHtml(t.settingsTitle)}</h2>
          <p class="xt-settings__ver">v${escapeHtml(SCRIPT_VERSION)}</p>
        </div>
        <span class="xt-settings__header-spacer" aria-hidden="true"></span>
      </header>
      <div class="xt-settings__tabs" role="tablist" aria-label="${escapeAttr(t.settingsTitle)}">
        ${buildTabsHtml(activeTab)}
      </div>
      <form class="xt-settings__form">
        <div class="xt-settings__body">
          <div ${panelAttrs('general', activeTab)}>
            ${buildGeneralPanelHtml()}
          </div>
          <div ${panelAttrs('providers', activeTab)}>
            ${sectionHtml(
              t.settingsSectionProvider,
              `
                ${fieldHtml(
                  t.settingsProvider,
                  `<select name="provider">${providerOptions(settings.provider)}</select>`,
                  t.settingsProviderHint
                )}
                <div class="xt-provider-panels" data-xt-provider-panels>
                  ${buildProviderFieldsHtml(settings.provider)}
                </div>
              `
            )}
          </div>
          <div ${panelAttrs('cache', activeTab)}>
            ${sectionHtml(
              t.settingsSectionCache,
              `
                ${buildCacheMeterHtml()}
                <div class="xt-grid">
                  ${fieldHtml(
                    t.settingsCacheHours,
                    `<input name="cacheHours" type="number" min="0" max="${CACHE_HOURS_MAX}" step="1" value="${escapeAttr(String(settings.cacheHours))}" />`,
                    t.settingsCacheHint
                  )}
                  <div class="xt-section__actions">
                    <button type="button" class="xt-settings__ghost xt-settings__ghost--danger" data-xt-clear="1">${escapeHtml(t.settingsClearCache)}</button>
                  </div>
                </div>
              `
            )}
          </div>
          <div ${panelAttrs('about', activeTab)}>
            <div class="xt-about">
              <p class="xt-about__desc">${escapeHtml(t.aboutDescription)}</p>
              <a
                class="xt-about__repo"
                href="${escapeAttr(REPO_URL)}"
                target="_blank"
                rel="noopener noreferrer"
              >${escapeHtml(t.aboutRepo)}</a>
              <div class="xt-about__author">
                <img
                  class="xt-about__avatar"
                  src="${escapeAttr(AUTHOR_AVATAR_URL)}"
                  alt=""
                  width="56"
                  height="56"
                  decoding="async"
                />
                <div class="xt-about__meta">
                  <a
                    class="xt-about__name"
                    href="${escapeAttr(AUTHOR_URL)}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >${escapeHtml(AUTHOR_NAME)}</a>
                  <span class="xt-about__handle">@${escapeHtml(AUTHOR_HANDLE)}</span>
                  <a class="xt-about__email" href="mailto:${escapeAttr(AUTHOR_EMAIL)}">${escapeHtml(AUTHOR_EMAIL)}</a>
                </div>
              </div>
              <p class="xt-about__foot">${escapeHtml(t.aboutLicense)} · v${escapeHtml(SCRIPT_VERSION)}</p>
            </div>
          </div>
        </div>
        <div class="xt-settings__actions">
          <button type="submit" class="xt-settings__primary">${escapeHtml(t.settingsSave)}</button>
        </div>
      </form>
    </div>
  `;

  const dialog = root.querySelector('.xt-settings');

  root.addEventListener('click', (e) => {
    if (e.target === root || e.target.closest?.('[data-xt-close]')) {
      closeSettings();
    }
  });

  dialog?.querySelector('.xt-settings__tabs')?.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('[data-xt-tab]');
    if (!btn || !dialog.contains(btn)) return;
    activateSettingsTab(dialog, btn.getAttribute('data-xt-tab'));
  });

  dialog?.querySelector('.xt-settings__tabs')?.addEventListener('keydown', (e) => {
    const tabs = [...dialog.querySelectorAll('[data-xt-tab]')];
    const current = e.target?.closest?.('[data-xt-tab]');
    if (!current || !tabs.length) return;
    const idx = tabs.indexOf(current);
    let next = idx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    const tabId = tabs[next].getAttribute('data-xt-tab');
    activateSettingsTab(dialog, tabId);
    tabs[next].focus();
  });

  const form = root.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const next = readForm(form);
    saveSettings(next);
    reloadRuntimeSettings();
    ensureNavSettingsButton();
    scanPosts();
    showToast(t.settingsSaved, { type: 'success' });
    closeSettings();
  });

  root.querySelector('[data-xt-clear]')?.addEventListener('click', () => {
    clearCache();
    paintCacheMeter(dialog);
    syncTabBadges(dialog, {
      cacheHours: Number(form.cacheHours?.value),
      targetLang: form.targetLang?.value,
      provider: form.provider?.value,
    });
    showToast(t.settingsCacheCleared, { type: 'info' });
  });

  const cacheHoursInput = form.querySelector('input[name="cacheHours"]');
  cacheHoursInput?.addEventListener('input', () => {
    const draft = Number(cacheHoursInput.value);
    const prev = settings.cacheHours;
    if (Number.isFinite(draft) && draft >= 0) settings.cacheHours = draft;
    paintCacheMeter(dialog);
    settings.cacheHours = prev;
    syncTabBadges(dialog, {
      cacheHours: Number.isFinite(draft) ? draft : settings.cacheHours,
      targetLang: form.targetLang?.value,
      provider: form.provider?.value,
    });
  });

  form.querySelector('select[name="targetLang"]')?.addEventListener('change', () => {
    syncTabBadges(dialog, {
      targetLang: form.targetLang.value,
      cacheHours: Number(form.cacheHours?.value),
      provider: form.provider?.value,
    });
  });

  form.querySelector('select[name="translateMode"]')?.addEventListener('change', () => {
    syncOptionVisibility(dialog);
  });

  form.querySelector('select[name="autoScope"]')?.addEventListener('change', () => {
    syncOptionVisibility(dialog);
  });

  form.querySelector('select[name="displayMode"]')?.addEventListener('change', () => {
    syncOptionVisibility(dialog);
  });

  function addHandleToHost(inputName, hostSel, addBtnSel, emptyKey) {
    const input = form.querySelector(`input[name="${inputName}"]`);
    const handle = normalizeHandle(input?.value);
    if (!handle) {
      showToast(t.allowlistInvalid, { type: 'warning' });
      return;
    }
    const list = readHandleListFromHost(form, hostSel);
    if (list.includes(handle)) {
      showToast(fmt(t.allowlistExists, { handle: formatHandleDisplay(handle) }), {
        type: 'info',
      });
      return;
    }
    list.push(handle);
    list.sort();
    paintHandleList(form, hostSel, list, emptyKey);
    if (input) input.value = '';
    input?.focus();
  }

  function addLangToHost(selectName, hostSel, emptyKey) {
    const select = form.querySelector(`select[name="${selectName}"]`);
    const code = normalizeLangCode(select?.value);
    if (!code) return;
    const list = readLangListFromHost(form, hostSel);
    if (list.includes(code)) {
      showToast(fmt(t.langListExists, { lang: langLabel(code) }), { type: 'info' });
      return;
    }
    list.push(code);
    list.sort();
    paintLangList(form, hostSel, list, emptyKey);
    if (select) select.innerHTML = langPickerOptions(list);
  }

  form.querySelector('[data-xt-allowlist-add]')?.addEventListener('click', () => {
    addHandleToHost('allowlistInput', '[data-xt-allowlist-host]', null, 'allowlistEmpty');
  });

  form.querySelector('input[name="allowlistInput"]')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    form.querySelector('[data-xt-allowlist-add]')?.click();
  });

  form.querySelector('[data-xt-blocklist-add]')?.addEventListener('click', () => {
    addHandleToHost('blocklistInput', '[data-xt-blocklist-host]', null, 'blocklistEmpty');
  });

  form.querySelector('input[name="blocklistInput"]')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    form.querySelector('[data-xt-blocklist-add]')?.click();
  });

  form.querySelector('[data-xt-lang-allow-add]')?.addEventListener('click', () => {
    addLangToHost('langAllowInput', '[data-xt-lang-allow-host]', 'langListEmpty');
  });

  form.querySelector('[data-xt-lang-block-add]')?.addEventListener('click', () => {
    addLangToHost('langBlockInput', '[data-xt-lang-block-host]', 'langListEmpty');
  });

  form.addEventListener('click', (e) => {
    const handleBtn = e.target?.closest?.('[data-xt-handle-remove]');
    if (handleBtn && form.contains(handleBtn)) {
      const handle = normalizeHandle(handleBtn.getAttribute('data-xt-handle-remove'));
      const host = handleBtn.closest('[data-xt-allowlist-host], [data-xt-blocklist-host]');
      if (!host) return;
      const hostSel = host.hasAttribute('data-xt-allowlist-host')
        ? '[data-xt-allowlist-host]'
        : '[data-xt-blocklist-host]';
      const emptyKey =
        hostSel === '[data-xt-allowlist-host]' ? 'allowlistEmpty' : 'blocklistEmpty';
      const list = readHandleListFromHost(form, hostSel).filter((item) => item !== handle);
      paintHandleList(form, hostSel, list, emptyKey);
      return;
    }

    const langBtn = e.target?.closest?.('[data-xt-lang-remove]');
    if (langBtn && form.contains(langBtn)) {
      const code = normalizeLangCode(langBtn.getAttribute('data-xt-lang-remove'));
      const host = langBtn.closest('[data-xt-lang-allow-host], [data-xt-lang-block-host]');
      if (!host) return;
      const isAllow = host.hasAttribute('data-xt-lang-allow-host');
      const hostSel = isAllow ? '[data-xt-lang-allow-host]' : '[data-xt-lang-block-host]';
      const selectName = isAllow ? 'langAllowInput' : 'langBlockInput';
      const list = readLangListFromHost(form, hostSel).filter((item) => item !== code);
      paintLangList(form, hostSel, list, 'langListEmpty');
      const select = form.querySelector(`select[name="${selectName}"]`);
      if (select) select.innerHTML = langPickerOptions(list);
      return;
    }
  });

  form.querySelector('select[name="provider"]')?.addEventListener('change', () => {
    const provider = form.provider.value;
    syncProviderFields(dialog, provider);
    syncTabBadges(dialog, {
      provider,
      targetLang: form.targetLang?.value,
      cacheHours: Number(form.cacheHours?.value),
    });
  });

  document.addEventListener(
    'keydown',
    function onKey(e) {
      if (e.key === 'Escape') {
        closeSettings();
        document.removeEventListener('keydown', onKey, true);
      }
    },
    true
  );

  (document.body || document.documentElement).appendChild(root);
  lockPageScroll();
  requestAnimationFrame(() => {
    syncTabBadges(dialog);
    syncTabInk(dialog);
    syncOptionVisibility(dialog);
  });
}
