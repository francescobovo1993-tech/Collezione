import { useEffect, useRef, useState } from 'react';
import { IcX } from './icons';

/**
 * Revolut-style filter sheet: full screen on mobile, close button top-left, big title that
 * shrinks into the header on scroll, sticky action button at the bottom.
 */
export function FullSheet({ title, action, onAction, onClose, children }: {
  title: string; action: string; onAction: () => void; onClose: () => void; children: React.ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('.xbtn')?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('keydown', k); prev?.focus?.(); };
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div ref={ref} className="fsheet" role="dialog" aria-modal="true" aria-labelledby="fsheetTitle">
        <div className={'fsheet-head' + (scrolled ? ' scrolled' : '')}>
          <button className="xbtn" aria-label="Chiudi" onClick={onClose}><IcX /></button>
          <span className="fsheet-mini" aria-hidden="true">{title}</span>
        </div>
        <div className="fsheet-body" onScroll={e => setScrolled(e.currentTarget.scrollTop > 36)}>
          <h2 id="fsheetTitle">{title}</h2>
          {children}
        </div>
        <div className="fsheet-foot">
          <button className="btn primary wide" onClick={onAction}>{action}</button>
        </div>
      </div>
    </>
  );
}

/** A section like "Property types · 17": label, rows with a radio on the left, "Mostra tutto" when long. */
export function RadioSection<T extends string | number>({ label, options, value, onChange, collapsedCount }: {
  label: string; options: { value: T; label: string; hint?: string }[]; value: T; onChange: (v: T) => void; collapsedCount?: number;
}) {
  const selectedIdx = options.findIndex(o => o.value === value);
  const [all, setAll] = useState(!collapsedCount || selectedIdx >= collapsedCount);
  const shown = all || !collapsedCount ? options : options.slice(0, collapsedCount);
  return (
    <section className="fsec">
      <div className="fsec-label">{label} <span>· {options.length}</span></div>
      <div className="fgroup" role="radiogroup" aria-label={label}>
        {shown.map(o => (
          <button key={String(o.value)} className="frow" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>
            <span className="radio" aria-hidden="true" />
            <span className="frow-t">{o.label}{o.hint && <small>{o.hint}</small>}</span>
          </button>
        ))}
        {!all && collapsedCount && options.length > collapsedCount && (
          <button className="fmore" onClick={() => setAll(true)}>Mostra tutto</button>
        )}
      </div>
    </section>
  );
}
