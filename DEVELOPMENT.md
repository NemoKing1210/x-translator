# Development

Local setup, repository layout, and release notes for X Translator.

For contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md). Agent-oriented architecture notes live in [AGENTS.md](AGENTS.md).

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ (see `.nvmrc` and `engines` in `package.json`)
- npm
- A userscript manager for browser testing ([Tampermonkey](https://www.tampermonkey.net/), [Violentmonkey](https://violentmonkey.github.io/), or [ScriptCat](https://scriptcat.org/))

## Scripts

```bash
npm install
npm run dev      # Vite serve — open/install the generated "dev:" userscript
npm run build    # Production → dist/ + copy to repo root
npm run ci       # Same checks as GitHub Actions (build + verify artifacts)
```

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite + vite-plugin-monkey; installable userscript prefixed with `dev:` |
| `npm run build` | Production bundle → `dist/`, then copy to root install artifacts |
| `npm run verify:artifacts` | Ensure `dist/` matches committed root `.user.js` / `.meta.js` |
| `npm run ci` | `build` + `verify:artifacts` (set `CI=true` or pass `--git` for freshness vs HEAD) |

## Local workflow

1. Edit source under [`src/`](src/) (entry: [`src/main.js`](src/main.js)).
2. Userscript metadata (`@match`, `@connect`, localized `@name` / `@description`, …) lives in [`vite.config.js`](vite.config.js) — not in the built files.
3. Version is `package.json` → header `@version` and in-script `SCRIPT_VERSION`.
4. After changes that should ship, run `npm run build` and commit the regenerated root `x-translator.user.js` / `x-translator.meta.js`.
5. Pull requests run [CI](.github/workflows/ci.yml), which fails if those files are out of date.

### Notes

- **`npm run dev`:** install the served userscript once in your manager; HMR applies while the server runs.
- **Built file:** after `npm run build`, you can install the root `x-translator.user.js` (Violentmonkey **Track local file** works on that artifact).
- Do **not** hand-edit committed `.user.js` / `.meta.js`.
- Do **not** commit localhost `@updateURL` / `@downloadURL` values.

### Configuration

Shared constants and selectors live in [`src/constants.js`](src/constants.js) (`POST_TEXT_SELECTORS`, storage keys, `DEFAULT_SETTINGS`). Feature toggles and UI strings are in settings / [`src/i18n/`](src/i18n/).

When X’s DOM changes and Translate buttons vanish, start with `POST_TEXT_SELECTORS`, then [`src/features/author.js`](src/features/author.js), nav injection in [`src/features/settings-panel.js`](src/features/settings-panel.js), and caret menu hooks in [`src/features/post-menu.js`](src/features/post-menu.js).

## How it works

```
x.com / twitter.com (SPA)
       │
       ▼
scanPage (MutationObserver + history / href poll)
       │
       ▼
[data-testid="tweetText"] in article[data-testid="tweet"]
       │
       ▼
Translate toolbar (button or auto IntersectionObserver)
       │
       ▼
extractLinkedText → translateText (cache / provider)
       │
       ▼
panel result or replace-in-place display
```

Settings open from the left **Translator** nav item or `GM_registerMenuCommand`. Translations persist in `xt_cache_v1`; settings in `xt_settings`.

## Repository layout

```text
x-translator/
├── src/                     # ESM source (edit here)
│   ├── main.js              # Bootstrap / init
│   ├── constants.js         # Keys, URLs, selectors, DEFAULT_SETTINGS
│   ├── state.js             # Mutable settings / locale / cache handles
│   ├── settings.js          # load/save settings
│   ├── cache.js             # GM translation cache
│   ├── gm.js                # GM_xmlhttpRequest wrapper
│   ├── theme.js             # Light/dark sync with X
│   ├── api/                 # translate router + provider clients
│   ├── providers/           # Provider registry (fields / defaults)
│   ├── features/            # Posts, SPA, settings, toasts, nav, tweet menu
│   ├── i18n/                # UI strings (8 locales)
│   ├── styles/              # Injected CSS
│   └── utils/               # handle, linked-text, html, debounce
├── scripts/                 # Build / CI helpers
├── package.json             # Version + npm scripts
├── vite.config.js           # Vite + vite-plugin-monkey metadata
├── x-translator.user.js     # Built installable userscript (committed)
├── x-translator.meta.js     # Built metadata companion (committed)
├── README.md
├── DEVELOPMENT.md
├── CONTRIBUTING.md
├── AGENTS.md
├── CHANGELOG.md
└── LICENSE
```

| File | Purpose |
|------|---------|
| `src/` | Source of truth for script logic (modules) |
| `x-translator.user.js` | Full script served at `@downloadURL` / `@updateURL` (build output) |
| `x-translator.meta.js` | Lightweight metadata mirror; managers may fetch it for update checks |

## Script metadata

Key `// ==UserScript==` fields used by managers (declared in `vite.config.js`):

| Field | Value |
|-------|-------|
| `@namespace` | `https://github.com/NemoKing1210/x-translator` |
| `@version` | Semantic version (must be bumped on every release) |
| `@updateURL` / `@downloadURL` | Raw GitHub URL of `x-translator.user.js` |
| `@homepageURL` | This repository |
| `@supportURL` | GitHub Issues |
| `@license` | MIT |
| `@grant` | `GM_xmlhttpRequest`, `GM_getValue`, `GM_setValue`, `GM_addStyle`, `GM_registerMenuCommand` |
| `@connect` | `translate.googleapis.com`, DeepL / Microsoft / OpenAI / Yandex / LibreTranslate hosts, `*` |
| `@match` | `https://x.com/*`, `https://www.x.com/*`, `https://twitter.com/*`, `https://www.twitter.com/*` |

Localized `@name` and `@description` tags are provided for en, ru, zh-CN, es, pt-BR, de, fr, and ja.

## Required permissions

| Grant | Purpose |
|-------|---------|
| `GM_xmlhttpRequest` | Call translation providers (bypasses CORS) |
| `GM_getValue` / `GM_setValue` | Persist settings and translation cache |
| `GM_addStyle` | Inject UI styles |
| `GM_registerMenuCommand` | Open settings from the manager menu |

Do not expand `@connect` or `@grant` beyond what is needed.

## Adding a translation provider

1. Client under `src/api/providers/`.
2. Fields / defaults in `src/providers/registry.js`.
3. Wire dispatch in `src/api/translate.js`.
4. New hosts in `vite.config.js` `@connect`.
5. UI strings in **all** locales in `src/i18n/translations.js`.

## Releases

1. Bump `version` in [`package.json`](package.json) (single source of truth for `@version` and `SCRIPT_VERSION`).
2. Run `npm run build` to regenerate root `x-translator.user.js` / `.meta.js`.
3. Add a Keep a Changelog entry in [`CHANGELOG.md`](CHANGELOG.md).
4. Update the README version badge / docs if they mention the version or new behavior.
5. Push to `main` (or create a GitHub Release).

Catalog pages on Greasy Fork / ScriptCat may lag behind GitHub; `@updateURL` / `@downloadURL` point at GitHub `main`.
