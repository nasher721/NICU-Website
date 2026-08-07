# AGENTS.md

## Cursor Cloud specific instructions

This repo is a **Next.js 16 (App Router, React 19)** static-content web app: the
"Neurocritical Care Faculty Wiki". It has **no backend, database, or external
services** — all content ships as JSON under `src/data/` and there are no secrets
or env vars required to run it.

The startup update script already runs `npm ci`, so dependencies are installed
when a session begins. Node (>=22.13) and Python 3 are preinstalled.

### Running the app (development)
- `npm run dev` starts the dev server at `http://localhost:3000` (Next.js
  Turbopack). Key routes: `/`, `/akron`, `/main-campus`, `/search`, `/figures`,
  `/sources`. Campus wiki articles live at `/<campus>/<slug>`.
- The app is fully usable without any additional setup: it reads the committed
  generated data in `src/data/generated/`.

### Data generation (usually not needed)
- `npm run generate:data` regenerates `src/data/generated/**` from
  `src/data/*.json` using `tools/extract_handbooks.py` (needs `python3`). The
  generated files are committed, so dev/build work without running this. It runs
  automatically as `prebuild`. Only run it after editing source content; see
  `docs/content-contribution.md`.

### Lint / typecheck / build
- Lint: `npm run lint`. Typecheck: `npm run typecheck` (uses a raised
  `--max-old-space-size`, already wired in the script).
- `npm run build` runs the **vinext (Cloudflare Workers) build then `next build`**.
  It is heavier than a plain Next build; the production runtime targets Cloudflare
  Workers (`worker/index.ts`, `wrangler`). Prefer `npm run dev` for iteration.

### Tests
- `npm test` is the full release gate and is **heavy**: it runs lint, typecheck,
  a production build, the `node --test` suites in `tests/`, and Playwright e2e.
  See `docs/release-quality-gates.md`.
- Browser-based tests need Chrome (present at `/usr/local/bin/google-chrome`,
  referenced via `CHROME_BIN`). The Playwright e2e suite additionally needs
  browsers installed once: `npx playwright install chromium`. Playwright browsers
  are **not** part of the startup update script, so install them before running
  `npm run test:e2e` or full `npm test`.
- The e2e snapshots are OS-specific (`*-chromium-linux.png` exist for Linux CI).
