import { CATS, STOCK_LABEL } from '../lib/constants';
import { dimsOf, eur } from '../lib/format';
import { filterRows, type Filters, type Show, type Sort, type SortKey } from '../lib/rows';
import type { Row, State, Stock } from '../lib/types';
import { IcCart, IcDown, IcSearch, IcSort, IcUp } from './icons';

export const COLS: { k: SortKey; label: string; cls: string; sortLabel: string }[] = [
  { k: 'owned', label: 'Ce l’ho', cls: 'c-own', sortLabel: 'Possedute prima' },
  { k: 'stock', label: 'Scorte', cls: 'c-stock', sortLabel: 'Scorte' },
  { k: 'name', label: 'Formato', cls: 'c-name', sortLabel: 'Formato' },
  { k: 'a', label: 'Lato A', cls: 'c-a', sortLabel: 'Lato A' },
  { k: 'b', label: 'Lato B', cls: 'c-b', sortLabel: 'Lato B' },
  { k: 'cat', label: 'Categoria', cls: 'c-cat', sortLabel: 'Categoria' },
  { k: 'price', label: 'Prezzo', cls: 'c-price', sortLabel: 'Prezzo' },
  { k: 'volumi', label: 'Volumi', cls: 'c-vol', sortLabel: 'Volumi' },
  { k: 'notes', label: 'Note WR', cls: 'c-notes', sortLabel: 'Note WR' },
  { k: 'cart', label: 'Azione', cls: 'c-buy', sortLabel: 'Nel carrello' },
];
const SHOWS: [Show, string][] = [
  ['all', 'Tutte'], ['owned', 'Possedute'], ['notowned', 'Non possedute'], ['poche', 'Poche'], ['tante', 'Tante'], ['cart', 'Nel carrello'],
];

interface Props {
  rows: Row[];          // all rows
  visible: Row[];       // filtered + sorted
  st: State;
  filters: Filters;
  sort: Sort;
  onFilters: (f: Filters) => void;
  onSort: (s: Sort) => void;
  onToggleOwned: (id: string) => void;
  onStock: (id: string, v: Stock | '') => void;
  onOpen: (id: string) => void;
  onBuy: (id: string) => void;
  onGoCart: () => void;
}

export function CatalogView(p: Props) {
  const { st, filters, sort } = p;
  const clickHead = (k: SortKey) => p.onSort(sort.key === k ? { key: k, dir: (-sort.dir) as 1 | -1 } : { key: k, dir: 1 });
  return (
    <div>
      <div className="segs" role="group" aria-label="Filtra">
        {SHOWS.map(([k, label]) => (
          <button key={k} className="seg" aria-pressed={filters.show === k} onClick={() => p.onFilters({ ...filters, show: k })}>
            {label} <span className="n">{filterRows(p.rows, st, filters, k).length}</span>
          </button>
        ))}
      </div>
      <section className="card">
        <div className="card-tb">
          <div className="search">
            <IcSearch />
            <input type="search" placeholder="Cerca" aria-label="Cerca formato, volume o misura" value={filters.q}
              onChange={e => p.onFilters({ ...filters, q: e.target.value })} />
          </div>
          <select className="selpill" aria-label="Categoria" value={filters.cat} onChange={e => p.onFilters({ ...filters, cat: e.target.value })}>
            <option value="">Tutte le categorie</option>
            {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="selpill mobile-only" aria-label="Ordina per" value={`${sort.key}:${sort.dir}`}
            onChange={e => { const [k, d] = e.target.value.split(':'); p.onSort({ key: k as SortKey, dir: +d as 1 | -1 }); }}>
            {COLS.flatMap(c => [
              <option key={c.k + 'u'} value={`${c.k}:1`}>{c.sortLabel} ↑</option>,
              <option key={c.k + 'd'} value={`${c.k}:-1`}>{c.sortLabel} ↓</option>,
            ])}
          </select>
          <span className="count">{p.visible.length} di {p.rows.length}</span>
          <span className="spacer" />
          <button className="btn" onClick={p.onGoCart}><IcCart s={16} />Carrello</button>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                {COLS.map(c => {
                  const on = sort.key === c.k;
                  return (
                    <th key={c.k} className={c.cls} aria-sort={on ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
                      <button type="button" title={`Ordina per ${c.sortLabel}`} onClick={() => clickHead(c.k)}>
                        {c.label}<span className="arr">{on ? (sort.dir > 0 ? <IcUp /> : <IcDown />) : <IcSort />}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {p.visible.length ? p.visible.map(r => (
                <CatalogRow key={r.id} r={r} owned={!!st.owned[r.id]} stock={st.stock[r.id] ?? ''} qty={st.cart[r.id]?.qty ?? 0}
                  onToggleOwned={p.onToggleOwned} onStock={p.onStock} onOpen={p.onOpen} onBuy={p.onBuy} />
              )) : (
                <tr><td colSpan={10}><div className="empty-state"><b>Nessun formato</b>Nessuna busta corrisponde ai filtri.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

interface RowProps {
  r: Row; owned: boolean; stock: Stock | ''; qty: number;
  onToggleOwned: (id: string) => void; onStock: (id: string, v: Stock | '') => void; onOpen: (id: string) => void; onBuy: (id: string) => void;
}
export function CatalogRow({ r, owned, stock, qty, onToggleOwned, onStock, onOpen, onBuy }: RowProps) {
  return (
    <tr data-id={r.id}>
      <td className="c-own">
        <button className="sw" role="switch" aria-checked={owned} aria-label={`Ce l’ho: ${r.name}`} onClick={() => onToggleOwned(r.id)} />
      </td>
      <td className="c-stock">
        <select className={`ssel ${stock || 'none'}`} aria-label={`Scorte di ${r.name}`} value={stock}
          onChange={e => onStock(r.id, e.target.value as Stock | '')}>
          <option value="">—</option>
          <option value="poche">{STOCK_LABEL.poche}</option>
          <option value="tante">{STOCK_LABEL.tante}</option>
        </select>
      </td>
      <td className="c-name">
        <button className="namebtn" onClick={() => onOpen(r.id)}>
          <span>
            <span className="nm">{r.name}</span>
            {r.removed && <span className="tag">non più su WR</span>}
            {r.source === 'manuale' && <span className="tag grey">non WR</span>}
          </span>
        </button>
      </td>
      <td className="c-a">{r.a ?? '—'}</td>
      <td className="c-b">{r.b ?? '—'}</td>
      <td className="c-cat">{CATS[r.cat] ?? r.cat}</td>
      <td className="c-price">
        <span className="dims-m">{dimsOf(r)} ·</span>{eur(r.price)}{r.pack ? <small>/{r.pack} pz</small> : null}
      </td>
      <td className={'c-vol' + (r.volumi ? '' : ' empty')}>
        <span className="ell" title={r.volumi}>{r.volumi || <span style={{ color: 'var(--faint)' }}>—</span>}</span>
      </td>
      <td className="c-notes"><span className="ell" title={r.notes}>{r.notes || '—'}</span></td>
      <td className="c-buy">
        <button className={'buy' + (qty ? ' in' : '')} onClick={() => onBuy(r.id)}>{qty ? qty.toLocaleString('it-IT') + ' pz' : 'Compra'}</button>
      </td>
    </tr>
  );
}
