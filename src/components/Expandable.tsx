import { useEffect, useRef, useState } from 'react';

/**
 * Long text clamped to a few lines, with "Mostra di più / Mostra di meno" (Revolut "Show more").
 * The link only appears when the text is actually cut.
 */
export function Expandable({ text, lines, className = '' }: { text: string; lines: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || open || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setCut(el.scrollHeight > el.clientHeight + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, lines, open]);
  return (
    <span className={'xp ' + className}>
      <span ref={ref} className={open ? 'xp-t' : 'xp-t clamp'} style={{ WebkitLineClamp: lines }}>{text}</span>
      {(cut || open) && (
        <button type="button" className="more" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          {open ? 'Mostra di meno' : 'Mostra di più'}
        </button>
      )}
    </span>
  );
}
