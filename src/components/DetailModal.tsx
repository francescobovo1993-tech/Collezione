import { useState } from 'react';
import { CATS, STOCK_LABEL } from '../lib/constants';
import { dimsOf, eur } from '../lib/format';
import type { Row, Stock } from '../lib/types';
import { IcEdit } from './icons';
import { Modal } from './Modal';

/** What the Volumi row allows: edit, ask to sign in, read only, or nothing (sync not set up). */
export type VolumiEdit =
  | { kind: 'edit'; save: (text: string) => Promise<void> }
  | { kind: 'signin'; onSignIn: () => void }
  | { kind: 'readonly' }
  | { kind: 'off' };

interface Props {
  r: Row; owned: boolean; stock: Stock | ''; qty: number; volumiEdit: VolumiEdit;
  onClose: () => void; onToggleOwned: () => void; onStock: (v: Stock | '') => void; onBuy: () => void;
}

const Info = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="rowi"><span className="k">{k}</span><span className="v">{children}</span></div>
);

export function DetailModal({ r, owned, stock, qty, volumiEdit, onClose, onToggleOwned, onStock, onBuy }: Props) {
  return (
    <Modal labelledBy="detTitle" wide onClose={onClose}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 6 }}>
        <div>
          <h2 id="detTitle" style={{ margin: 0 }}>{r.name}</h2>
          <p className="sub" style={{ margin: 0 }}>
            {CATS[r.cat] ?? r.cat}
            {r.removed && <> · <span style={{ color: 'var(--red)' }}>non più su WR</span></>}
            {r.source === 'manuale' && <> · non WR</>}
          </p>
        </div>
      </div>
      <div className="actions" style={{ margin: '12px 0 4px' }}>
        <button className={'btn' + (qty ? '' : ' primary')} onClick={onBuy}>{qty ? `Nel carrello: ${qty} pz` : 'Compra'}</button>
      </div>

      <div className="group-label">La mia collezione</div>
      <div className="group">
        <div className="rowi" style={{ alignItems: 'center' }}>
          <span className="k">Ce l’ho</span>
          <button className="sw" role="switch" aria-checked={owned} aria-label="Ce l’ho" onClick={onToggleOwned} />
        </div>
        <div className="rowi" style={{ alignItems: 'center' }}>
          <span className="k">Scorte</span>
          <span className="opts" style={{ margin: 0 }}>
            {(['poche', 'tante', ''] as const).map(v => (
              <button key={v || 'none'} className="opt" aria-pressed={stock === v} onClick={() => onStock(v)}>{STOCK_LABEL[v]}</button>
            ))}
          </span>
        </div>
        <VolumiRow key={r.id} text={r.volumi} edit={volumiEdit} />
      </div>

      <div className="group-label">Informazioni WR</div>
      <div className="group">
        <Info k="Misure">{dimsOf(r) || 'Non indicate'}</Info>
        <Info k="Prezzo">{eur(r.price)}{r.pack ? ` per ${r.pack} pz` : ''}</Info>
        <div className="rowi stack"><span className="k">Note WR</span><span className="v">{r.notes || '—'}</span></div>
      </div>
    </Modal>
  );
}

function VolumiRow({ text, edit }: { text: string; edit: VolumiEdit }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (draft != null && edit.kind === 'edit') {
    const save = async () => {
      setBusy(true); setError('');
      try { await edit.save(draft); setDraft(null); }
      catch (e) { setError(e instanceof Error ? e.message : String(e)); }
      finally { setBusy(false); }
    };
    return (
      <div className="rowi stack">
        <div className="field" style={{ width: '100%' }}>
          <label htmlFor="voltext">Volumi che entrano in questa busta (visibili a tutti)</label>
          <textarea id="voltext" rows={4} autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save(); }} />
        </div>
        {error && <div className="form-msg err" role="alert">{error}</div>}
        <div className="actions" style={{ marginTop: 8 }}>
          <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Salvo…' : 'Salva'}</button>
          <button className="btn" disabled={busy} onClick={() => { setDraft(null); setError(''); }}>Annulla</button>
        </div>
      </div>
    );
  }
  return (
    <div className="rowi">
      <span className="k">Volumi</span>
      <span className="v">
        {text || 'Nessun volume annotato'}
        {edit.kind === 'edit' && <><br /><button className="btn link ghlink" onClick={() => setDraft(text)}><IcEdit />Modifica</button></>}
        {edit.kind === 'signin' && <><br /><button className="btn link ghlink" onClick={edit.onSignIn}>Accedi per modificarli</button></>}
        {edit.kind === 'readonly' && <><br /><small className="hint">Solo gli editor possono modificarli.</small></>}
      </span>
    </div>
  );
}
