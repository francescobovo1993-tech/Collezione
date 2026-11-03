import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BuyModal } from './components/BuyModal';
import { CartView } from './components/CartView';
import { CatalogView } from './components/CatalogView';
import { DetailModal } from './components/DetailModal';
import { IcCart, IcGear, IcList, IcMenu, IcRefresh, IcX, Logo } from './components/icons';
import { LogView } from './components/LogView';
import { DEFAULT_COPY, type CopyOpts } from './lib/cart';
import { GITHUB_REPO, STOCK_LABEL, WR_URL } from './lib/constants';
import { fmtDate } from './lib/format';
import { DEFAULT_SORT, filterRows, sortRows, toRows, type Filters, type Sort } from './lib/rows';
import {
  addPoche, clearCart, emptyState, removeFromCart, setCartQty, setStock, toggleOwned,
  type StateStore,
} from './lib/state';
import { LoginModal, PasswordModal, type AuthApi } from './components/AuthModals';
import { csvToState, stateToCsv } from './lib/csv';
import type { SyncInfo } from './lib/sync';
import type { Catalog, ChangelogEntry, State, Stock } from './lib/types';

/** Account + sync controls (SyncedStore). Absent when the build has no Supabase project. */
export interface SyncApi extends AuthApi {
  getInfo(): SyncInfo;
  onInfo(cb: () => void): () => void;
  getVolumi(): Record<string, string>;
  onVolumi(cb: () => void): () => void;
  saveVolumi(id: string, text: string): Promise<void>;
  setPassword(password: string): Promise<void>;
  endRecovery(): void;
  signOut(): Promise<void>;
}
const NO_SYNC: SyncInfo = { status: 'local', account: null, error: '', recovery: false, editor: false };
const NO_VOLUMI: Record<string, string> = {};
const noopSub = () => () => {};

export interface AppData { catalog: Catalog; volumi: Record<string, string>; changelog: ChangelogEntry[] }
type View = 'catalog' | 'cart' | 'log';
type Overlay = { kind: 'detail'; id: string } | { kind: 'buy'; id: string } | { kind: 'login' } | { kind: 'password' } | null;
const TITLES: Record<View, string> = { catalog: 'Catalogo buste', cart: 'Carrello', log: 'Aggiornamenti WR' };

