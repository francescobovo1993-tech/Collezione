import { useMemo, useRef, useState } from 'react';
import { cartLines, cartText, estOf, packsOf, type CopyOpts } from '../lib/cart';
import { dimsOf, eur } from '../lib/format';
import type { Row, State } from '../lib/types';
import { IcRight } from './icons';

interface Props {
  st: State; byId: Map<string, Row>; copy: CopyOpts;
  onCopyOpts: (o: CopyOpts) => void; onQty: (id: string, q: number) => void; onRemove: (id: string) => void;
  onAddPoche: () => void; onClear: () => void; onGoCatalog: () => void; toast: (m: string) => void;
}

export function CartView({ st, byId, copy, onCopyOpts, onQty, onRemove, onAddPoche, onClear, onGoCatalog, toast }: Props) {
  const [confirm, setConfirm] = useState(false);
  const msg = useRef<HTMLTextAreaElement>(null);
  const ls = useMemo(() => cartLines(st, byId), [st, byId]);
  const text = cartText(ls, copy);
  const poche = Object.entries(st.stock).filter(([id, v]) => v === 'poche' && byId.has(id) && !st.cart[id]).length;
  const tot = ls.reduce((s, l) => s + (estOf(l) || 0), 0);
  const pcs = ls.reduce((s, l) => s + l.qty, 0);

  const addPoche = poche > 0 && (
    <div className="group">
      <button className="choice" onClick={onAddPoche}>
        <span className="t"><b>Aggiungi le buste «Poche»</b><span>{poche} formati in esaurimento non ancora nel carrello</span></span>
        <span className="chev"><IcRight /></span>
      </button>
    </div>
  );

  if (!ls.length) {
    return (
      <div className="cart-grid one">
        <section className="card cart-list">
          {addPoche}
          <div className="empty-state">
            <b>Carrello vuoto</b>Premi «Compra» su un formato del catalogo per aggiungerlo.
            <div className="actions" style={{ justifyContent: 'center' }}><button className="btn dark" onClick={onGoCatalog}>Vai al catalogo</button></div>
          </div>
        </section>
      </div>
    );
  }

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Lista copiata. Incollala nel messaggio al rivenditore.');
    } catch {
      msg.current?.focus();
      msg.current?.select();
      toast('Testo selezionato: premi Ctrl/Cmd+C per copiarlo.');
    }
  };
  const opt = (k: keyof CopyOpts, label: string) => (
    <button className="opt" aria-pressed={copy[k]} onClick={() => onCopyOpts({ ...copy, [k]: !copy[k] })}>{label}</button>
  );

  return (
    <div className="cart-grid">
      <section className="card cart-list">
        {addPoche}
        <div className="group-label" style={{ marginTop: 4 }}>Da comprare</div>
        <div className="group">
          {ls.map(l => (
            <div className="ci" key={l.id} data-id={l.id}>
              <span className="n">{l.r.name}</span>
              <div className="p">
                <div className="q">
                  <QtyInput value={l.qty} label={`Pezzi di ${l.r.name}`} onCommit={q => onQty(l.id, q)} />
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>pz</span>
                </div>
                <button className="rm" onClick={() => onRemove(l.id)}>Rimuovi</button>
              </div>
              <span className="d">{dimsOf(l.r)}{dimsOf(l.r) ? ' · ' : ''}{packsOf(l)} conf. · ≈ {eur(estOf(l))}</span>
            </div>
          ))}
        </div>
      </section>
      <aside className="card cart-sum">
        <div className="group-label" style={{ marginTop: 0 }}>Riepilogo</div>
        <div className="group">
          <div className="rowi"><span className="k">Formati</span><span className="v num">{ls.length}</span></div>
          <div className="rowi"><span className="k">Buste</span><span className="v num">{pcs.toLocaleString('it-IT')}</span></div>
          <div className="rowi"><span className="k">Stima a listino WR</span><span className="v num" style={{ color: 'var(--ink)', fontWeight: 600 }}>{eur(tot)}</span></div>
        </div>
        <p className="sub" style={{ fontSize: 13, margin: '-6px 4px 0' }}>Confezioni intere. I rivenditori possono avere prezzi diversi.</p>
        <div className="group-label">Messaggio per il rivenditore</div>
        <div className="opts" role="group" aria-label="Contenuto del messaggio">
          {opt('dims', 'Misure')}{opt('prices', 'Prezzi stimati')}{opt('greet', 'Saluti')}
        </div>
        <div className="field">
          <label htmlFor="msg">Testo da incollare</label>
          <textarea ref={msg} id="msg" readOnly rows={9} value={text} onFocus={e => e.target.select()} />
        </div>
        <div className="actions">
          <button className="btn primary" onClick={doCopy}>Copia lista</button>
          {confirm ? (
            <span className="confirm">Svuotare?
              <button className="btn danger" onClick={() => { setConfirm(false); onClear(); }}>Svuota</button>
              <button className="btn" onClick={() => setConfirm(false)}>Annulla</button>
            </span>
          ) : <button className="btn" onClick={() => setConfirm(true)}>Svuota carrello</button>}
        </div>
      </aside>
    </div>
  );
}

/** Number field that commits on blur/Enter, so typing "150" doesn't pass through 1 and 15. */
function QtyInput({ value, label, onCommit }: { value: number; label: string; onCommit: (q: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => { if (draft != null) { onCommit(Math.round(+draft || 0)); setDraft(null); } };
  return (
    <input type="number" min={1} step={1} aria-label={label} value={draft ?? String(value)}
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); }} />
  );
}
