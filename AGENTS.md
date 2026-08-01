# AGENTS.md — X Translator

Instructions for AI coding agents working in this repository.

## Project

Userscript that adds in-place post translation on [X](https://x.com) / Twitter. Compatible with Tampermonkey, Violentmonkey, Greasemonkey, [ScriptCat](https://scriptcat.org/), and similar managers.

Built with [Vite](https://vitejs.dev/) + [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey).

- **Source:** `src/main.js`
- **Canonical install artifacts (committed):** `x-translator.user.js`, `x-translator.meta.js` (also `@downloadURL` / `@updateURL`)
- **Version source of truth:** `package.json` `version` (userscript header + `SCRIPT_VERSION`)
- **Docs:** `README.md`, `CHANGELOG.md` (Keep a Changelog + SemVer)
- **License:** MIT

Edit source under `src/`, then run `npm run build` to refresh the root install files. Do not hand-edit the built `.user.js` / `.meta.js`.

## Repository layout

```text
x-translator/
├── src/
│   ├── main.js              # Bootstrap / init
│   ├── constants.js         # Keys, URLs, DEFAULT_SETTINGS, selectors
│   ├── state.js             # Mutable settings / locale / cache handles
│   ├── settings.js          # load/save settings
│   ├── cache.js             # GM translation cache
│   ├── gm.js                # GM_xmlhttpRequest wrapper
│   ├── api/                 # translate router + provider clients
│   ├── providers/           # Provider registry (fields / defaults)
│   ├── i18n/                # TRANSLATIONS + locale helpers
│   ├── utils/               # html, debounce, handle
│   ├── styles/              # CSS (injected via vite-plugin-monkey)
│   └── features/            # posts, SPA observer, settings UI, toasts
├── scripts/
│   ├── copy-dist.mjs        # Copies dist → root after build
│   ├── verify-artifacts.mjs # CI: dist ↔ root + git freshness
│   └── lib/artifacts.mjs    # Shared artifact filenames
├── .github/
│   ├── workflows/ci.yml     # Build + verify committed artifacts
│   └── dependabot.yml
├── dist/                    # Vite output (gitignored)
├── x-translator.user.js
├── x-translator.meta.js
├── package.json
├── vite.config.js
├── README.md
├── CHANGELOG.md
├── LICENSE
├── AGENTS.md
├── DEVELOPMENT.md
├── CONTRIBUTING.md
└── CLAUDE.md
```

## Architecture (high level)

1. Match `https://x.com/*` and `https://twitter.com/*` at `document-idle`.
2. Bootstrap styles, settings, DOM scan, `MutationObserver`, and SPA href hooks (`pushState` / `replaceState` / poll).
3. Find tweet text via `POST_TEXT_SELECTORS` (`[data-testid="tweetText"]` — posts and replies).
4. Inject a **Translate** toolbar as a sibling after each text node (quote cards: append inside quote); on click call the configured provider via `GM_xmlhttpRequest`.
5. Show the translation in a result box; toggle hide/show on the same button.
6. Cache successful translations in `GM_getValue` / `GM_setValue` (`xt_cache_v1`); settings in `xt_settings` (including `provider` + `providerConfig`).
7. Settings via sidebar **Translator** / `GM_registerMenuCommand`; toasts for save / cache clear.

Keep rate limits polite: cache TTLs, request dedupe (`inflight`), debounce on DOM rescans.

X’s web client DOM changes often — prefer `data-testid` selectors and keep fallbacks easy to adjust in `constants.js`.

Translation providers live under `src/providers/registry.js` + `src/api/providers/*`. Add a provider there, wire it in `src/api/translate.js`, and declare any new hosts in `vite.config.js` `@connect`.

## Conventions

- Vanilla JS ESM modules under `src/`; no frameworks. Import GM APIs from `$` (`vite-plugin-monkey/dist/client`).
- Prefer existing patterns: constants in `constants.js`, locale strings in `i18n/`, APIs in `api/`, UI hooks in `features/`. Mutable runtime state lives in `state.js`.
- Prefix DOM / storage keys with `xt-` / `xt_`.
- Do not expand `@connect` or `@grant` beyond what is needed (declare in `vite.config.js`).
- Userscript metadata lives in `vite.config.js` — not hand-written in built files.
- Do not commit localhost `@updateURL` / `@downloadURL` values.
- After changing source or metadata, run `npm run build` so root `.user.js` / `.meta.js` stay in sync.
- Production builds minify JS/CSS; edit `src/` for readable code, not the committed bundle.
- **Always bump the script version** in `package.json` when shipping changes (features, fixes, UI, i18n, metadata). `version` is the single source of truth for `@version` and `SCRIPT_VERSION` — do not leave it unchanged across user-visible updates.
- **Keep [`README.md`](README.md) in sync** with the product: when something is added, changed, removed, or renamed (features, settings tabs/options, install flow, supported managers, locales, target languages, architecture, FAQ), update the matching README sections the same change. Do not leave docs describing behavior that no longer exists.

## Releases

When making any change that should reach users (including fixes and UI polish):

1. Bump `version` in `package.json` (SemVer: patch for fixes, minor for features).
2. Run `npm run build`.
3. Add a Keep a Changelog entry in `CHANGELOG.md`.
4. Update [`README.md`](README.md) wherever the change is user-visible or developer-facing.

## Localization

UI locales: `en`, `ru`, `zh`, `es`, `pt`, `de`, `fr`, `ja` (plus `auto` = browser).

- Add every new user-facing string to **all** `TRANSLATIONS` locales.
- Keep localized `@name` / `@description` in `vite.config.js` aligned when changing the product description.

## Do not

- Hand-edit committed `x-translator.user.js` / `.meta.js` (always rebuild).
- Add TypeScript or a frontend framework unless explicitly requested.
- Imply affiliation with X Corp. / Twitter in docs or UI copy.
- Break X’s native navigation, composer, or infinite scroll.

## Local testing

```bash
npm install
npm run dev      # Vite serve — install the generated server userscript (prefix "dev:")
npm run build    # Production bundle → dist/ + copy to repo root
npm run ci       # build + verify committed artifacts match
```

- **Violentmonkey / Tampermonkey / ScriptCat:** install from the Vite open URL during `npm run dev`, or from the built root `x-translator.user.js` after `npm run build`.
- CI runs `npm ci` → `npm run ci` on pushes/PRs to `main`.
