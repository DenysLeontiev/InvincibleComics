# Invincible Comic Reader

A fast, minimal, Invincible-themed web reader for the complete comic series. No accounts: everything
(reading position, finished issues, layout preferences) is remembered in the browser.

## Getting started

```bash
npm install
npm run library   # index the PDFs, render cover thumbnails (first run takes a few minutes)
npm start         # http://localhost:4200
```

`npm run library` reads the PDFs from `C:\invincible comics` by default. Point it elsewhere with
`COMICS_DIR`:

```bash
COMICS_DIR="D:\comics\invincible" npm run library
```

It creates `public/library/` (ignored by git):

| Path                  | What                                                              |
| --------------------- | ----------------------------------------------------------------- |
| `library.json`        | Manifest: issue number, year, page count, page aspect ratios      |
| `covers/<id>.webp`    | 480 px cover thumbnails                                           |
| `issues/<id>.pdf`     | The PDFs under clean names (hard links, so no extra disk space)   |

The step is incremental: re-running it only processes new or changed files.

## Using the reader

- **Turn pages**: click/tap the right or left edge, swipe, or use `←` `→` / `Space`.
- **Controls**: tap the middle of the page (they hide themselves while you read).
- **Layouts**: single page, two-page spreads (wide screens), or continuous vertical scroll.
- **Fit**: whole page, or fit to width.
- **Keyboard**: `Home`/`End` first/last page, `F` full screen, `Esc` back to the library.
- At the end of an issue the next one is one click away (and already downloaded).

## How it works

- **Angular 20**: standalone components, signals everywhere (`computed`, `linkedSignal`,
  `resource`/`httpResource`), zoneless change detection, OnPush, lazy routes, view transitions.
- **pdf.js** renders the PDFs. The scans are JPEG 2000 + JBIG2, which take ~1–2 s per page to
  decode, so `PdfService`:
  - decodes on up to 4 workers in parallel,
  - renders what's on screen first, then pre-renders the rest of the issue nearest-first,
  - caches rendered pages, so page turns and jumps are instant after the first page,
  - starts downloading the next issue as you approach the end.
- **Persistence**: `persistedSignal()` is a validated, localStorage-backed signal kept in sync
  across tabs. It falls back to memory when storage is unavailable.

```
src/app
├── core/          services: library manifest, pdf rendering, progress, preferences, storage
├── features/
│   ├── library/   library page, continue-reading hero, issue cards, filters
│   └── reader/    reader page, paged view, scroll view, toolbar, scrubber, end-of-issue card
└── shared/        icons, progress bar, pipes
scripts/           build-library.mjs (+ worker) — generates public/library
```

## Scripts

| Command           | Description                                 |
| ----------------- | ------------------------------------------- |
| `npm run library` | Build the comic library from the PDFs       |
| `npm start`       | Dev server                                  |
| `npm run build`   | Production build to `dist/`                 |
| `npm test`        | Unit tests (Karma + Jasmine)                |

## Hosting the library elsewhere

The app loads everything from `library/` next to `index.html`. To serve the PDFs from a CDN or bucket
instead, change `LIBRARY_BASE_URL` in `src/app/core/library/library.config.ts`. The host must allow
CORS and HTTP range requests.
