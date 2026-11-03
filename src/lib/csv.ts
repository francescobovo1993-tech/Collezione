/*
 * Personal state as a spreadsheet: one row per format.
 * Export uses ";" and a UTF-8 BOM so Excel (Italian locale) opens it straight into columns.
 * Import accepts ";", "," or tab, and only reads: id (or Formato), Ce l'ho, Scorte, Carrello (pz).
 */
import { CATS, STOCK_LABEL } from './constants';
import { coll } from './format';
import type { Row, State } from './types';

export const CSV_HEADER = ['id', 'Formato', 'Categoria', 'Lato A', 'Lato B', 'Ce l’ho', 'Scorte', 'Carrello (pz)'];

const cell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[";\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function stateToCsv(rows: Row[], st: State): string {
  const sorted = [...rows].sort((x, y) => coll.compare(CATS[x.cat] ?? x.cat, CATS[y.cat] ?? y.cat) || coll.compare(x.name, y.name));
  const lines = [CSV_HEADER, ...sorted.map(r => [
    r.id, r.name, CATS[r.cat] ?? r.cat, r.a ?? '', r.b ?? '',
    st.owned[r.id] ? 'sì' : '', st.stock[r.id] ? STOCK_LABEL[st.stock[r.id]] : '', st.cart[r.id]?.qty || '',
  ])];
  return '\ufeff' + lines.map(l => l.map(cell).join(';')).join('\r\n') + '\r\n';
}

/** Minimal RFC 4180 parser (quotes, doubled quotes, newlines in quotes). */
export function parseCsv(text: string, sep: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { f += '"'; i++; }
      else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); out.push(row); row = []; f = '';
    } else f += c;
  }
  if (f || row.length) { row.push(f); out.push(row); }
  return out.filter(r => r.some(x => x.trim()));
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
const YES = new Set(['si', 'sì', 'yes', 'y', 'x', '1', 'true', 'vero', 'ok', '✓', '✔']);

export interface CsvImport { state: State; matched: number; unknown: string[] }

/**
 * Build a new State from a CSV. Formats not in the file end up unmarked (the file is the whole state).
 * Throws an Error with an Italian message if the file isn't usable.
 */
export function csvToState(text: string, rows: Row[]): CsvImport {
  const body = text.replace(/^\ufeff/, '');
  const first = body.split(/\r?\n/, 1)[0] ?? '';
  const sep = [';', '\t', ','].map(s => [s, first.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const [head, ...data] = parseCsv(body, sep);
  if (!head) throw new Error('Il file è vuoto.');
  const h = head.map(norm);
  const col = (...names: string[]) => h.findIndex(x => names.some(n => x === n || x.startsWith(n)));
  const iId = col('id'), iName = col('formato', 'nome'), iCat = col('categoria');
  const iOwn = col('ce lho', 'posseduta', 'owned'), iStock = col('scorte', 'stock'), iCart = col('carrello', 'cart');
  if (iId < 0 && iName < 0) throw new Error('Manca la colonna «id» o «Formato».');
  if (iOwn < 0 && iStock < 0 && iCart < 0) throw new Error('Mancano le colonne «Ce l’ho», «Scorte» o «Carrello (pz)».');

  const byId = new Map(rows.map(r => [r.id, r]));
  const byName = new Map<string, Row[]>();
  for (const r of rows) byName.set(norm(r.name), [...(byName.get(norm(r.name)) ?? []), r]);
  const find = (line: string[]): Row | undefined => {
    const id = iId >= 0 ? line[iId]?.trim() : '';
    if (id && byId.has(id)) return byId.get(id);
    const same = byName.get(norm(line[iName] ?? '')) ?? [];
    if (same.length === 1) return same[0];
    const cat = norm(line[iCat] ?? '');
    return same.find(r => norm(CATS[r.cat] ?? r.cat) === cat);
  };

  const state: State = { owned: {}, stock: {}, cart: {}, imported: 'csv' };
  const unknown: string[] = [];
  let matched = 0;
  const at = new Date().toISOString();
  for (const line of data) {
    const r = find(line);
    if (!r) { unknown.push(line[iName] || line[iId] || '?'); continue; }
    matched++;
    if (iOwn >= 0 && YES.has(norm(line[iOwn] ?? ''))) state.owned[r.id] = true;
    const s = iStock >= 0 ? norm(line[iStock] ?? '') : '';
    if (s.startsWith('poch')) state.stock[r.id] = 'poche';
    else if (s.startsWith('tant')) state.stock[r.id] = 'tante';
    const q = iCart >= 0 ? Math.round(Number((line[iCart] ?? '').replace(/\./g, '').replace(',', '.'))) : 0;
    if (q > 0) state.cart[r.id] = { qty: q, at };
  }
  if (!matched) throw new Error('Nessuna riga corrisponde ai formati del catalogo.');
  return { state, matched, unknown };
}
