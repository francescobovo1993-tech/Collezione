import { CATS } from './constants';
import { coll } from './format';
import type { Catalog, Row, State } from './types';

/** Catalogue rows with their Volumi note: the online shared edit if there is one, else data/volumi.json. */
export const toRows = (catalog: Catalog, volumi: Record<string, string>, overrides: Record<string, string> = {}): Row[] =>
  Object.entries(catalog).map(([id, e]) => ({ ...e, id, volumi: overrides[id] ?? volumi[id] ?? '' }));

export type Show = 'all' | 'owned' | 'notowned' | 'poche' | 'tante' | 'cart';
export interface Filters { q: string; show: Show }
export type SortKey = 'owned' | 'stock' | 'name' | 'a' | 'b' | 'cat' | 'price' | 'volumi' | 'notes' | 'cart';
export interface Sort { key: SortKey; dir: 1 | -1 }

export const DEFAULT_SORT: Sort = { key: 'a', dir: 1 }; // Lato A, smallest first

export function filterRows(rows: Row[], st: State, f: Filters, show: Show = f.show): Row[] {
  const q = f.q.trim().toLowerCase().replace(/×/g, 'x');
  let out = rows;
  if (show === 'owned') out = out.filter(r => st.owned[r.id]);
  if (show === 'notowned') out = out.filter(r => !st.owned[r.id]);
  if (show === 'poche' || show === 'tante') out = out.filter(r => st.stock[r.id] === show);
  if (show === 'cart') out = out.filter(r => (st.cart[r.id]?.qty ?? 0) > 0);
  if (q) out = out.filter(r =>
    [r.name, r.volumi, r.notes, r.a && r.b ? `${r.a}x${r.b}` : '', CATS[r.cat] ?? ''].join(' ').toLowerCase().includes(q));
  return out;
}

/** Sort a copy. Empty values always go last, whatever the direction. Ties break on name. */
export function sortRows(rows: Row[], st: State, sort: Sort): Row[] {
  const { key, dir } = sort;
  const val = (r: Row): string | number | null => {
    switch (key) {
      case 'owned': return st.owned[r.id] ? 0 : 1;
      case 'stock': return ({ poche: 0, tante: 1 } as Record<string, number>)[st.stock[r.id] ?? ''] ?? null;
      case 'name': return r.name;
      case 'a': return r.a;
      case 'b': return r.b;
      case 'cat': return CATS[r.cat] ?? r.cat;
      case 'price': return r.price;
      case 'volumi': return r.volumi || null;
      case 'notes': return r.notes || null;
      case 'cart': { const q = st.cart[r.id]?.qty ?? 0; return q ? -q : null; }
    }
  };
  return [...rows].sort((x, y) => {
    const a = val(x), b = val(y);
    if (a == null && b == null) return coll.compare(x.name, y.name);
    if (a == null) return 1;
    if (b == null) return -1;
    const c = typeof a === 'number' && typeof b === 'number' ? a - b : coll.compare(String(a), String(b));
    return c * dir || coll.compare(x.name, y.name);
  });
}
