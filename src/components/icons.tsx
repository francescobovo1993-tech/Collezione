export const IcList = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" /></svg>;
export const IcCart = ({ s = 18 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={s === 18 ? 2 : 2.2} aria-hidden="true"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" /><circle cx="10" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /></svg>;
export const IcRefresh = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></svg>;
export const IcGear = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
export const IcSearch = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
export const IcRight = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>;
export const IcX = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const IcSort = () => <svg className="si" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4" /></svg>;
export const IcUp = () => <svg className="si" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>;
export const IcDown = () => <svg className="si" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>;
export const IcEdit = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>;
export const Logo = () => (
  <span className="logo" aria-hidden="true">
    <svg width="20" height="22" viewBox="0 0 20 22" fill="none"><rect x="2" y="5" width="16" height="16" rx="2" fill="#fff" fillOpacity=".9" /><path d="M2 5h16v3.5H2z" fill="#fff" fillOpacity=".55" /><path d="M4 7h12" stroke="#2459e0" strokeWidth="1.2" strokeDasharray="2 1.5" /></svg>
  </span>
);

/** Small bag drawing scaled to the format's real proportions (used in the detail modal and cart). */
export function BagIcon({ a, b, big }: { a: number | null; b: number | null; big?: boolean }) {
  const box = big ? 30 : 20;
  const cls = 'ico' + (big ? ' lg' : '');
  if (!a || !b) {
    return <span className={cls} aria-hidden="true"><svg width={box * 0.6} height={box * 0.75} viewBox="0 0 12 15"><rect x=".5" y="2.5" width="11" height="12" rx="1" fill="none" stroke="var(--muted)" /><path d="M.5 2.5h11V5H.5z" fill="var(--muted)" opacity=".35" /></svg></span>;
  }
  const s = box / 700, w = Math.max(5, a * s), h = Math.max(7, b * s), fl = Math.max(2, h * 0.16);
  const f = (n: number) => n.toFixed(1);
  return (
    <span className={cls} aria-hidden="true">
      <svg width={f(w)} height={f(h + fl)} viewBox={`0 0 ${f(w)} ${f(h + fl)}`}>
        <rect x=".5" y={f(fl)} width={f(w - 1)} height={f(h - 0.5)} rx=".8" fill="var(--blue-soft)" stroke="var(--blue)" strokeWidth="1" />
        <rect x=".5" y=".5" width={f(w - 1)} height={f(fl)} fill="var(--blue)" opacity=".35" />
      </svg>
    </span>
  );
}
export const IcMenu = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const IcSortArrows = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4" /></svg>;
export const IcCheck = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>;
