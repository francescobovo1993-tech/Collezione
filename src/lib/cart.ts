import { coll, eur } from './format';
import type { Row, State } from './types';

export interface CartLine { id: string; qty: number; r: Pick<Row, 'name' | 'a' | 'b' | 'cat' | 'pack' | 'price'> }
export interface CopyOpts { dims: boolean; prices: boolean; greet: boolean }
export const DEFAULT_COPY: CopyOpts = { dims: true, prices: false, greet: true };

export function cartLines(st: State, byId: Map<string, Row>): CartLine[] {
  return Object.entries(st.cart)
    .filter(([, c]) => c.qty > 0)
    .map(([id, c]) => ({ id, qty: c.qty, r: byId.get(id) ?? { name: id, a: null, b: null, cat: '', pack: null, price: null } }))
    .sort((x, y) => coll.compare(x.r.name, y.r.name));
}

export const packsOf = (l: CartLine) => Math.ceil(l.qty / (l.r.pack || 100));
export const estOf = (l: CartLine) => (l.r.price != null ? packsOf(l) * l.r.price : null);
export const estimate = (qty: number, pack: number | null, price: number | null) =>
  price != null ? Math.ceil((qty || 0) / (pack || 100)) * price : null;

/** The message for the shop. Same format as cartText() in the prototype. */
export function cartText(ls: CartLine[], o: CopyOpts): string {
  if (!ls.length) return '';
  const body = ls.map(l => {
    let s = `- ${l.r.name}`;
    if (o.dims && l.r.a && l.r.b) s += ` (${l.r.a}x${l.r.b} mm)`;
    if (l.r.cat === 'laterale') s += ' – chiusura laterale';
    s += ` – ${l.qty} pz`;
    const e = estOf(l);
    if (o.prices && e != null) s += ` (≈ ${eur(e)})`;
    return s;
  }).join('\n');
  const totPcs = ls.reduce((s, l) => s + l.qty, 0);
  const tot = ls.reduce((s, l) => s + (estOf(l) || 0), 0);
  let txt = (o.greet ? 'Buongiorno,\nvorrei ordinare le seguenti buste W.R.:\n\n' : '') + body +
    `\n\nTotale: ${totPcs} buste` + (o.prices ? ` (≈ ${eur(tot)} a listino WR)` : '');
  if (o.greet) txt += '\n\nGrazie mille!';
  return txt;
}
