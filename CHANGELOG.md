# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.6] — 2026-08-02

### Fixed

- Post emoji rendered as Twemoji images are included in translation (no longer dropped)

## [1.2.5] — 2026-08-02

### Fixed

- Quoted tweets place the Translate control in the quote header row (icon style), matching outer posts instead of the under-text toolbar

## [1.2.4] — 2026-08-02

### Removed

- Settings option **Skip when already in target language** — the skip itself stays always on

## [1.2.3] — 2026-08-02

### Changed

- Header action wrapper no longer forces 34×34 size (hover disc remains on the button `::before`)

## [1.2.2] — 2026-08-02

### Changed

- Header Translate button is 20px tall; hover/focus disc stays 34×34 via `::before` (matches X action chrome)

## [1.2.1] — 2026-08-01

### Changed

- Toasts restyled to match X elevated chrome and moved to the top-right

## [1.2.0] — 2026-08-01

### Removed

- Settings **Debug** tab, debug mode, and session translate / cache-hit statistics

## [1.1.5] — 2026-08-01

### Changed

- Settings form fields stack in a single column (Translation, Languages, Cache) instead of a two-column grid

## [1.1.4] — 2026-08-01

### Fixed

- Sidebar **Translator** mirrors X’s JS hover class (`r-1hdo0pc` on the inner pill) so the outline matches native rows

## [1.1.3] — 2026-08-01

### Fixed

- Sidebar **Translator** clones the inactive **More** row (not active Home), so font-weight and hover pill match other items; dropped custom nav CSS that fought X styles

## [1.1.2] — 2026-08-01

### Fixed

- Sidebar **Translator** item now deep-clones a native nav link (Home/Explore) so icon size, label typography, and hover match other sidebar rows

## [1.1.1] — 2026-08-01

### Changed

- Settings dialog widened (~920px)
- Translate control sits in the tweet header actions row before Grok (icon-style); result panel stays under the post text

## [1.1.0] — 2026-08-01

### Changed

- Full UI chrome redesign to match x.com: Translate as a native text action, neutral result panels, X-style settings dialog (flat sections, profile tabs, toggle switches), bottom snackbars
- Theme detection now covers **light**, **dim**, and **lights out** (not only light/dark)

## [1.0.0] — 2026-08-01

### Added

- Initial userscript for [X](https://x.com) / Twitter: Translate button on posts and replies, Google Translate backend (plus DeepL, Microsoft, OpenAI, Yandex, LibreTranslate), settings panel, translation cache, SPA DOM observer
- Panel and replace display modes (button / hover peek / split)
- Auto-translate on viewport entry with allowlist / blocklist filters
- Sidebar **Translator** entry and tweet caret menu actions
- UI in 8 languages; chrome adapts to X light/dark theme

[1.2.3]: https://github.com/NemoKing1210/x-translator/releases/tag/v1.2.3
[1.2.2]: https://github.com/NemoKing1210/x-translator/releases/tag/v1.2.2
[1.2.1]: https://github.com/NemoKing1210/x-translator/releases/tag/v1.2.1
[1.2.0]: https://github.com/NemoKing1210/x-translator/releases/tag/v1.2.0
[1.1.5]: https://github.com/NemoKing1210/x-translator/releases/tag/v1.1.5
[1.1.4]: https://github.com/NemoKing1210/x-translator/releases/tag/v1.1.4
[1.1.3]: https://github.com/NemoKing1210/x-translator/releases/tag/v1.1.3
[1.1.2]: https://github.com/NemoKing1210/x-translator/releases/tag/v1.1.2
[1.1.1]: https://github.com/NemoKing1210/x-translator/releases/tag/v1.1.1
[1.1.0]: https://github.com/NemoKing1210/x-translator/releases/tag/v1.1.0
[1.0.0]: https://github.com/NemoKing1210/x-translator/releases/tag/v1.0.0
