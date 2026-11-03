import { useEffect, useRef, useState } from 'react';
import { estimate } from '../lib/cart';
import { dimsOf, eur } from '../lib/format';
import type { Row } from '../lib/types';
import { Modal } from './Modal';

interface Props { r: Row; qty: number; onClose: () => void; onSave: (qty: number) => void; onRemove: () => void }

export function BuyModal({ r, qty: inCart, onClose, onSave, onRemove }: Props) {
  const pack = r.pack || 100;
  const [qty, setQty] = useState<number>(inCart || pack);
  const [err, setErr] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  const est = estimate(qty, pack, r.price);
  return (
    <Modal labelledBy="buyTitle" onClose={onClose}>
      <h2 id="buyTitle">Quante buste?</h2>
      <p className="sub">{r.name}{dimsOf(r) ? ' · ' + dimsOf(r) : ''}</p>
      <form onSubmit={e => { e.preventDefault(); if (qty < 1) { setErr('Inserisci almeno 1 busta.'); return; } onSave(qty); }}>
        <div className="field">
          <label htmlFor="buyqty">Pezzi</label>
          <input ref={input} id="buyqty" type="number" inputMode="numeric" min={1} step={1} value={qty || ''}
            onChange={e => { setErr(''); setQty(Math.max(0, Math.round(+e.target.value || 0))); }} />
        </div>
        <div className="helper">
          <span>Confezioni da {pack} pz{r.price != null ? ` · ${eur(r.price)} l’una` : ''}</span>
          <span>≈ {est != null ? eur(est) : '—'}</span>
        </div>
        {err && <div className="warn" role="alert" style={{ color: 'var(--red)' }}>{err}</div>}
        <div className="quick">
          {[1, 2, 3, 5].map(n => (
            <button key={n} type="button" className="opt" aria-pressed={qty === n * pack} onClick={() => setQty(n * pack)}>{n * pack}</button>
          ))}
        </div>
        <div className="actions">
          <button className="btn primary" type="submit">{inCart ? 'Aggiorna carrello' : 'Aggiungi al carrello'}</button>
          {inCart > 0 && <button type="button" className="btn danger" onClick={onRemove}>Togli dal carrello</button>}
        </div>
      </form>
    </Modal>
  );
}
