/**
 * Refresh data/catalog.json from wrbuste.it and log the changes in data/changelog.json.
 * Never touches data/volumi.json.
 *
 *   npm run refresh                     fetch the live page
 *   npm run refresh -- --html page.html use a saved copy of the page
 *   npm run refresh -- --text page.txt  use text copied from the browser (Ctrl/Cmd+A, Ctrl/Cmd+C)
 *   npm run refresh -- --dry-run        print the changes, write nothing
 *   npm run refresh -- --log-always     also log a check with no changes
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIELD_LABEL, WR_URL } from '../src/lib/constants.ts';
import { applyDiff, diffCatalog, htmlToText, parsePage } from '../src/lib/wr.ts';
import type { Catalog, ChangelogEntry } from '../src/lib/types.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dry = args.includes('--dry-run');
const logAlways = args.includes('--log-always');

async function getText(): Promise<{ text: string; fullHtml: boolean }> {
  const t = opt('--text');
  if (t) return { text: readFileSync(t, 'utf8'), fullHtml: false };
  const h = opt('--html');
  if (h) return { text: htmlToText(readFileSync(h, 'utf8')), fullHtml: true };
  const res = await fetch(WR_URL, { headers: { 'User-Agent': 'catalogo-buste-wr (refresh script)', 'Accept-Language': 'it' } });
  if (!res.ok) throw new Error(`wrbuste.it ha risposto ${res.status}`);
  return { text: htmlToText(await res.text()), fullHtml: true };
}

const { text, fullHtml } = await getText();
const sections = parsePage(text);
const total = sections.reduce((n, s) => n + s.rows.length, 0);
if (!total) {
  console.error('Non trovo righe di buste nella pagina: la struttura del sito potrebbe essere cambiata. Nessun file modificato.');
  process.exit(1);
}
for (const s of sections) console.log(`· ${s.label}: ${s.rows.length} righe${s.updated ? ` (aggiornata ${s.updated})` : ''}`);

const catPath = join(root, 'data/catalog.json');
const logPath = join(root, 'data/changelog.json');
const current: Catalog = JSON.parse(readFileSync(catPath, 'utf8'));
const diff = diffCatalog(current, sections, { fullHtml });
diff.warns.forEach(w => console.warn('! ' + w));
const { catalog, entry } = applyDiff(current, diff);

console.log('\n' + entry.summary);
for (const i of entry.items) {
  const tag = { add: '+', chg: '~', del: '-' }[i.t];
  console.log(`  ${tag} ${i.name} [${i.cat}]` + (i.fields ? ' ' + i.fields.map(f => `${FIELD_LABEL[f.f] ?? f.f}: ${f.from ?? '—'} → ${f.to ?? '—'}`).join('; ') : ''));
}
const changes = diff.added.length + diff.changed.length + diff.removed.length + diff.revived.length;
if (dry) { console.log('\n--dry-run: nessun file scritto.'); process.exit(0); }
if (changes) writeFileSync(catPath, JSON.stringify(catalog, null, 2) + '\n');
if (changes || logAlways) {
  const log: ChangelogEntry[] = JSON.parse(readFileSync(logPath, 'utf8'));
  writeFileSync(logPath, JSON.stringify([entry, ...log], null, 2) + '\n');
}
console.log(changes ? '\nScritti data/catalog.json e data/changelog.json.' : '\nNessuna modifica.');
