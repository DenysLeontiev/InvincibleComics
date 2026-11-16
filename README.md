# Invincible Comic Reader

A fast, minimal, Invincible-themed web reader for the complete comic series. No sign-up: your reading
position, finished issues and preferences are remembered in your browser.

**Live site:** https://invincible-comics.xyz/

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

It creates `public/library/`:

| Path                     | Contents                                                  |
| ------------------------ | --------------------------------------------------------- |
| `library.json`           | Issue numbers, years, page counts and page sizes          |
| `covers/<id>.webp`       | Cover thumbnails                                          |
| `pages/<id>/<page>.webp` | Every page rendered from the PDF, 1600 px tall, WebP q75 |

The PDFs themselves are not published: browsers can't decode their JPEG 2000 scans quickly, so the
reader shows the pre-rendered pages instead. The first run takes a few minutes. Later runs only
process new or changed files.

## Scripts

| Command           | What it does                                 |
| ----------------- | -------------------------------------------- |
| `npm run library` | Builds the comic library from the PDFs       |
| `npm start`       | Starts the dev server                        |
| `npm run build`   | Production build into `dist/`, using `.env`  |
| `npm test`        | Runs the unit tests                          |

## Configuration

Production settings come from environment variables. [`production.env`](production.env) lists them
with empty values:

| Variable           | What it does                                                                  |
| ------------------ | ----------------------------------------------------------------------------- |
| `GOOGLE_TAG_ID`    | Google Analytics ID: `G-XXXXXXX` (GA4) or `GTM-XXXXXXX` (Tag Manager). Empty turns analytics off |
| `LIBRARY_BASE_URL` | Where the comic library is served from. Empty means the bundled `library/`    |

For local production builds, copy it to `.env` and fill in your own values:

```bash
cp production.env .env
npm run build
```

`.env` is in `.gitignore` and is never committed. `npm run build` writes the values into
`dist/.../index.html`, and real environment variables take priority over `.env`. `npm start` ignores
them, so local development never sends analytics.

**Forking?** Leave these empty or use your own IDs. Never reuse someone else's Google Analytics ID, or
your visits end up in their reports.

## Analytics

When `GOOGLE_TAG_ID` is set, the app loads Google Analytics and reports:

| Event             | When                                             | Parameters                                     |
| ----------------- | ------------------------------------------------ | ---------------------------------------------- |
| `page_view`       | Every route change (library or reader)           | `page_location`, `page_path`, `page_title`, `page_type` |
| `open_issue`      | An issue is opened                               | `issue_number`, `source`, `option`             |
| `issue_start`     | An issue finished loading                        | `issue_number`, `page_number`, `page_count`, `option` (`start`/`resume`) |
| `comic_page`      | A comic page stayed on screen for 1 second       | `issue_number`, `page_number`, `page_count`, `progress` |
| `issue_complete`  | The last page of an issue was reached            | `issue_number`, `page_count`                   |
| `layout_change`, `fit_change`, `filter_change`, `language_change`, `fullscreen` | Settings changes | `option` |
| `jump_to_issue`   | The "Issue #" search was used                    | `issue_number`, `option` (`found`/`not_found`) |
| `mark_read`       | An issue was marked read or unread               | `issue_number`, `option`                       |
| `reset_progress`  | Reading progress was reset                       |                                                |
| `github_click`    | A GitHub link was clicked                        | `source`                                       |
| `page_error`, `app_error` | Something failed to load or crashed | `issue_number`, `page_number`, `option` |

Google Analytics adds location (country and city), device, browser, sessions and real-time users on
its own.

**Consent.** The app uses
[Consent Mode](https://developers.google.com/tag-platform/security/guides/consent): in the EU, EEA, UK
and Switzerland no analytics cookies are stored until the visitor allows it
(`AnalyticsService.setConsent('granted')`). Everywhere else, analytics is on by default. Ad features
are always off.

**Setting up Google Analytics:**

- **GA4 measurement ID (`G-…`), the easiest option.** Everything above works with no extra setup. In
  GA4, open **Admin → Data streams → your stream → Enhanced measurement** and turn off *Page changes
  based on browser history events*, because the app already sends `page_view`. To use the parameters in
  reports, add them under **Admin → Custom definitions**.
- **Tag Manager container (`GTM-…`).** The app pushes each event to the `dataLayer` as
  `{ event: 'open_issue', issue_number: 12, ... }`. In Tag Manager:
  1. Add a **Google tag** with your `G-…` ID and set the configuration parameter `send_page_view` to
     `false`.
  2. Create **Data Layer Variables** for `page_location`, `page_path`, `page_title`, `page_type`,
     `issue_number`, `page_number`, `page_count`, `progress`, `source` and `option`.
  3. Add a **Google Analytics: GA4 Event** tag. Set the event name to `{{Event}}`, add the variables
     above as event parameters, and fire it on a **Custom Event** trigger with event name `.*` (regex)
     where `Event` does not start with `gtm.`.
  4. Publish the container.

## Deployment

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). It runs the
tests, builds the app and publishes it to GitHub Pages.

To turn on analytics for the live site, add a repository secret named `GOOGLE_TAG_ID`
(**Settings → Secrets and variables → Actions → New repository secret**) and re-run the workflow. The
ID ends up in the public page anyway, so it is not a real secret. A secret just keeps it out of the
code, so forks don't inherit it.

The comic library is bundled in `public/library/` and published with the app. To serve the comics from an
external static host instead, set a repository variable named `LIBRARY_BASE_URL` to that address
(**Settings → Secrets and variables → Actions → Variables**) and re-run the workflow.

## License and content

The code in this repository is open source. Invincible is © Robert Kirkman, Cory Walker and Ryan
Ottley, published by Image Comics. No comics are included here. Only use files you have the right to
read and share.
