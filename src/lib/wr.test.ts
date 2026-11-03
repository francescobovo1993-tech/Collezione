import { describe, expect, it } from 'vitest';
import { applyDiff, diffCatalog, parsePage, parseRow, sectionCat, type Section } from './wr';
import type { Catalog, CatalogEntry } from './types';

const entry = (o: Partial<CatalogEntry>): CatalogEntry => ({
  name: '', cat: 'fumetti', a: null, b: null, price: null, pack: null, material: '', notes: '',
  source: 'wr', removed: false, order: 0, updatedAt: '2026-01-01T00:00:00.000Z', ...o,
});
const section = (cat: string, rows: string[][], total: number | null = rows.length): Section => ({
  cat, label: cat.toUpperCase(), updated: '', total, blank: 0, rows: rows.map(c => parseRow(c, cat)!).filter(Boolean),
});
const MAT = 'POLIPROPILENE 60micron';

describe('parseRow', () => {
  it('reads size, Italian price, pieces, material and notes', () => {
    expect(parseRow(['MANGA TP1', '140x178 mm', '1.012,00', '100', 'POLIPROPILENE  60micron', 'Nota', 'altro'], 'fumetti')).toEqual({
      id: 'fumetti~manga-tp1', name: 'MANGA TP1', cat: 'fumetti', a: 140, b: 178, price: 1012, pack: 100, material: MAT, notes: 'Nota altro',
    });
  });
  it('accepts "×" and sizes without "mm"', () => {
    expect(parseRow(['A4', '230 × 315', '12,00', '100'], 'fumetti')).toMatchObject({ a: 230, b: 315, price: 12 });
  });
  it('sperimentali: the name itself is the size', () => {
    expect(parseRow(['220x325 mm', '25,00', '100', MAT, '- Vari volumi'], 'sperimentali')).toMatchObject({
      id: 'sperimentali~220x325-mm', name: '220x325 mm', a: 220, b: 325, price: 25, pack: 100, notes: '- Vari volumi',
    });
  });
  it('laterale: no size', () => {
    expect(parseRow(['BONELLI', '', '14,00', '100', MAT, 'Dylan Dog'], 'laterale')).toMatchObject({ a: null, b: null, price: 14, notes: 'Dylan Dog' });
  });
  it('a size-like note such as "Poster 35X50 cm" stays a note', () => {
    expect(parseRow(['POSTER 1', '352x500', '35,00', '50', 'POLIPROPILENE 80micron', 'Poster 35X50 cm'], 'manifesti')).toMatchObject({ a: 352, b: 500, notes: 'Poster 35X50 cm' });
  });
  it('rows without a name are skipped', () => expect(parseRow(['', '140x178', '12,00'], 'fumetti')).toBeNull());
});

describe('section mapping (SECTION_MAP)', () => {
  it.each([
    ['FUMETTI', 'fumetti'], ['MUSICA E VIDEOGIOCHI', 'musica'], ['VIDEOGIOCHI', 'musica'],
    ['FUMETTI A CHIUSURA LATERALE', 'laterale'], ['FORMATI SPERIMENTALI', 'sperimentali'],
    ['MANIFESTI E LOCANDINE', 'manifesti'], ['LOCANDINE', 'manifesti'], ['Cartoline', 'altro-cartoline'],
  ])('%s → %s', (label, cat) => expect(sectionCat(label)).toBe(cat));
});

describe('parsePage (pasted text)', () => {
  it('reads headings, update date, DataTables count and tab-separated rows; counts blank rows', () => {
    const txt = 'BUSTE PER FUMETTI\nUltimo aggiornamento: ieri\nMANGA TP1\t140x178\t12,00\t100\tPOLIPROPILENE\tx\n\t\t\t\t\nVista da 1 a 2 di 2 elementi';
    const [s] = parsePage(txt);
    expect(s).toMatchObject({ cat: 'fumetti', updated: 'ieri', total: 2, blank: 1 });
    expect(s.rows[0]).toMatchObject({ a: 140, b: 178, price: 12 });
  });
});

