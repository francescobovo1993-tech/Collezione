/**
 * One-off: split seed/catalog-seed.json into the data/ files.
 *   npm run split-seed            (refuses to overwrite existing data/ files)
 *   npm run split-seed -- --force
 * Leaves seed/ untouched.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sortCatalog } from '../src/lib/wr.ts';
import type { Catalog, ChangelogEntry } from '../src/lib/types.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');

interface SeedEntry {
  name: string; cat: string; a: number | null; b: number | null; price: number | null; pack: number | null;
  material: string; notes: string; volumi: string; sheetBobbi: boolean; sheetPomo: boolean; sheetNota: string;
  source: 'wr' | 'manuale'; removed: boolean; order: number;
}

const seed: Record<string, SeedEntry> = JSON.parse(readFileSync(join(root, 'seed/catalog-seed.json'), 'utf8'));
const now = new Date().toISOString();

const catalog: Catalog = {};
const volumi: Record<string, string> = {};
for (const [id, e] of Object.entries(seed)) {
  catalog[id] = { name: e.name, cat: e.cat, a: e.a, b: e.b, price: e.price, pack: e.pack, material: e.material ?? '',
    notes: e.notes ?? '', source: e.source, removed: !!e.removed, order: e.order, updatedAt: now };
  volumi[id] = e.volumi ?? '';
}
const sorted = sortCatalog(catalog);
const changelog: ChangelogEntry[] = [{
  at: now, summary: `Importazione iniziale: ${Object.keys(catalog).length} formati`,
  added: Object.keys(catalog).length, changed: 0, removed: 0, items: [],
}];

const out: [string, unknown][] = [
  ['data/catalog.json', sorted],
  ['data/volumi.json', Object.fromEntries(Object.keys(sorted).map(id => [id, volumi[id]]))],
  ['data/changelog.json', changelog],
];
mkdirSync(join(root, 'data'), { recursive: true });
for (const [rel] of out) {
  const p = join(root, rel);
  if (existsSync(p) && !force) { console.error(`${rel} esiste già: uso --force per sovrascrivere.`); process.exit(1); }
}
for (const [rel, v] of out) {
  writeFileSync(join(root, rel), JSON.stringify(v, null, 2) + '\n');
  console.log('scritto', rel);
}
