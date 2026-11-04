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

/**
 * Desktop table cells: text clamped to a few lines; hovering (or focusing with Tab) shows the full
 * text in a floating card. The card is position:fixed so the scrolling table can't clip it.
 */
export function HoverText({ text, lines }: { text: string; lines: number }) {
  const [cut, setCut] = useState(false);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setCut(el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, lines]);
  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [pos]);
  const show = () => {
    const el = ref.current;
    if (!el || !cut) return;
    if (typeof matchMedia === 'function' && !matchMedia('(hover: hover)').matches) return; // touch: no hover cards
    const r = el.getBoundingClientRect();
    const width = Math.min(380, Math.max(r.width + 24, 280));
    const left = Math.max(8, Math.min(r.left - 12, innerWidth - width - 8));
    setPos(r.bottom + 220 < innerHeight ? { left, top: r.bottom + 6, width } : { left, bottom: innerHeight - r.top + 6, width });
  };
  return (
    <span className={'hv' + (cut ? ' cut' : '')} tabIndex={cut ? 0 : undefined}
      onMouseEnter={show} onMouseLeave={() => setPos(null)} onFocus={show} onBlur={() => setPos(null)}>
      <span ref={ref} className="xp-t clamp" style={{ WebkitLineClamp: lines }}>{text}</span>
      {pos && <span className="hv-card" role="tooltip" style={pos}>{text}</span>}
    </span>
  );
}
