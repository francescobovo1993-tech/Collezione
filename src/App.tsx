import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BuyModal } from './components/BuyModal';
import { CartView } from './components/CartView';
import { CatalogView } from './components/CatalogView';
import { DetailModal } from './components/DetailModal';
import { IcCart, IcGear, IcList, IcRefresh, Logo } from './components/icons';
import { LogView } from './components/LogView';
import { DEFAULT_COPY, type CopyOpts } from './lib/cart';
import { GITHUB_REPO, STOCK_LABEL, WR_URL } from './lib/constants';
import { fmtDate } from './lib/format';
import { DEFAULT_SORT, filterRows, sortRows, toRows, type Filters, type Sort } from './lib/rows';
import {
  addPoche, clearCart, emptyState, exportState, importFromSheet, normState, removeFromCart, setCartQty, setStock, toggleOwned,
  type StateStore, type Who,
} from './lib/state';
import type { SyncInfo } from './lib/sync';
import type { Catalog, ChangelogEntry, SheetSeed, State, Stock } from './lib/types';

/** Account + sync controls (SyncedStore). Absent when the build has no Supabase project. */
export interface SyncApi {
  getInfo(): SyncInfo;
  onInfo(cb: () => void): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}
const NO_SYNC: SyncInfo = { status: 'local', account: null, error: '' };
const noopSub = () => () => {};

export interface AppData { catalog: Catalog; volumi: Record<string, string>; sheet: SheetSeed; changelog: ChangelogEntry[] }
type View = 'catalog' | 'cart' | 'log';
type Overlay = { kind: 'detail'; id: string } | { kind: 'buy'; id: string } | null;
const TITLES: Record<View, string> = { catalog: 'Catalogo buste', cart: 'Carrello', log: 'Aggiornamenti WR' };

