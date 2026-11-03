/**
 * Refresh data/catalog.json from wrbuste.it and prepend an entry to data/changelog.json.
 * Never touches data/volumi.json.
 *
 *   npm run refresh                        fetch the live page (Playwright fallback if rows are missing)
 *   npm run refresh -- --browser           always use the browser
 *   npm run refresh -- --html page.html    use a saved copy of the page
 *   npm run refresh -- --text page.txt     use text copied from the browser (Ctrl/Cmd+A, Ctrl/Cmd+C)
 *   npm run refresh -- --dry-run           print the changes, write nothing
 *   npm run refresh -- --md out.md         also write the Markdown changelog to a file
 *   npm run refresh -- --save-html p.html  save the HTML that was parsed (to update the test fixture)
 *
 * In GitHub Actions it also sets the step outputs `changed` and `title`.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WR_URL } from '../src/lib/constants.ts';
import { applyDiff, diffCatalog, parsePage, type Section } from '../src/lib/wr.ts';
import type { Catalog, ChangelogEntry } from '../src/lib/types.ts';
import { diffMarkdown } from './lib/markdown.ts';
import { fetchWithBrowser } from './lib/wr-browser.ts';
import { parseHtml } from './lib/wr-html.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const log = (s: string) => console.error(s); // progress on stderr, Markdown on stdout

async function fetchHtml(): Promise<string> {
  const res = await fetch(WR_URL, { headers: { 'User-Agent': 'catalogo-buste-wr (refresh script)', 'Accept-Language': 'it' } });
  if (!res.ok) throw new Error(`wrbuste.it ha risposto ${res.status}`);
  return res.text();
}

async function readSections(): Promise<Section[]> {
  const text = opt('--text');
  if (text) return parsePage(readFileSync(text, 'utf8'));
  const file = opt('--html');
  let html = file ? readFileSync(file, 'utf8') : args.includes('--browser') ? await fetchWithBrowser(WR_URL) : await fetchHtml();
  let { sections, problems } = parseHtml(html);
  if (problems.length && !file && !args.includes('--browser')) {
    log('L’HTML statico non contiene tutte le righe:\n  ' + problems.join('\n  ') + '\nUso il browser (Playwright)…');
    html = await fetchWithBrowser(WR_URL);
    ({ sections, problems } = parseHtml(html));
  } else if (!problems.length) {
    log('OK: tutte le righe sono già nell’HTML della pagina.');
  }
  problems.forEach(p => log('! ' + p));
  const save = opt('--save-html');
  if (save) writeFileSync(save, html);
  return sections;
}

const sections = await readSections();
if (!sections.reduce((n, s) => n + s.rows.length, 0)) {
  log('Non trovo righe di buste nella pagina: la struttura del sito potrebbe essere cambiata. Nessun file modificato.');
  process.exit(1);
}
for (const s of sections) log(`· ${s.label} → ${s.cat}: ${s.rows.length} righe${s.total != null ? ` su ${s.total}` : ''}${s.updated ? ` (aggiornata ${s.updated})` : ''}`);

const catPath = join(root, 'data/catalog.json');
const logPath = join(root, 'data/changelog.json');
const current: Catalog = JSON.parse(readFileSync(catPath, 'utf8'));
const diff = diffCatalog(current, sections);
const { catalog, entry } = applyDiff(current, diff);
const md = diffMarkdown(diff, entry.summary);
console.log(md);
const mdPath = opt('--md');
if (mdPath) writeFileSync(mdPath, md);

const changed = diff.added.length + diff.changed.length + diff.removed.length + diff.revived.length > 0;
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\ntitle=${entry.summary}\n`);
if (args.includes('--dry-run')) { log('--dry-run: nessun file scritto.'); process.exit(0); }
if (changed) {
  writeFileSync(catPath, JSON.stringify(catalog, null, 2) + '\n');
  const prev: ChangelogEntry[] = JSON.parse(readFileSync(logPath, 'utf8'));
  writeFileSync(logPath, JSON.stringify([entry, ...prev], null, 2) + '\n');
  log('Scritti data/catalog.json e data/changelog.json.');
} else {
  log('Nessuna modifica.');
}
