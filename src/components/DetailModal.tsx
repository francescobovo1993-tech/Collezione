import { CATS, STOCK_LABEL, volumiEditUrl } from '../lib/constants';
import { dimsOf, eur } from '../lib/format';
import type { Row, Stock } from '../lib/types';
import { BagIcon, IcEdit } from './icons';
import { Modal } from './Modal';

interface Props {
  r: Row; owned: boolean; stock: Stock | ''; qty: number; repo: string;
  onClose: () => void; onToggleOwned: () => void; onStock: (v: Stock | '') => void; onBuy: () => void;
}

export function DetailModal({ r, owned, stock, qty, repo, onClose, onToggleOwned, onStock, onBuy }: Props) {
  const editUrl = volumiEditUrl(repo);
  const Info = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <div className="rowi"><span className="k">{k}</span><span className="v">{children}</span></div>
  );
  return (
    <Modal labelledBy="detTitle" wide onClose={onClose}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 6 }}>
        <BagIcon a={r.a} b={r.b} big />
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
        <div className="rowi">
          <span className="k">Volumi</span>
          <span className="v">
            {r.volumi || 'Nessun volume annotato'}
            {editUrl && <><br /><a className="ghlink" href={editUrl} target="_blank" rel="noopener"><IcEdit />Modifica su GitHub</a></>}
          </span>
        </div>
      </div>

      <div className="group-label">Informazioni WR</div>
      <div className="group">
        <Info k="Misure">{dimsOf(r) || 'Non indicate'}</Info>
        <Info k="Prezzo">{eur(r.price)}{r.pack ? ` per ${r.pack} pz` : ''}</Info>
        <Info k="Materiale">{r.material || '—'}</Info>
        <div className="rowi stack"><span className="k">Note WR</span><span className="v">{r.notes || '—'}</span></div>
      </div>
    </Modal>
  );
}
