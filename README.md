# Invincible Comic Reader

A fast, minimal, Invincible-themed web reader for the complete comic series. No sign-up: your reading
position, finished issues and preferences are remembered in your browser.

**Live site:** https://denysleontiev.github.io/InvincibleComics/

**Contributions are welcome!** Read [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## Features

- Library of every issue with covers, reading progress and "continue where you left off"
- Single page, two-page spread and continuous vertical scroll layouts
- Fit to screen or fit to width
- Tap, click, swipe or keyboard navigation (`←` `→` `Space` `Home` `End` `F` `Esc`)
- Pages are pre-rendered in the background, so page turns are instant
- The next issue downloads while you finish the current one
- Interface in English, Українська, Français, Español and Deutsch
- Works on phones, tablets and desktops

## Quick start

You need [Node.js](https://nodejs.org) 22 or newer and a folder of Invincible PDFs named like
`Invincible 012 (2004) ....pdf`.

```bash
git clone https://github.com/DenysLeontiev/InvincibleComics.git
cd InvincibleComics
npm install
npm run library
npm start
```

Open http://localhost:4200.

`npm run library` reads the PDFs from `C:\invincible comics` by default. Use `COMICS_DIR` to point it
somewhere else:

```bash
COMICS_DIR="/path/to/comics" npm run library
```

It creates `public/library/` (not committed to git):

| Path               | Contents                                                        |
| ------------------ | --------------------------------------------------------------- |
| `library.json`     | Issue numbers, years, page counts and page sizes                |
| `covers/<id>.webp` | Cover thumbnails                                                |
| `issues/<id>.pdf`  | The PDFs under clean names (hard links, so no extra disk space) |

The first run takes a few minutes. Later runs only process new or changed files.

## Scripts

| Command           | What it does                                 |
| ----------------- | -------------------------------------------- |
| `npm run library` | Builds the comic library from the PDFs       |
| `npm start`       | Starts the dev server                        |
| `npm run build`   | Production build into `dist/`                |
| `npm test`        | Runs the unit tests                          |

## Deployment

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). It runs the
tests, builds the app and publishes it to GitHub Pages.

The comic library is bundled in `public/library/` and published with the app. To serve the comics from an
external static host instead, set a repository variable named `LIBRARY_BASE_URL` to that address
(**Settings → Secrets and variables → Actions → Variables**) and re-run the workflow.

## License and content

The code in this repository is open source. Invincible is © Robert Kirkman, Cory Walker and Ryan
Ottley, published by Image Comics. No comics are included here. Only use files you have the right to
read and share.
