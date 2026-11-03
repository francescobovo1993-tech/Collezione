export const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const makeId = (cat: string, name: string) => `${cat}~${slug(name)}`;

export const coll = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });

export const eur = (n: number | null | undefined) =>
  n == null ? '—' : '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const dimsOf = (r: { a: number | null; b: number | null }) => (r.a && r.b ? `${r.a}×${r.b} mm` : '');

export const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};
