# Contributing

Thanks for your interest in improving X Translator.

## Ways to help

- Report bugs and suggest features via [GitHub Issues](https://github.com/NemoKing1210/x-translator/issues)
- Open pull requests for fixes, features, docs, or translations
- Test on different userscript managers (Tampermonkey, Violentmonkey, ScriptCat) and browsers
- Report broken selectors after X UI updates (screenshots / `data-testid` hints help a lot)

## Before you start

1. Read [DEVELOPMENT.md](DEVELOPMENT.md) for setup, scripts, and release notes.
2. Skim [AGENTS.md](AGENTS.md) for architecture and project conventions.
3. Check [README.md](README.md), [CHANGELOG.md](CHANGELOG.md), and open issues/PRs to avoid duplicate work.

## Development setup

See [DEVELOPMENT.md](DEVELOPMENT.md). Short version:

```bash
git clone https://github.com/NemoKing1210/x-translator.git
cd x-translator
npm install
npm run dev      # Vite + monkey HMR — install the "dev:" userscript
npm run build    # Production bundle → dist/ + copy to repo root
npm run ci       # build + verify committed artifacts match
```

Edit source under `src/` (and `vite.config.js` for userscript metadata). Do **not** hand-edit root `x-translator.user.js` / `.meta.js`.

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Keep PRs focused: one concern per PR when possible.
3. Run `npm run build` so committed install artifacts stay in sync.
4. Run `npm run ci` locally when practical (same checks as GitHub Actions).
5. For user-visible changes:
   - Bump `version` in `package.json` (SemVer: patch for fixes, minor for features)
   - Add a [Keep a Changelog](https://keepachangelog.com/) entry in `CHANGELOG.md`
   - Update [README.md](README.md) if features, settings, install flow, or FAQ changed  
   (maintainers may finish version/changelog on merge if you prefer)

### What CI checks

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs `npm ci` → `npm run ci`. It fails if `dist/` and the root `.user.js` / `.meta.js` are out of sync with the build.

## Conventions

- Vanilla JS ESM modules under `src/`; no frameworks unless explicitly agreed.
- Prefer existing patterns: constants in `constants.js`, strings in `i18n/`, APIs in `api/`, UI in `features/`. Mutable runtime state lives in `state.js`.
- Prefix DOM / storage keys with `xt-` / `xt_`.
- Prefer stable `data-testid` selectors; when X’s DOM breaks the script, adjust `POST_TEXT_SELECTORS` in `src/constants.js` (and author / nav / menu helpers if needed).
- Do not expand `@connect` or `@grant` beyond what is needed (`vite.config.js`).
- Do not commit localhost `@updateURL` / `@downloadURL` values.
- Do not imply affiliation with X Corp. / Twitter in docs or UI copy.
- Do not break X’s native navigation, composer, or infinite scroll.

### Adding a translation provider

1. Add a client under `src/api/providers/`.
2. Register fields/defaults in `src/providers/registry.js`.
3. Wire it in `src/api/translate.js`.
4. Declare any new hosts in `vite.config.js` `@connect`.
5. Add UI strings to **all** locales in `src/i18n/translations.js`.

## Localization

UI locales: `en`, `ru`, `zh`, `es`, `pt`, `de`, `fr`, `ja` (plus `auto` = browser).

- Add every new user-facing string to **all** locales in [`src/i18n/translations.js`](src/i18n/translations.js).
- Keep localized `@name` / `@description` in `vite.config.js` aligned when changing the product description.

## Testing checklist

When changing DOM or UI injection, verify on `x.com` (and ideally `twitter.com`):

- [ ] Home timeline — Translate under tweet text
- [ ] Tweet detail + replies — comments get a button too
- [ ] Quoted tweets — separate toolbar on the quote
- [ ] Clicking Translate does not open the tweet
- [ ] Auto mode while scrolling (no spam; concurrency stays polite)
- [ ] Settings from sidebar **Translator** and the userscript manager menu
- [ ] Light and dark theme look correct

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
