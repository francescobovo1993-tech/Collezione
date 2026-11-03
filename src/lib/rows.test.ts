import { describe, expect, it } from 'vitest';
import seed from '../../seed/catalog-seed.json';
import { data } from '../test/helpers';
import { makeId, slug } from './format';
import { DEFAULT_SORT, filterRows, sortRows, toRows, type Filters } from './rows';
import { emptyState, normState } from './state';

const rows = toRows(data.catalog, data.volumi);
const F: Filters = { q: '', show: 'all', cat: '' };

describe('ids', () => {
  it('slug strips accents and punctuation', () => {
    expect(slug('Città  Più+ (Speciale)!')).toBe('citta-piu-speciale');
    expect(makeId('fumetti', 'MANGA TP1')).toBe('fumetti~manga-tp1');
  });
  it('every seed id follows <cat>~<slug(name)>', () => {
    for (const [id, e] of Object.entries(seed as Record<string, { cat: string; name: string }>)) expect(id).toBe(makeId(e.cat, e.name));
  });
  it('split kept all 134 formats', () => expect(rows.length).toBe(134));
});

describe('sort', () => {
  it('defaults to Lato A descending with empty values last', () => {
    const s = sortRows(rows, emptyState(), DEFAULT_SORT);
    const as = s.map(r => r.a);
    const firstNull = as.indexOf(null);
    expect(firstNull).toBeGreaterThan(0);
    expect(as.slice(firstNull).every(v => v == null)).toBe(true);
    const nums = as.slice(0, firstNull) as number[];
    expect([...nums].sort((x, y) => y - x)).toEqual(nums);
  });
  it('keeps empty values last when ascending too', () => {
    const as = sortRows(rows, emptyState(), { key: 'a', dir: 1 }).map(r => r.a);
    expect(as[as.length - 1]).toBeNull();
    expect(as[0]).not.toBeNull();
  });
  it('sorts Volumi with empty notes last in both directions', () => {
    for (const dir of [1, -1] as const) {
      const v = sortRows(rows, emptyState(), { key: 'volumi', dir }).map(r => r.volumi);
      const i = v.indexOf('');
      expect(v.slice(i).every(x => x === '')).toBe(true);
    }
  });
});

describe('filter', () => {
  it('matches "140x178" and "140×178" sizes', () => {
    expect(filterRows(rows, emptyState(), { ...F, q: '140x178' }).map(r => r.id)).toContain('fumetti~manga-tp1');
    expect(filterRows(rows, emptyState(), { ...F, q: '140×178' }).map(r => r.id)).toContain('fumetti~manga-tp1');
  });
  it('matches volumi text', () => {
    expect(filterRows(rows, emptyState(), { ...F, q: 'corto maltese' }).map(r => r.id)).toContain('fumetti~a3-portfolio-2');
  });
  it('pills filter by personal state', () => {
    const st = normState({ owned: { 'fumetti~a4': true }, stock: { 'fumetti~a4': 'poche', 'fumetti~a3': 'tante' }, cart: { 'fumetti~a3': { qty: 1 } } });
    expect(filterRows(rows, st, F, 'owned').map(r => r.id)).toEqual(['fumetti~a4']);
    expect(filterRows(rows, st, F, 'notowned').length).toBe(133);
    expect(filterRows(rows, st, F, 'poche').map(r => r.id)).toEqual(['fumetti~a4']);
    expect(filterRows(rows, st, F, 'tante').map(r => r.id)).toEqual(['fumetti~a3']);
    expect(filterRows(rows, st, F, 'cart').map(r => r.id)).toEqual(['fumetti~a3']);
    expect(filterRows(rows, st, { ...F, cat: 'laterale' }).length).toBe(3);
  });
});
