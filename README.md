# X Translator

[![CI](https://github.com/NemoKing1210/x-translator/actions/workflows/ci.yml/badge.svg)](https://github.com/NemoKing1210/x-translator/actions/workflows/ci.yml)
[![Install userscript](https://img.shields.io/badge/⬇_Install-userscript-1d9bf0?style=for-the-badge)](https://raw.githubusercontent.com/NemoKing1210/x-translator/main/x-translator.user.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.2.6-green?style=for-the-badge)](CHANGELOG.md)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=for-the-badge)](package.json)

Userscript that adds **in-place translation** for posts and replies on [X](https://x.com) (Twitter) — without leaving the feed.

Compatible with [Tampermonkey](https://www.tampermonkey.net/), [Violentmonkey](https://violentmonkey.github.io/), [Greasemonkey](https://www.greasespot.net/), [ScriptCat](https://scriptcat.org/), and other managers that support the `// ==UserScript==` metadata block.

> **Status:** stable (`1.2.6`) — translate posts & comments in place, multiple providers, cache, filters, UI matched to X light / dim / lights-out.
> **Note:** Not affiliated with X Corp. or Twitter.

---

## Table of contents

- [Quick install](#quick-install)
- [Features](#features)
- [Settings](#settings)
- [How it works](#how-it-works)
- [Updates](#updates)
- [FAQ](#faq)
- [Author](#author)
- [License](#license)

---

## Quick install

1. Install a userscript manager ([Tampermonkey](https://www.tampermonkey.net/), [Violentmonkey](https://violentmonkey.github.io/), or [ScriptCat](https://scriptcat.org/) recommended).
2. Install from the GitHub raw URL below (or build locally).

**Install URL (GitHub — newest):**

```
https://raw.githubusercontent.com/NemoKing1210/x-translator/main/x-translator.user.js
```

<p align="center">
  <a href="https://raw.githubusercontent.com/NemoKing1210/x-translator/main/x-translator.user.js"><img src="https://img.shields.io/badge/⬇_Install-GitHub_raw-1a1d24?style=for-the-badge&labelColor=1d9bf0" alt="Install from GitHub" /></a>
</p>

### Install from URL (manager dashboard)

| Manager | Path |
|---------|------|
| Tampermonkey | Dashboard → **Utilities** → **Install from URL** |
| Violentmonkey | Dashboard → **+** → **Install from URL** |
| Greasemonkey | Add-on menu → **New User Script** → paste the raw URL |
| ScriptCat | Install the [extension](https://scriptcat.org/), then use the GitHub raw URL |

### Manual / local install

```bash
git clone https://github.com/NemoKing1210/x-translator.git
cd x-translator
npm install
npm run build
```

Then open the built [`x-translator.user.js`](x-translator.user.js) in your manager (or copy its contents into a new script).

For hot reload during development, run `npm run dev` and install the Vite-served script (name prefix `dev:`).

---

## Features

### On X (`x.com` / `twitter.com`)

- **Translate** control in the tweet header (before Grok / More; in quote cards, at the end of the quote name row), with the result panel under the text when needed (spinner while loading; click does not open the tweet)
- Works on **timeline posts**, **replies/comments**, and **quoted tweets**
- Translation shown in a result panel (smooth expand) or in place of the original text (button / hover peek / split view); links and mentions stay clickable; emoji kept in the translated text
- Optional **automatic** mode: translate as soon as a post is even slightly on screen (all accounts or a selected allowlist; manage via settings or the tweet **…** menu)
- Account **blocklist** and source-language allow/block lists (“don’t touch” filters)
- Icons on Translate / Hide / Show original / Retry
- Target language from settings — **Auto** follows the UI / browser locale, or pick from ~40 languages with full names and flags
- Posts already in the target language are left alone (no result panel)
- Works with X’s SPA navigation (scroll, route changes, infinite feed)
- Chrome follows X **light**, **dim**, and **lights out** themes

### Settings & polish

- Tabbed settings dialog styled like X modals: **General · Providers · Cache · About**
- Translation providers: Google (default, no key), DeepL, Microsoft, OpenAI, Yandex, LibreTranslate — fields depend on the selected provider
- Entry points:
  - Left sidebar item **Translator** (before More / Settings)
  - Userscript manager menu command
- Interface languages: English, Русский, 中文, Español, Português, Deutsch, Français, 日本語 (+ Auto)
- Top-right toasts styled like X chrome for save / cache clear
- Translation cache in userscript storage (configurable TTL)

### Technical

- No API keys required for the default Google provider; DeepL / Microsoft / OpenAI / Yandex / LibreTranslate need credentials in **Settings → Providers**
- Request dedupe + debounced DOM rescans
- Built with [Vite](https://vitejs.dev/) + [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey)
- Same artifact / CI workflow as [bluesky-translator](https://github.com/NemoKing1210/bluesky-translator) and [backloggd-plus](https://github.com/NemoKing1210/backloggd-plus)

---

## Settings

Open **Translator** in the left nav, or the manager menu → **X Translator — Settings**.

| Tab | What you can change | Default |
|-----|---------------------|---------|
| **General** | Interface language; target language; mode (button / auto); auto scope + allowlist; replace reveal; account blocklist; source language allow/block lists; display mode (panel / replace) | Auto / button / all / button / panel |
| **Providers** | Provider + API credentials / URL fields | Google |
| **Cache** | Usage meter; cache hours (`0` = off); clear cache | 24 |
| **About** | Description, repository link, author card | — |

Saving closes the panel and applies immediately (nav labels and tweet buttons refresh).

---

## How it works

1. Matches `https://x.com/*` and `https://twitter.com/*` at `document-idle`.
2. Finds tweet text via `[data-testid="tweetText"]` inside `article[data-testid="tweet"]` (posts and replies share this id) — adjustable in `src/constants.js` if X’s DOM changes.
3. Injects a **Translate** control in the tweet / quote header; the result panel sits under the text (quoted tweets: panel inside the quote card).
4. On click (or auto viewport entry), requests the configured provider (Google by default) through the userscript sandbox (`GM_xmlhttpRequest` / `@connect`).
5. Stores successful results in `GM` storage (`xt_cache_v1`) until TTL expires or you clear the cache.

X’s web client updates often — if buttons stop appearing, selectors in `POST_TEXT_SELECTORS` are the first place to look.

---

## Updates

The built script ships with `@updateURL` / `@downloadURL` pointing at GitHub `main`. Supported managers check for updates automatically.

**To ship a new version:**

1. Bump `version` in [`package.json`](package.json) (source of truth for `@version` and `SCRIPT_VERSION`).
2. Run `npm run build` (regenerates root `x-translator.user.js` / `.meta.js`).
3. Add an entry to [`CHANGELOG.md`](CHANGELOG.md).
4. Update the version badge / status line in this README if needed.
5. Push to `main`.

For local setup, contributing, and repository layout see [`DEVELOPMENT.md`](DEVELOPMENT.md), [`CONTRIBUTING.md`](CONTRIBUTING.md), and [`AGENTS.md`](AGENTS.md).

---

## FAQ

**Does this need a Google API key?**  
No for the default **Google** provider. DeepL, Microsoft, OpenAI, Yandex, and LibreTranslate need credentials under **Settings → Providers**.

**Will my X password be shared?**  
No. The script only reads post text from the page DOM and sends that text to the chosen translate provider. It does not touch X auth tokens for translation. API keys you enter are stored in userscript GM storage on your device.

**Does it work on twitter.com?**  
Yes — `@match` includes both `x.com` and `twitter.com`.

**Buttons missing on some tweets?**  
Empty tweets (media-only) are skipped. If text tweets also lack buttons after an X UI update, report an issue or adjust `POST_TEXT_SELECTORS` in `src/constants.js`.

**Cache growing large?**  
Lower **Cache** hours, clear it in Settings, or watch the usage meter (soft ~2 MB budget with LRU eviction).

---

## Author

| | |
|---|---|
| **NemoKing** | [@NemoKing1210](https://github.com/NemoKing1210) |
| Email | [nemoking1210@gmail.com](mailto:nemoking1210@gmail.com) |
| Repo | [github.com/NemoKing1210/x-translator](https://github.com/NemoKing1210/x-translator) |

Issues and ideas: [GitHub Issues](https://github.com/NemoKing1210/x-translator/issues).

---

## License

[MIT](LICENSE) — Copyright (c) 2026 NemoKing
