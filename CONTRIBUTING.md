# Contributing

Thanks for helping make the Invincible Comic Reader better! Bug reports, ideas, translations and code
are all welcome.

## Ways to help

- **Report a bug or suggest an idea:** [open an issue](https://github.com/DenysLeontiev/InvincibleComics/issues).
  Include your browser, device and steps to reproduce.
- **Improve a translation or add a language:** see [Translations](#translations).
- **Fix or build something:** pick an issue (or open one first for bigger changes) and send a pull request.

## Development setup

1. Fork the repository and clone your fork.
2. Install dependencies: `npm install` (Node.js 22 or newer).
3. Build the comic library from your own PDFs: `npm run library`
   (`COMICS_DIR="/path/to/comics" npm run library` if they are not in `C:\invincible comics`).
4. Start the dev server: `npm start`, then open http://localhost:4200.
5. Run the tests: `npm test`.
6. Optional: copy `production.env` to `.env` for production builds. Use your own IDs and never commit
   `.env`.

## Project structure

```
src/app
├── core/
│   ├── analytics/     Google Analytics loader, consent mode and event tracking
│   ├── i18n/          translation service, `t` pipe, languages and dictionaries
│   ├── library/       loads library.json, issue order, file URLs
│   ├── pages/         page image URLs, prefetching, caching
│   ├── preferences/   reader layout, fit and filter, saved in the browser
│   ├── progress/      reading position and finished issues, saved in the browser
│   └── storage/       persistedSignal(): a localStorage-backed signal
├── features/
│   ├── library/       library page, continue card, issue cards, filters
│   └── reader/        reader page, paged and scroll views, toolbar, scrubber, end card
└── shared/            icons, progress bar, language picker, pipes
scripts/               build-library.mjs, its page render worker, apply-env.mjs (writes .env into the build)
public/flags/          language flags
```

## How it works

- **Angular 20** with standalone components, signals (`computed`, `linkedSignal`, `resource`,
  `httpResource`), zoneless change detection and OnPush everywhere. Routes are lazy-loaded.
- **Pages:** the PDFs are JPEG 2000 + JBIG2 scans that take about a second per page to decode, so
  `npm run library` renders every page to WebP ahead of time. The reader only loads images:
  `PageImagesService` prefetches the next few pages in the background, so page turns are instant.
- **Analytics:** components call `AnalyticsService.event(name, params)`. Nothing is sent unless
  `GOOGLE_TAG_ID` was set at build time, so development builds and forks send nothing. When you add
  an event, add it to `AnalyticsEvent` in `analytics.models.ts` and to the table in the README.
- **State:** reading progress, preferences and language live in `persistedSignal()`. It validates
  what it reads, so a broken or outdated entry never breaks the app, and it syncs across tabs.

## Translations

UI strings live in `src/app/core/i18n/translations/`. `en.ts` is the source of truth. Every other
language must define the same keys, or the build fails.

Use a string in a template with the `t` pipe:

```html
<h2>{{ 'library.emptyTitle' | t }}</h2>
<span>{{ 'common.issues' | t: { count: total } }}</span>
```

Or in TypeScript with `I18nService.t('key', params)`.

Strings that depend on a number use plural forms, picked with `Intl.PluralRules`:

```ts
'common.issues': { one: '{count} issue', other: '{count} issues' },
```

**To add a language:**

1. Copy `en.ts` to `<code>.ts` (for example `pl.ts`) and translate every value.
2. Add the code to `LanguageCode` in `i18n.types.ts`.
3. Register it in `languages.ts` (native name and flag) and in `TRANSLATIONS`.
4. Add a flag SVG to `public/flags/`.
5. Run `npm test`. One test checks that every language has every key.

## Code style

- Keep components small, standalone and `OnPush`. Use signals for state and `input()` / `output()`
  for component APIs.
- Use clear names instead of comments. The codebase deliberately has none.
- Formatting follows the Prettier settings in `package.json` (100 characters, single quotes).
- Never hard-code UI text: add a translation key in all languages.
- Respect `prefers-reduced-motion` and keep everything keyboard accessible.

## Pull requests

1. Create a branch from `main`.
2. Keep each pull request focused on one change and describe what it changes and why.
3. Make sure `npm test` and `npm run build` pass.
4. Add screenshots for visual changes.

Every push to `main` deploys the site to GitHub Pages automatically.
