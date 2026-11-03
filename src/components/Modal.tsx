import { useEffect, useRef } from 'react';
import { IcX } from './icons';

export function Modal({ labelledBy, wide, onClose, children }: { labelledBy: string; wide?: boolean; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    if (!ref.current?.contains(document.activeElement)) ref.current?.querySelector<HTMLElement>('.mx')?.focus();
    return () => prev?.focus?.();
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div ref={ref} className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <button className="mx" aria-label="Chiudi" onClick={onClose}><IcX /></button>
        {children}
      </div>
    </>
  );
}
