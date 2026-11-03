import { useEffect, useRef, useState } from 'react';

/** Revolut-style bottom sheet: grab handle, centered title; drag down, tap outside or Esc to close. */
export function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    (ref.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? ref.current?.querySelector<HTMLElement>('.grab'))?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('keydown', k); prev?.focus?.(); };
  }, [onClose]);
  // Drag down from the handle/title area to dismiss.
  const down = (e: React.PointerEvent) => { start.current = e.clientY; setDragging(true); (e.target as Element).setPointerCapture?.(e.pointerId); };
  const move = (e: React.PointerEvent) => { if (start.current != null) setDy(Math.max(0, e.clientY - start.current)); };
  const up = () => { if (start.current == null) return; start.current = null; setDragging(false); if (dy > 90) onClose(); else setDy(0); };
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div ref={ref} className={'bsheet' + (dragging ? ' dragging' : '')} role="dialog" aria-modal="true" aria-labelledby="bsheetTitle"
        style={dy ? { transform: `translateY(${dy}px)` } : undefined}>
        <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ display: 'flex', flexDirection: 'column' }}>
          <button className="grab" aria-label="Chiudi" onClick={onClose} />
          <h2 id="bsheetTitle">{title}</h2>
        </div>
        {children}
      </div>
    </>
  );
}
