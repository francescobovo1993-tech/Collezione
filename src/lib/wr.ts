/* Parsing and diffing of the wrbuste.it product page. Ported from the prototype. */
import { FIELDS } from './constants';
import { makeId, slug } from './format';
import type { Catalog, CatalogEntry, ChangeItem, ChangelogEntry } from './types';

const SECTION_MAP: [RegExp, string][] = [
  [/CHIUSURA LATERALE/i, 'laterale'], [/SPERIMENTALI/i, 'sperimentali'], [/MUSICA|VIDEOGIOCHI/i, 'musica'],
  [/MANIFESTI|LOCANDINE/i, 'manifesti'], [/FUMETTI/i, 'fumetti'],
];

export interface ParsedRow {
  id: string; name: string; cat: string;
  a: number | null; b: number | null; price: number | null; pack: number | null; material: string; notes: string;
}
export interface Section {
  cat: string; label: string; updated: string; total: number | null; rows: ParsedRow[]; blank: number; searched?: boolean;
}

export function parseRow(cells: string[], cat: string): ParsedRow | null {
  const name = cells[0];
  let a: number | null = null, b: number | null = null, price: number | null = null, pack: number | null = null, material = '';
  const notes: string[] = [];
  cells.forEach((c, i) => {
    if (!c) return;
    const m = c.match(/^(\d{2,3})\s*[x×]\s*(\d{2,3})(\s*mm)?$/i);
    if (m && a == null) { a = +m[1]; b = +m[2]; return; }
    if (i === 0) return;
    if (price == null && /^\d{1,3}(\.\d{3})*,\d{2}$/.test(c)) { price = parseFloat(c.replace(/\./g, '').replace(',', '.')); return; }
    if (pack == null && /^\d+$/.test(c)) { pack = +c; return; }
    if (!material && /polipropilene|micron/i.test(c)) { material = c.replace(/\s+/g, ' '); return; }
    notes.push(c);
  });
  if (!name) return null;
  return { id: makeId(cat, name), name, cat, a, b, price, pack, material, notes: notes.join(' ') };
}

/** Parse the page as plain text: headings on their own line, table rows as tab-separated cells. */
export function parsePage(txt: string): Section[] {
  const sections: Section[] = [];
  let cur: Section | null = null;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/ /g, ' ');
    const h = line.trim().match(/^BUSTE PER (.+)$/i);
    if (h) {
      const key = SECTION_MAP.find(([re]) => re.test(h[1]))?.[1] ?? 'altro-' + slug(h[1]);
      cur = { cat: key, label: h[1].trim(), updated: '', total: null, rows: [], blank: 0 };
      sections.push(cur);
      continue;
    }
    if (!cur) continue;
    let m = line.match(/Ultimo aggiornamento:\s*(.+)/i);
    if (m) { cur.updated = m[1].trim(); continue; }
    m = line.match(/Vista da\s+\d+\s+a\s+\d+\s+di\s+(\d+)\s+elementi/i);
    if (m) { cur.total = +m[1]; continue; }
    if ((line.match(/\t/g) || []).length < 3) continue;
    const cells = line.split('\t').map(c => c.trim());
    if (!cells.some(Boolean)) { cur.blank++; continue; }
    const r = parseRow(cells, cur.cat);
    if (r) cur.rows.push(r);
  }
  return sections;
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', times: '×', ndash: '–', egrave: 'è', agrave: 'à', ograve: 'ò', ugrave: 'ù', igrave: 'ì', eacute: 'é' };
const decode = (s: string) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (all, e: string) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : all; }
    return ENT[e.toLowerCase()] ?? all;
  });
const strip = (s: string) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/[ \t ]+/g, ' ').trim();

/**
 * Turn the raw HTML into the text shape parsePage() expects:
 * each data <tr> becomes one tab-separated line; header rows (<th> only) are dropped.
 */
export function htmlToText(html: string): string {
  let s = html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, (_, inner: string) => {
    const tds = [...inner.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => strip(m[1]));
    if (!tds.length) return '\n';
    while (tds.length < 4) tds.push('');
    return '\n' + tds.join('\u0001') + '\n';
  });
  s = s.replace(/<\/?(p|div|h[1-6]|li|ul|ol|br|section|article|header|footer|table|thead|tbody|caption)\b[^>]*>/gi, '\n');
  return s.split('\n').map(line => (line.includes('\u0001') ? line.split('\u0001').join('\t') : strip(line))).join('\n');
}

/* ---------- diff ---------- */

const eq = (x: unknown, y: unknown) =>
  typeof x === 'number' || typeof y === 'number'
    ? (x == null && y == null) || (x != null && y != null && Math.abs((x as number) - (y as number)) < 0.001)
    : String(x ?? '').trim() === String(y ?? '').trim();

export interface Diff {
  next: Map<string, ParsedRow & { order: number }>;
  added: (ParsedRow & { order: number })[];
  changed: { id: string; r: ParsedRow & { order: number }; cur: CatalogEntry; ch: string[] }[];
  removed: (CatalogEntry & { id: string })[];
  revived: { id: string; r: ParsedRow & { order: number } }[];
  same: number;
  warns: string[];
}

