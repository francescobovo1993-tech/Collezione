import { describe, expect, it } from 'vitest';
import { applyDiff, diffCatalog, htmlToText, parsePage, parseRow } from './wr';
import type { Catalog, CatalogEntry } from './types';

const entry = (o: Partial<CatalogEntry>): CatalogEntry => ({
  name: '', cat: 'fumetti', a: null, b: null, price: null, pack: null, material: '', notes: '',
  source: 'wr', removed: false, order: 0, updatedAt: '2026-01-01T00:00:00.000Z', ...o,
});

const HTML = `<html><body><script>var x = "<tr><td>no</td></tr>";</script>
<h2>BUSTE PER FUMETTI</h2><p>Ultimo aggiornamento: 01/11/2026</p>
<table><thead><tr><th>Nome</th><th>Misure</th><th>Prezzo</th><th>Pezzi</th><th>Materiale</th><th>Note</th></tr></thead>
<tbody>
<tr><td>MANGA TP1</td><td>140x178 mm</td><td>12,00</td><td>100</td><td>POLIPROPILENE 60micron</td><td>Manga &amp; tascabili</td></tr>
<tr><td>A4</td><td>230 × 315</td><td>1.020,50</td><td>100</td><td>POLIPROPILENE&nbsp;60micron</td><td></td></tr>
</tbody></table>
<h3>Buste per chiusura laterale</h3>
<table><tr><td>BONELLI</td><td></td><td>9,00</td><td>100</td><td>POLIPROPILENE 60micron</td><td>Apertura sul lato</td></tr></table>
</body></html>`;

describe('parsing', () => {
  it('parseRow reads sizes, Italian prices, pack, material and notes', () => {
    expect(parseRow(['MANGA TP1', '140x178 mm', '1.012,00', '100', 'POLIPROPILENE  60micron', 'Nota', 'altro'], 'fumetti')).toEqual({
      id: 'fumetti~manga-tp1', name: 'MANGA TP1', cat: 'fumetti', a: 140, b: 178, price: 1012, pack: 100, material: 'POLIPROPILENE 60micron', notes: 'Nota altro',
    });
  });
  it('parsePage reads copied page text (prototype "Incolla testo" format)', () => {
    const txt = 'BUSTE PER FUMETTI\nUltimo aggiornamento: ieri\nMANGA TP1\t140x178\t12,00\t100\tPOLIPROPILENE\tx\nVista da 1 a 1 di 1 elementi';
    const [s] = parsePage(txt);
    expect(s).toMatchObject({ cat: 'fumetti', updated: 'ieri', total: 1 });
    expect(s.rows[0]).toMatchObject({ a: 140, b: 178, price: 12 });
  });
  it('htmlToText + parsePage read the HTML tables, skipping header rows and scripts', () => {
    const secs = parsePage(htmlToText(HTML));
    expect(secs.map(s => [s.cat, s.rows.length])).toEqual([['fumetti', 2], ['laterale', 1]]);
    expect(secs[0].updated).toBe('01/11/2026');
    expect(secs[0].rows[0]).toMatchObject({ id: 'fumetti~manga-tp1', a: 140, b: 178, price: 12, pack: 100, notes: 'Manga & tascabili' });
    expect(secs[0].rows[1]).toMatchObject({ id: 'fumetti~a4', a: 230, b: 315, price: 1020.5, material: 'POLIPROPILENE 60micron' });
    expect(secs[1].rows[0]).toMatchObject({ id: 'laterale~bonelli', a: null, price: 9 });
  });
});

describe('diff', () => {
  const current: Catalog = {
    'fumetti~manga-tp1': entry({ name: 'MANGA TP1', a: 140, b: 178, price: 11, pack: 100, material: 'POLIPROPILENE 60micron', notes: 'Manga & tascabili', order: 0 }),
    'fumetti~vecchio': entry({ name: 'VECCHIO', a: 100, b: 100, order: 1 }),
    'manuale~mio': entry({ name: 'MIO', cat: 'manuale', source: 'manuale', order: 999 }),
  };
  it('finds added, changed and removed formats and never removes manual ones', () => {
    const d = diffCatalog(current, parsePage(htmlToText(HTML)), { fullHtml: true });
    expect(d.added.map(r => r.id).sort()).toEqual(['fumetti~a4', 'laterale~bonelli']);
    expect(d.changed.map(c => [c.id, c.ch])).toEqual([['fumetti~manga-tp1', ['price']]]);
    expect(d.removed.map(r => r.id)).toEqual(['fumetti~vecchio']);
    const { catalog, entry: log } = applyDiff(current, d, '2026-11-03T00:00:00.000Z');
    expect(catalog['fumetti~manga-tp1'].price).toBe(12);
    expect(catalog['fumetti~vecchio']).toMatchObject({ removed: true, removedAt: '2026-11-03T00:00:00.000Z' });
    expect(catalog['manuale~mio'].removed).toBe(false);
    expect(current['fumetti~manga-tp1'].price).toBe(11); // input untouched
    expect(log).toMatchObject({ added: 2, changed: 1, removed: 1, summary: 'Aggiornamento da wrbuste.it: 2 nuovi, 1 modificati, 1 rimossi' });
    expect(log.items.find(i => i.t === 'chg')?.fields).toEqual([{ f: 'price', from: 11, to: 12 }]);
  });
  it('does not mark removals when a section looks truncated', () => {
    const big: Catalog = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`fumetti~f${i}`, entry({ name: `F${i}`, order: i })]));
    const d = diffCatalog(big, parsePage(htmlToText(HTML)), { fullHtml: true });
    expect(d.removed).toEqual([]);
    expect(d.warns.join(' ')).toMatch(/lette solo 2 righe su 10/);
  });
  it('does not mark removals from pasted text without the row count', () => {
    const d = diffCatalog(current, parsePage('BUSTE PER FUMETTI\nMANGA TP1\t140x178\t11,00\t100\tPOLIPROPILENE 60micron\tManga & tascabili'));
    expect(d.removed).toEqual([]);
    expect(d.same).toBe(1);
  });
  it('revives a format that comes back', () => {
    const cur: Catalog = { 'laterale~bonelli': entry({ name: 'BONELLI', cat: 'laterale', price: 9, pack: 100, material: 'POLIPROPILENE 60micron', notes: 'Apertura sul lato', removed: true, removedAt: 'x' }) };
    const d = diffCatalog(cur, parsePage(htmlToText(HTML)), { fullHtml: true });
    expect(d.revived.map(r => r.id)).toEqual(['laterale~bonelli']);
    const out = applyDiff(cur, d).catalog['laterale~bonelli'];
    expect(out.removed).toBe(false);
    expect(out.removedAt).toBeUndefined();
  });
});
