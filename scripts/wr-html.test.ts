import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import catalogJson from '../data/catalog.json';
import type { Catalog } from '../src/lib/types';
import { applyDiff, diffCatalog } from '../src/lib/wr';
import { diffMarkdown } from './lib/markdown';
import { parseHtml } from './lib/wr-html';

const catalog = catalogJson as unknown as Catalog;
const fixture = readFileSync(join(__dirname, 'fixtures/wr-page.html'), 'utf8');

describe('parseHtml on the WR fixture', () => {
  const { sections, problems } = parseHtml(fixture);

  it('finds every section in order with all rows in the static HTML', () => {
    expect(problems).toEqual([]);
    expect(sections.map(s => [s.cat, s.rows.length])).toEqual([
      ['fumetti', 101], ['musica', 21], ['laterale', 3], ['sperimentali', 2], ['manifesti', 6],
    ]);
    expect(sections[0]).toMatchObject({ blank: 1, total: 102, updated: '01/10/2026' });
  });
  it('skips header rows and decodes entities', () => {
    const all = sections.flatMap(s => s.rows);
    expect(all.find(r => r.name === 'Nome')).toBeUndefined();
    expect(all.find(r => r.id === 'fumetti~manga-tp1')).toMatchObject({ a: 140, b: 178, material: 'POLIPROPILENE 60micron' });
  });
  it('round-trips: parsing the page gives no changes against data/catalog.json', () => {
    const d = diffCatalog(catalog, sections);
    expect([d.added, d.changed, d.removed, d.revived].map(x => x.length)).toEqual([0, 0, 0, 0]);
    expect(d.same).toBe(133);
  });
  it('detects added, changed and removed formats on an edited page', () => {
    const edited = fixture
      .replace('<td><strong>MANGA TP1</strong></td><td>140x178 mm</td><td>11,00</td>', '<td><strong>MANGA TP1</strong></td><td>140x178 mm</td><td>12,50</td>')
      .replace(/<tr><td><strong>A3<\/strong><\/td>.*?<\/tr>\n/, '')
      .replace('</tbody></table>', '<tr><td>NUOVO</td><td>150x200 mm</td><td>14,00</td><td>100</td><td>POLIPROPILENE 60micron</td><td></td></tr></tbody></table>');
    const d = diffCatalog(catalog, parseHtml(edited).sections);
    expect(d.added.map(r => r.id)).toEqual(['fumetti~nuovo']);
    expect(d.changed.map(c => [c.id, c.ch])).toEqual([['fumetti~manga-tp1', ['price']]]);
    expect(d.removed.map(r => r.id)).toEqual(['fumetti~a3']);
    const md = diffMarkdown(d, applyDiff(catalog, d).entry.summary);
    expect(md).toContain('## Aggiornamento da wrbuste.it: 1 nuovi, 1 modificati, 1 rimossi');
    expect(md).toContain('### Nuovi\n\n- **NUOVO** (Fumetti) — 150×200 mm · €14,00 /100 pz');
    expect(md).toContain('### Modificati\n\n- **MANGA TP1** (Fumetti)\n  - prezzo: €11,00 → €12,50');
    expect(md).toContain('### Non più sul sito\n\n- **A3** (Fumetti)');
  });
});

describe('parseHtml: when the HTML is not enough', () => {
  it('flags server-side DataTables and does not trust the row count', () => {
    const { sections, problems } = parseHtml(fixture.replace('pageLength: 10', 'serverSide: true, ajax: "/rows"'));
    expect(problems.join(' ')).toMatch(/ajax\/serverSide/);
    expect(sections.every(s => s.total === null)).toBe(true);
  });
  it('flags empty tables and a page with no sections', () => {
    expect(parseHtml('<h2>BUSTE PER FUMETTI</h2><table><tbody><tr><td class="dataTables_empty">Nessun dato</td></tr></tbody></table>').problems.join(' ')).toMatch(/senza righe/);
    expect(parseHtml('<p>Pagina in manutenzione</p>').problems).toEqual(['nessuna sezione «BUSTE PER …» trovata']);
  });
  it('uses data-wr-total stamped by the browser fallback', () => {
    const [s] = parseHtml('<h2>BUSTE PER FUMETTI</h2><table data-wr-total="5"><tbody><tr><td>A</td><td>100x100</td><td>1,00</td><td>1</td></tr></tbody></table>').sections;
    expect(s.total).toBe(5);
  });
});