export function App({ data, store, sync, repo = GITHUB_REPO }: { data: AppData; store: StateStore; sync?: SyncApi; repo?: string }) {
  const [st, setSt] = useState<State>(() => store.load() ?? emptyState());
  const info = useSyncExternalStore(sync?.onInfo ?? noopSub, sync?.getInfo ?? (() => NO_SYNC));
  // State that arrives on its own (another device, first sign-in) replaces what's on screen.
  useEffect(() => store.subscribe?.(s => setSt(s)), [store]);
  const [view, setView] = useState<View>('catalog');
  const [filters, setFilters] = useState<Filters>({ q: '', show: 'all', cat: '' });
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [copy, setCopy] = useState<CopyOpts>(DEFAULT_COPY);
  const [toastMsg, setToastMsg] = useState('');
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastMsg(''), 3000);
  }, []);
  useEffect(() => {
    if (!sync) return;
    let last = sync.getInfo().status;
    return sync.onInfo(() => {
      const now = sync.getInfo().status;
      if (now === 'error' && last !== 'error') toast('Non riesco a sincronizzare: le modifiche restano in questo browser.');
      last = now;
    });
  }, [sync, toast]);

  /** The only way to change personal state: a pure function from old state to a new object. */
  const update = useCallback((fn: (s: State) => State) => {
    setSt(prev => {
      const next = fn(prev);
      store.save(next);
      return next;
    });
  }, [store]);

  const rows = useMemo(() => toRows(data.catalog, data.volumi), [data]);
  const byId = useMemo(() => new Map(rows.map(r => [r.id, r])), [rows]);
  const visible = useMemo(() => sortRows(filterRows(rows, st, filters), st, sort), [rows, st, filters, sort]);

  const go = (v: View) => { setView(v); setOverlay(null); window.scrollTo?.(0, 0); };
  const onToggleOwned = useCallback((id: string) => update(s => toggleOwned(s, id)), [update]);
  const onStock = useCallback((id: string, v: Stock | '') => {
    update(s => setStock(s, id, v));
    toast(`${byId.get(id)?.name ?? id}: ${STOCK_LABEL[v]}`);
  }, [update, toast, byId]);

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      if (!raw || typeof raw !== 'object' || !('owned' in raw || 'stock' in raw || 'cart' in raw)) throw new Error('shape');
      const next = normState(raw);
      update(() => ({ ...next, imported: next.imported ?? 'file' }));
      toast(`Stato importato: ${Object.keys(next.owned).length} possedute, ${Object.keys(next.cart).length} nel carrello.`);
    } catch {
      toast('File non valido: serve un JSON esportato da questa app.');
    }
  };
  const exportFile = () => {
    const url = URL.createObjectURL(new Blob([exportState(st)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `buste-wr-stato-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const doImportSheet = (who: Who) => {
    update(s => importFromSheet(s, who, data.sheet));
    toast(`Buste di ${who === 'bobbi' ? 'Bobbi' : 'Pomo'} importate dal vecchio foglio.`);
  };

  const active = rows.filter(r => !r.removed).length;
  const ownedN = Object.keys(st.owned).filter(id => byId.has(id)).length;
  const pocheN = Object.entries(st.stock).filter(([id, v]) => v === 'poche' && byId.has(id)).length;
  const cartItems = Object.values(st.cart).filter(c => c.qty > 0);
  const cartPcs = cartItems.reduce((s, c) => s + c.qty, 0);


  const ov = overlay && byId.get(overlay.id);
  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><Logo /><div><b>Buste WR</b><span>Catalogo personale</span></div></div>
        <nav className="nav" aria-label="Sezioni">
          <button data-view="catalog" aria-current={view === 'catalog' ? 'page' : undefined} onClick={() => go('catalog')}><IcList /><span className="lbl">Catalogo</span></button>
          <button data-view="cart" aria-current={view === 'cart' ? 'page' : undefined} onClick={() => go('cart')}>
            <IcCart /><span className="lbl">Carrello</span>{cartItems.length > 0 && <span className="badge">{cartItems.length}</span>}
          </button>
          <button data-view="log" aria-current={view === 'log' ? 'page' : undefined} onClick={() => go('log')}><IcRefresh /><span className="lbl">Aggiornamenti</span></button>
          <div className="sep" />
          <Settings onExport={exportFile} onImport={importFile} onSheet={doImportSheet} sync={sync} info={info} />
        </nav>
        <div className="side-foot">
          Fonte: <a href={WR_URL} target="_blank" rel="noopener" style={{ color: 'inherit' }}>wrbuste.it</a>
          {data.changelog[0] && <><br />Catalogo aggiornato il {fmtDate(data.changelog[0].at)}</>}
          <br /><SyncLine info={info} enabled={!!sync} />
        </div>
      </aside>

      <main className="main">
        <div className="title-row">
          <h1>{TITLES[view]}</h1>
          <div className="stats">
            <span><b>{active}</b> formati</span><span><b>{ownedN}</b> possedute</span><span><b>{pocheN}</b> poche</span>
            <span><b>{cartPcs.toLocaleString('it-IT')}</b> buste nel carrello</span>
          </div>
        </div>
        {view === 'catalog' && (
          <CatalogView rows={rows} visible={visible} st={st} filters={filters} sort={sort}
            onFilters={setFilters} onSort={setSort} onToggleOwned={onToggleOwned} onStock={onStock}
            onOpen={id => setOverlay({ kind: 'detail', id })} onBuy={id => setOverlay({ kind: 'buy', id })} onGoCart={() => go('cart')} />
        )}
        {view === 'cart' && (
          <CartView st={st} byId={byId} copy={copy} onCopyOpts={setCopy} toast={toast} onGoCatalog={() => go('catalog')}
            onQty={(id, q) => update(s => setCartQty(s, id, q))}
            onRemove={id => update(s => removeFromCart(s, id))}
            onAddPoche={() => { const n = addPoche(st, data.catalog).added; update(s => addPoche(s, data.catalog).state); toast(`${n} formati aggiunti al carrello.`); }}
            onClear={() => { update(clearCart); toast('Carrello svuotato.'); }} />
        )}
        {view === 'log' && <LogView log={data.changelog} repo={repo} />}
      </main>

      {overlay?.kind === 'detail' && ov && (
        <DetailModal r={ov} owned={!!st.owned[ov.id]} stock={st.stock[ov.id] ?? ''} qty={st.cart[ov.id]?.qty ?? 0} repo={repo}
          onClose={() => setOverlay(null)} onToggleOwned={() => onToggleOwned(ov.id)}
          onStock={v => update(s => setStock(s, ov.id, v))} onBuy={() => setOverlay({ kind: 'buy', id: ov.id })} />
      )}
      {overlay?.kind === 'buy' && ov && (
        <BuyModal key={ov.id} r={ov} qty={st.cart[ov.id]?.qty ?? 0} onClose={() => setOverlay(null)}
          onSave={q => { update(s => setCartQty(s, ov.id, q)); setOverlay(null); toast(`${q} × ${ov.name} nel carrello.`); }}
          onRemove={() => { update(s => removeFromCart(s, ov.id)); setOverlay(null); toast('Tolto dal carrello.'); }} />
      )}
      <div id="toast" role="status" aria-live="polite" hidden={!toastMsg}>{toastMsg}</div>
    </div>
  );
}

const SYNC_TEXT: Record<SyncInfo['status'], string> = {
  local: 'Le tue spunte sono salvate solo in questo browser.',
  loading: 'Carico le tue spunte…',
  saving: 'Salvataggio…',
  synced: 'Spunte sincronizzate sul tuo account.',
  error: 'Sincronizzazione non riuscita: salvo in questo browser.',
};
function SyncLine({ info, enabled }: { info: SyncInfo; enabled: boolean }) {
  const text = enabled && info.status === 'local' ? 'Le tue spunte sono salvate solo in questo browser. Accedi per sincronizzarle.' : SYNC_TEXT[info.status];
  return <span className={'sync-line ' + info.status} title={info.error || undefined}>{text}</span>;
}

function Settings({ onExport, onImport, onSheet, sync, info }: {
  onExport: () => void; onImport: (f: File | undefined) => void; onSheet: (who: Who) => void; sync?: SyncApi; info: SyncInfo;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="settings" ref={ref}>
      <button aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(o => !o)} style={{ width: '100%' }}>
        <IcGear /><span className="lbl">Impostazioni</span>
        {sync && info.account && <span className={'sync-dot ' + info.status} aria-label={SYNC_TEXT[info.status]} />}
      </button>
      {open && (
        <div className="menu anchored" role="menu">
          {sync && (info.account ? (
            <>
              <div className="menu-account">
                <b>{info.account.name}</b>
                <span>{info.account.email}</span>
                <span className={'sync-line ' + info.status}>{SYNC_TEXT[info.status]}</span>
              </div>
              <button role="menuitem" onClick={() => { setOpen(false); void sync.signOut(); }}>Esci</button>
            </>
          ) : (
            <button role="menuitem" onClick={() => { setOpen(false); void sync.signIn(); }}><GoogleG />Accedi con Google</button>
          ))}
          {sync && <div className="menu-sep" />}
          <button role="menuitem" onClick={() => { setOpen(false); onExport(); }}>Esporta stato (JSON)</button>
          <label role="menuitem">Importa stato (JSON)
            <input className="vis-hidden" type="file" accept="application/json,.json"
              onChange={e => { setOpen(false); onImport(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <div className="menu-sep" />
          <button role="menuitem" onClick={() => { setOpen(false); onSheet('bobbi'); }}>Importa dal vecchio foglio: Bobbi</button>
          <button role="menuitem" onClick={() => { setOpen(false); onSheet('pomo'); }}>Importa dal vecchio foglio: Pomo</button>
        </div>
      )}
    </div>
  );
}

const GoogleG = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);
