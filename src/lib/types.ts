export type Cat = 'fumetti' | 'musica' | 'laterale' | 'sperimentali' | 'manifesti' | 'manuale';
export type Stock = 'poche' | 'tante';

/** One bag format as written by the refresh script (data/catalog.json). */
export interface CatalogEntry {
  name: string;
  cat: Cat | string;
  a: number | null;
  b: number | null;
  price: number | null;
  pack: number | null;
  material: string;
  notes: string;
  source: 'wr' | 'manuale';
  removed: boolean;
  order: number;
  updatedAt: string;
  removedAt?: string;
}
export type Catalog = Record<string, CatalogEntry>;

/** A catalogue entry joined with its id and the curated "Volumi" note. */
export interface Row extends CatalogEntry {
  id: string;
  volumi: string;
}

export interface CartItem { qty: number; at?: string }
export interface State {
  owned: Record<string, true>;
  stock: Record<string, Stock>;
  cart: Record<string, CartItem>;
  imported: string | null;
}

export interface FieldChange { f: string; from: unknown; to: unknown }
export interface ChangeItem { t: 'add' | 'chg' | 'del'; name: string; cat: string; fields?: FieldChange[] }
export interface ChangelogEntry {
  at: string;
  summary: string;
  added: number;
  changed: number;
  removed: number;
  items: ChangeItem[];
}
