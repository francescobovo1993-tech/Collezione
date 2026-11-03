# Catalogo Buste WR

A personal catalogue of [W.R. comic bags](https://wrbuste.it/prodotti/buste-protettive-fumetti/):
which formats I own, which are running low, and a shopping list to send to the shop.

Static app (Vite + React + TypeScript), deployed to GitHub Pages.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit + UI tests
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

```bash
npm run refresh                       # fetch the live page
npm run refresh -- --dry-run          # just show what changed
npm run refresh -- --html page.html   # use a saved copy of the page
npm run refresh -- --text page.txt    # use text copied from the browser
```

The refresh only touches `catalog.json` and `changelog.json`. It never deletes formats: ones that
disappear from WR get `removed: true` and show a red "non più su WR" tag. If a section looks
incomplete, it skips removals for that section.

The **Refresh from WR** workflow runs it every Monday (and on demand from the Actions tab),
commits any changes, and the site redeploys.

## Personal state

Owned / Scorte / Carrello are stored per browser in `localStorage` (`wrbuste.state.v1`).
Use **Impostazioni → Esporta / Importa stato (JSON)** to move them between devices.
Storage sits behind the `StateStore` interface in `src/lib/state.ts`, so a synced backend can replace it later.

## Deploy

1. Push to `main`.
2. In the repo on GitHub: **Settings → Pages → Source: GitHub Actions** (once).
3. The **Deploy to GitHub Pages** workflow tests, builds and publishes.
