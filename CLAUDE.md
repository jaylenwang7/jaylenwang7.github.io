# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Jaylen Wang's personal academic website (https://jaylenwang7.github.io), a Jekyll static site
built on the [academicpages](https://github.com/academicpages/academicpages.github.io) template
(a detached fork of the Minimal Mistakes theme). It is served by GitHub Pages, so it builds with
the `github-pages` gem and is limited to GitHub Pages-whitelisted plugins. Beyond the base
template, this fork adds several dynamic, data-driven features (see "Custom features" below).

## Commands

Local development (Ruby/Jekyll):

```bash
bundle install                                   # install gems
bundle exec jekyll serve                         # build + serve at localhost:4000 with live reload
bundle exec jekyll serve --config _config.yml,_config.dev.yml   # apply local dev overrides
bundle exec jekyll build --strict_front_matter   # the exact check CI runs — run before pushing
```

`_config.yml` is **not** reloaded on change — restart `jekyll serve` after editing it.

JavaScript assets (only when editing `assets/js/`):

```bash
npm install
npm run build:js     # uglify/concat plugins + _main.js -> assets/js/main.min.js
npm run watch:js     # rebuild main.min.js on change
```

There is no unit-test suite or linter; the only automated check is the strict Jekyll build above,
which CI also runs (see "CI & deployment"). GitHub Pages reports build failures only by email, so
run the strict build before pushing. `_site/` is generated output (do not edit by hand).

## Content model

Content lives in Jekyll collections, each a top-level `_<name>/` directory of Markdown files
with YAML front matter (configured under `collections:` in `_config.yml`):

- `_publications/` — one file per paper. Rendered by `_pages/publications.md`, which groups
  papers by the front-matter field **`venue_type`** (`conference` | `journal` | `workshop`,
  else "Other"). Rich front matter drives badges/links: `artifact_badges`, `awards`, `bibtex`,
  `citation`, `paperurl`, `slidesurl`, `doi`, `conf_shorthand`. `_includes/archive-single-pub.html`
  renders each entry.
- `_talks/`, `_teaching/`, `_research/`, `_portfolio/` — analogous collections.
- `_pages/` — standalone pages; front-matter `permalink` sets the URL. `_pages/about.md` is the
  homepage (`permalink: /`).
- `_posts/`, `_drafts/` — blog posts.
- `_data/` — site data. `news.yml` powers the "Latest News" panel (each item has a `category`
  keyed to a color under `config.categories`; `navigation.yml` is the top nav.
- `files/`, `images/` — static downloads (PDFs, slides) and images, served at `/files/...` etc.

Layouts are in `_layouts/`, reusable partials in `_includes/`, styles in `_sass/`.

### Generating publication/talk Markdown

`markdown_generator/` converts TSV (`publications.tsv`, `talks.tsv`) into collection Markdown
files via the `publications.py` / `talks.py` scripts (or the matching `.ipynb` notebooks).
`pubsFromBib.py` generates from a BibTeX file instead.

## Custom features (the non-template parts)

These are driven by Python scripts in `.github/scripts/` run on a daily cron by GitHub Actions.
They commit regenerated JSON back into the repo, which the site then reads client-side.

- **Survey results** (`_pages/survey-results.md`, `assets/js/survey-results.js`): a passcode-gated
  page that fetches `data/survey-stats.json` and renders charts (Chart.js). The workflow
  `.github/workflows/update-survey-data.yml` runs `.github/scripts/process_survey_data.py`, which
  pulls raw responses from a Google Sheet, cleans/canonicalizes free-text answers using the Groq
  LLM API, and writes `data/survey-stats.json` (plus `data/processing_cache.json` to avoid
  reprocessing). `data/survey_overrides.json` provides manual answer-mapping overrides.
  Secrets: `GOOGLE_SHEETS_CREDENTIALS`, `SPREADSHEET_ID`, `GROQ_API_KEY`.
- **Spotify playlist saves** (`assets/data/playlist_saves.{json,yml}`, `assets/js/playlist-saves.js`):
  `.github/workflows/update_playlist_saves.yml` runs `.github/scripts/update_playlist_saves.py` to
  refresh a live saved-count. Secrets: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `PLAYLIST_ID`.

When editing these, note that the JSON data files are **machine-generated and committed** — the
scheduled Actions will overwrite manual edits on the next run. The two crons' Python dependencies
are pinned in `.github/scripts/requirements-survey.txt` / `requirements-playlist.txt` (installed
with `pip install -r …`); bump versions there, not inline in the workflow.

## CI & deployment (GitHub Actions)

Three workflows in `.github/workflows/`:

- **`build.yml`** — on every push/PR to `master`, builds the site with
  `jekyll build --strict_front_matter` on Ubuntu to catch build breakage before it ships. Skips
  pushes that only touch `data/**` / `assets/data/**` (the bot data commits below).
- **`update-survey-data.yml`**, **`update_playlist_saves.yml`** — the daily data crons described
  under "Custom features".

To confirm a push was clean without hand-writing `gh` commands, use the helper
**`.github/scripts/check-deploy.sh`** (requires an authenticated `gh`). It finds the `Build site`
run for the current commit, watches it, and reports pass/fail (exits non-zero on failure, printing
the failing step's log tail). `--push` pushes the current branch first; on `master` it also prints
the Pages deploy status. Prefer this over re-deriving `gh run list`/`gh run watch` each time.

Deployment is GitHub Pages' classic "build from `master`" — merging to `master` auto-triggers a
`pages build and deployment` run; there is no deploy workflow in the repo. Pages builds in its own
`github-pages` gem environment, so it does **not** use `Gemfile.lock` (only `build.yml` does).

### Gotchas when a change touches CI or dependencies

- **`Gemfile.lock` must keep the `x86_64-linux` platform.** It's generated on macOS, which records
  only the darwin platforms, but CI does a locked `bundle install` on Linux and fails without it.
  If you regenerate the lock, re-add it with `bundle lock --add-platform x86_64-linux` — don't just
  `rm Gemfile.lock`, since regenerating on macOS reintroduces the bug.
- **`build.yml` sets `PAGES_REPO_NWO: ${{ github.repository }}`.** `jekyll-github-metadata` needs
  the repo's `owner/repo`; local builds infer it from the git `origin` remote, but CI can't. Note
  `repository:` in `_config.yml` is `jaylenwang7.github.io` (not a valid `owner/repo`), so it can't
  serve as the fallback — don't remove the env var expecting the config to cover it.
- **The repo gets automated commits daily** (the survey + playlist bots push to `master`), so
  `git pull` before starting local work to avoid diverging.
- The survey script authenticates with `oauth2client` but `gspread` stays on 6.x — gspread's
  `convert_credentials()` shim bridges the two, so no downgrade is needed.

## Conventions

- This is a customized fork, not the upstream template — favor small, local edits and preserve
  existing structure. Site-wide switches live in `_config.yml`; per-page/collection behavior is
  set via `defaults:` there and overridden in individual front matter.
- Custom page-specific JS lives in `assets/js/` (e.g. `news-panel.js`, `publications.js`,
  `survey-results.js`, `playlist-saves.js`) and is loaded directly, separate from the theme's
  bundled `main.min.js`.