describe('diff', () => {
  const current: Catalog = {
    'fumetti~manga-tp1': entry({ name: 'MANGA TP1', a: 140, b: 178, price: 11, pack: 100, material: MAT, notes: 'Manga', order: 0 }),
    'fumetti~vecchio': entry({ name: 'VECCHIO', a: 100, b: 100, order: 1 }),
    'manuale~mio': entry({ name: 'MIO', cat: 'manuale', source: 'manuale', order: 999 }),
  };
  const page = [section('fumetti', [['MANGA TP1', '140x178', '12,00', '100', MAT, 'Manga'], ['A4', '230x315', '20,00', '100', MAT, '']])];

  it('finds added, changed (only changed fields) and removed; never removes manual formats', () => {
    const d = diffCatalog(current, page);
    expect(d.added.map(r => r.id)).toEqual(['fumetti~a4']);
    expect(d.changed.map(c => [c.id, c.ch])).toEqual([['fumetti~manga-tp1', ['price']]]);
    expect(d.removed.map(r => r.id)).toEqual(['fumetti~vecchio']);
    const { catalog, entry: log } = applyDiff(current, d, '2026-11-03T00:00:00.000Z');
    expect(catalog['fumetti~a4']).toMatchObject({ removed: false, source: 'wr', price: 20 });
    expect(catalog['fumetti~manga-tp1']).toMatchObject({ price: 12, notes: 'Manga', updatedAt: '2026-11-03T00:00:00.000Z' });
    expect(catalog['fumetti~vecchio']).toMatchObject({ removed: true, name: 'VECCHIO' }); // kept, never deleted
    expect(catalog['manuale~mio'].removed).toBe(false);
    expect(current['fumetti~manga-tp1'].price).toBe(11); // input untouched
    expect(log).toMatchObject({ added: 1, changed: 1, removed: 1, summary: 'Aggiornamento da wrbuste.it: 1 nuovi, 1 modificati, 1 rimossi' });
    expect(log.items.find(i => i.t === 'chg')?.fields).toEqual([{ f: 'price', from: 11, to: 12 }]);
  });
  it('no removals for a section that was not fully read (total unknown or short)', () => {
    expect(diffCatalog(current, [section('fumetti', [['MANGA TP1', '140x178', '11,00', '100', MAT, 'Manga']], null)]).removed).toEqual([]);
    expect(diffCatalog(current, [section('fumetti', [['MANGA TP1', '140x178', '11,00', '100', MAT, 'Manga']], 5)]).removed).toEqual([]);
  });
  it('no removals for sections that were not on the page at all', () => {
    const cur = { ...current, 'musica~lp': entry({ name: 'LP', cat: 'musica' }) };
    expect(diffCatalog(cur, page).removed.map(r => r.id)).toEqual(['fumetti~vecchio']);
  });
  it('no removals when a section shrinks to under half of what we had', () => {
    const big: Catalog = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`fumetti~f${i}`, entry({ name: `F${i}`, order: i })]));
    const d = diffCatalog(big, page);
    expect(d.removed).toEqual([]);
    expect(d.warns.join(' ')).toMatch(/lette solo 2 righe su 10/);
  });
  it('revives a removed format that is back on the site', () => {
    const cur: Catalog = { 'laterale~bonelli': entry({ name: 'BONELLI', cat: 'laterale', price: 14, pack: 100, material: MAT, notes: 'x', removed: true, removedAt: 'y' }) };
    const d = diffCatalog(cur, [section('laterale', [['BONELLI', '', '14,00', '100', MAT, 'x']])]);
    expect(d.revived.map(r => r.id)).toEqual(['laterale~bonelli']);
    const out = applyDiff(cur, d).catalog['laterale~bonelli'];
    expect(out.removed).toBe(false);
    expect(out.removedAt).toBeUndefined();
  });
});
