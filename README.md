# Catalogo Buste WR

A personal catalogue of [W.R. comic bags](https://wrbuste.it/prodotti/buste-protettive-fumetti/):
which formats I own, which are running low, and a shopping list to send to the shop.

Static app (Vite + React + TypeScript), deployed to GitHub Pages.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit + UI tests
npm run lint     # ESLint
npm run typecheck
npm run build    # production build in dist/
```

## Data

| File | What | Who writes it |
| --- | --- | --- |
| `data/catalog.json` | WR formats: name, sizes, price, pack, material, notes | `npm run refresh` |
| `data/volumi.json` | My notes: which comics fit each bag | Me, by hand (GitHub web editor) |
| `data/sheet-seed.json` | Who owned what in the old Google Sheet | Used only by the first-run import |
| `data/changelog.json` | History of refreshes, newest first | `npm run refresh` |
| `seed/` | Original files from the prototype | Kept for reference |

IDs are `<cat>~<slug(name)>` (e.g. `fumetti~manga-tp1`). Don't rename them: personal state and diffs depend on them.

To add a note to a format, open it in the app and press **Modifica su GitHub**, or edit `data/volumi.json` directly.
Saving on `main` redeploys the site.

## Refreshing from wrbuste.it

**From the app:** Aggiornamenti → **Aggiorna da WR** opens the workflow on GitHub. Press **Run workflow**.
It also runs by itself every Monday.

If WR changed anything, the workflow opens a pull request on the branch `wr-refresh`, with the changes
listed as Nuovi / Modificati / Non più sul sito. **Merging the PR publishes the update** (Pages redeploys).
No changes → no PR.

One-time setup: **Settings → Actions → General → Workflow permissions** → tick
**Allow GitHub Actions to create and approve pull requests**.

**From your computer:**

```bash
npm run refresh                        # fetch the live page
npm run refresh -- --dry-run           # only show what changed
npm run refresh -- --html page.html    # use a saved copy of the page
npm run refresh -- --text page.txt     # use text copied from the browser
```

How it reads the page: Node `fetch` + cheerio. WR's tables use DataTables with client-side paging, so all
rows should already be in the HTML; the script checks this. If rows are missing (AJAX tables, empty
tables), it falls back to Playwright and makes every table show all rows.

It never deletes a format: ones that disappear from WR get `removed: true` and a red "non più su WR" tag.
It only marks removals for a section it read completely, and never for `source: "manuale"`.

**Test fixture:** `scripts/fixtures/wr-page.html` is *synthetic* (built from the catalogue, because the real
site wasn't reachable when it was written). Each workflow run uploads the page it read as the `wr-page`
artifact: download it and replace the fixture to test against the real markup.

## Editing "Volumi"

Volumi (which comics fit each bag) are read-only in the app. To edit them, open a format and press
**Modifica su GitHub**, or edit `data/volumi.json` on GitHub. Commit to `main` and the site redeploys in
a minute or two. The refresh never touches this file.

## Personal state (owned / Scorte / Carrello)

Always saved in the browser (`localStorage`, key `wrbuste.state.v1`).

**Sync (optional):** with a Supabase project configured, **Impostazioni → Accedi con Google** also saves
marks to your account (one row per person, protected by row-level security), so they follow you to
every device. Setup: [SUPABASE.md](SUPABASE.md). Without it the app is browser-only.

- **Back up / move by hand:** Impostazioni → **Esporta stato (JSON)**, then **Importa stato (JSON)** elsewhere.
- **Old Google Sheet:** Impostazioni → **Importa dal vecchio foglio: Bobbi / Pomo** adds that person's
  owned formats (and Bobbi's Poche/Tante) from `data/sheet-seed.json`.

Code: `StateStore` in `src/lib/state.ts` (browser), `SyncedStore` in `src/lib/sync.ts` (sync rules),
`src/lib/supabase.ts` (the Supabase backend), `supabase/schema.sql` (table + policies).

## Sharing with Pomo

Send Pomo the site link. The catalogue is shared; marks are personal.
- With sync on: add his Gmail to the Google test users (see SUPABASE.md); he signs in with Google.
- To bring in his owned list from the old sheet: Impostazioni → **Importa dal vecchio foglio: Pomo**.

## Deploy

1. Push to `main`.
2. In the repo on GitHub: **Settings → Pages → Source: GitHub Actions** (once).
3. The **Deploy to GitHub Pages** workflow lints, tests, builds and publishes.
   Optional repo variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` turn on sync.