export function App({ data, store, sync, repo = GITHUB_REPO }: { data: AppData; store: StateStore; sync?: SyncApi; repo?: string }) {
  const [st, setSt] = useState<State>(() => store.load() ?? emptyState());
  const info = useSyncExternalStore(sync?.onInfo ?? noopSub, sync?.getInfo ?? (() => NO_SYNC));
  const sharedVolumi = useSyncExternalStore(sync?.onVolumi ?? noopSub, sync?.getVolumi ?? (() => NO_VOLUMI));
  // State that arrives on its own (another device, first sign-in) replaces what's on screen.
  useEffect(() => store.subscribe?.(s => setSt(s)), [store]);
  const [view, setView] = useState<View>('catalog');
  const [filters, setFilters] = useState<Filters>({ q: '', show: 'all' });
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

  const rows = useMemo(() => toRows(data.catalog, data.volumi, sharedVolumi), [data, sharedVolumi]);
  const byId = useMemo(() => new Map(rows.map(r => [r.id, r])), [rows]);
  const visible = useMemo(() => sortRows(filterRows(rows, st, filters), st, sort), [rows, st, filters, sort]);

  const [menuOpen, setMenuOpen] = useState(false);
  const go = (v: View) => { setView(v); setOverlay(null); setMenuOpen(false); window.scrollTo?.(0, 0); };
  const onToggleOwned = useCallback((id: string) => update(s => toggleOwned(s, id)), [update]);
  const onStock = useCallback((id: string, v: Stock | '') => {
    update(s => setStock(s, id, v));
    toast(`${byId.get(id)?.name ?? id}: ${STOCK_LABEL[v]}`);
  }, [update, toast, byId]);

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const r = csvToState(await file.text(), rows);
      update(() => r.state);
      toast(`Importati ${r.matched} formati` + (r.unknown.length ? `; ${r.unknown.length} righe non riconosciute.` : '.'));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'File non valido: serve un CSV esportato da questa app.');
    }
  };
  const exportFile = () => {
    const url = URL.createObjectURL(new Blob([stateToCsv(rows, st)], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `buste-wr-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const active = rows.filter(r => !r.removed).length;
  const ownedN = Object.keys(st.owned).filter(id => byId.has(id)).length;
  const pocheN = Object.entries(st.stock).filter(([id, v]) => v === 'poche' && byId.has(id)).length;
  const cartItems = Object.values(st.cart).filter(c => c.qty > 0);
  const cartPcs = cartItems.reduce((s, c) => s + c.qty, 0);


  const foot = (
    <>
      Fonte: <a href={WR_URL} target="_blank" rel="noopener" style={{ color: 'inherit' }}>wrbuste.it</a>
      {data.changelog[0] && <><br />Catalogo aggiornato il {fmtDate(data.changelog[0].at)}</>}
      <br /><SyncLine info={info} enabled={!!sync} />
    </>
  );
  const ov = (overlay?.kind === 'detail' || overlay?.kind === 'buy') ? byId.get(overlay.id) : undefined;
  return (
    <div className="app">
      <aside className="side">
        <button className="burger" aria-label="Apri menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><IcMenu /></button>
        <div className="brand"><Logo /><div><b>Buste WR</b><span>Catalogo personale</span></div></div>
        <nav className="nav" aria-label="Sezioni">
          <NavItems view={view} go={go} cartCount={cartItems.length} />
        </nav>
        <div className="nav nav-extra">
          <div className="sep" />
          <Settings onExport={exportFile} onImport={importFile} sync={sync} info={info}
            onLogin={() => setOverlay({ kind: 'login' })} onPassword={() => setOverlay({ kind: 'password' })} />
        </div>
        <div className="side-foot">{foot}</div>
      </aside>
      {menuOpen && (
        <MobileMenu onClose={() => setMenuOpen(false)} foot={foot}>
          <NavItems view={view} go={go} cartCount={cartItems.length} />
        </MobileMenu>
      )}

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
            onOpen={id => setOverlay({ kind: 'detail', id })} onBuy={id => setOverlay({ kind: 'buy', id })} />
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
        <DetailModal r={ov} owned={!!st.owned[ov.id]} stock={st.stock[ov.id] ?? ''} qty={st.cart[ov.id]?.qty ?? 0}
          volumiEdit={!sync ? { kind: 'off' } : !info.account ? { kind: 'signin', onSignIn: () => setOverlay({ kind: 'login' }) }
            : !info.editor ? { kind: 'readonly' }
            : { kind: 'edit', save: async t => { await sync.saveVolumi(ov.id, t); toast('Volumi salvati per tutti.'); } }}
          onClose={() => setOverlay(null)} onToggleOwned={() => onToggleOwned(ov.id)}
          onStock={v => update(s => setStock(s, ov.id, v))} onBuy={() => setOverlay({ kind: 'buy', id: ov.id })} />
      )}
      {overlay?.kind === 'buy' && ov && (
        <BuyModal key={ov.id} r={ov} qty={st.cart[ov.id]?.qty ?? 0} onClose={() => setOverlay(null)}
          onSave={q => { update(s => setCartQty(s, ov.id, q)); setOverlay(null); toast(`${q} × ${ov.name} nel carrello.`); }}
          onRemove={() => { update(s => removeFromCart(s, ov.id)); setOverlay(null); toast('Tolto dal carrello.'); }} />
      )}
      {sync && overlay?.kind === 'login' && !info.account && <LoginModal api={sync} toast={toast} onClose={() => setOverlay(null)} />}
      {sync && info.account && (info.recovery || overlay?.kind === 'password') && (
        <PasswordModal email={info.account.email} recovery={info.recovery} toast={toast} onSave={sync.setPassword}
          onClose={() => { sync.endRecovery(); setOverlay(null); }} />
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

function Settings({ onExport, onImport, sync, info, onLogin, onPassword }: {
  onExport: () => void; onImport: (f: File | undefined) => void; sync?: SyncApi; info: SyncInfo;
  onLogin: () => void; onPassword: () => void;
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
      <button aria-label="Impostazioni" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(o => !o)} style={{ width: '100%' }}>
        {info.account ? <span className="avatar" aria-hidden="true">{initials(info.account.name || info.account.email)}</span> : <IcGear />}
        <span className="lbl">Impostazioni</span>
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
              <button role="menuitem" onClick={() => { setOpen(false); onPassword(); }}>Imposta password</button>
              <button role="menuitem" onClick={() => { setOpen(false); void sync.signOut(); }}>Esci</button>
            </>
          ) : (
            <button role="menuitem" onClick={() => { setOpen(false); onLogin(); }}>Accedi o crea un account</button>
          ))}
          {sync && <div className="menu-sep" />}
          <button role="menuitem" onClick={() => { setOpen(false); onExport(); }}>Esporta CSV</button>
          <label role="menuitem">Importa CSV
            <input className="vis-hidden" type="file" accept=".csv,text/csv"
              onChange={e => { setOpen(false); onImport(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
      )}
    </div>
  );
}

const initials = (s: string) =>
  s.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';

function NavItems({ view, go, cartCount }: { view: View; go: (v: View) => void; cartCount: number }) {
  return (
    <>
      <button data-view="catalog" aria-current={view === 'catalog' ? 'page' : undefined} onClick={() => go('catalog')}><IcList /><span className="lbl">Catalogo</span></button>
      <button data-view="cart" aria-current={view === 'cart' ? 'page' : undefined} onClick={() => go('cart')}>
        <IcCart /><span className="lbl">Carrello</span>{cartCount > 0 && <span className="badge">{cartCount}</span>}
      </button>
      <button data-view="log" aria-current={view === 'log' ? 'page' : undefined} onClick={() => go('log')}><IcRefresh /><span className="lbl">Aggiornamenti</span></button>
    </>
  );
}

/** Mobile: full-screen menu opened by the burger, like Revolut's back office. */
function MobileMenu({ onClose, foot, children }: { onClose: () => void; foot: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div ref={ref} className="mnav" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="mnav-top">
        <button className="mx" aria-label="Chiudi menu" onClick={onClose}><IcX /></button>
        <div className="brand"><Logo /><div><b>Buste WR</b><span>Catalogo personale</span></div></div>
      </div>
      <nav className="nav mnav-list" aria-label="Sezioni">{children}</nav>
      <div className="mnav-foot">{foot}</div>
    </div>
  );
}