/**
 * Compare parsed sections with the current catalogue.
 * A section only marks missing formats as removed when we know we read all of it:
 * either the DataTables count matched, or (HTML mode) it was server-rendered and didn't shrink by more than half.
 */
export function diffCatalog(current: Catalog, sections: Section[], opts: { fullHtml?: boolean } = {}): Diff {
  const next = new Map<string, ParsedRow & { order: number }>();
  let order = 0;
  const complete = new Set<string>();
  const warns: string[] = [];
  for (const s of sections) {
    for (const r of s.rows) if (!next.has(r.id)) next.set(r.id, { ...r, order: order++ });
    let ok = s.total == null
      ? !!opts.fullHtml && s.rows.length > 0
      : s.rows.length + s.blank >= s.total || (!!s.searched && s.rows.length >= s.total - 5);
    if (ok) {
      const had = Object.values(current).filter(e => e.cat === s.cat && e.source !== 'manuale' && !e.removed).length;
      if (had && s.rows.length < had / 2) {
        ok = false;
        warns.push(`«${s.label}»: lette solo ${s.rows.length} righe su ${had} attese. Nessun formato di questa sezione verrà segnato come rimosso.`);
      }
    } else {
      warns.push(`«${s.label}»: lette ${s.rows.length} righe${s.total ? ` su ${s.total}` : ''}. I formati mancanti di questa sezione non verranno segnati come rimossi.`);
    }
    if (ok) complete.add(s.cat);
  }
  const added: Diff['added'] = [], changed: Diff['changed'] = [], revived: Diff['revived'] = [], removed: Diff['removed'] = [];
  let same = 0;
  for (const [id, r] of next) {
    const cur = current[id];
    if (!cur) { added.push(r); continue; }
    const ch = FIELDS.filter(f => !eq(cur[f], r[f]));
    if (ch.length) changed.push({ id, r, cur, ch });
    else if (cur.removed) revived.push({ id, r });
    else same++;
  }
  for (const [id, cur] of Object.entries(current)) {
    if (cur.source !== 'manuale' && !cur.removed && !next.has(id) && complete.has(cur.cat)) removed.push({ ...cur, id });
  }
  return { next, added, changed, removed, revived, same, warns };
}

export function summarize(d: Pick<Diff, 'added' | 'changed' | 'removed' | 'revived'>): string {
  const parts: string[] = [];
  if (d.added.length) parts.push(d.added.length + ' nuovi');
  if (d.changed.length) parts.push(d.changed.length + ' modificati');
  if (d.removed.length) parts.push(d.removed.length + ' rimossi');
  if (d.revived.length) parts.push(d.revived.length + ' tornati');
  return parts.length ? 'Aggiornamento da wrbuste.it: ' + parts.join(', ') : 'Controllo wrbuste.it: nessuna modifica';
}

/** Apply a diff. Returns a new catalogue (input untouched) and the changelog entry. */
export function applyDiff(current: Catalog, d: Diff, now = new Date().toISOString()): { catalog: Catalog; entry: ChangelogEntry } {
  const catalog: Catalog = {};
  for (const [id, e] of Object.entries(current)) catalog[id] = { ...e };
  for (const r of d.added) {
    catalog[r.id] = { name: r.name, cat: r.cat, a: r.a, b: r.b, price: r.price, pack: r.pack, material: r.material, notes: r.notes,
      source: 'wr', removed: false, order: r.order, updatedAt: now };
  }
  for (const c of d.changed) {
    const e = { ...catalog[c.id], removed: false, order: c.r.order, updatedAt: now } as CatalogEntry & Record<string, unknown>;
    for (const f of c.ch) e[f] = c.r[f as keyof ParsedRow];
    delete e.removedAt;
    catalog[c.id] = e;
  }
  for (const c of d.revived) {
    const e = { ...catalog[c.id], removed: false, updatedAt: now };
    delete e.removedAt;
    catalog[c.id] = e;
  }
  for (const r of d.removed) catalog[r.id] = { ...catalog[r.id], removed: true, removedAt: now };
  // keep surviving entries in site order
  for (const [id, r] of d.next) if (catalog[id] && !d.added.includes(r)) catalog[id] = { ...catalog[id], order: r.order };

  const items: ChangeItem[] = [
    ...d.added.map(r => ({ t: 'add' as const, name: r.name, cat: r.cat })),
    ...d.changed.map(c => ({ t: 'chg' as const, name: c.r.name, cat: c.r.cat,
      fields: c.ch.map(f => ({ f, from: (c.cur as unknown as Record<string, unknown>)[f] ?? null, to: (c.r as unknown as Record<string, unknown>)[f] ?? null })) })),
    ...d.removed.map(r => ({ t: 'del' as const, name: r.name, cat: r.cat })),
  ].slice(0, 120);
  const entry: ChangelogEntry = { at: now, summary: summarize(d), added: d.added.length, changed: d.changed.length, removed: d.removed.length, items };
  return { catalog: sortCatalog(catalog), entry };
}

/** Stable key order for readable git diffs: by `order`, then id. */
export function sortCatalog(c: Catalog): Catalog {
  return Object.fromEntries(Object.entries(c).sort(([ia, a], [ib, b]) => (a.order - b.order) || ia.localeCompare(ib)));
}
