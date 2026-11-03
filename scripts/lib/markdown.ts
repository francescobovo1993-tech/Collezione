import { CATS, FIELD_LABEL } from '../../src/lib/constants.ts';
import { dimsOf, eur } from '../../src/lib/format.ts';
import type { Diff } from '../../src/lib/wr.ts';

const fv = (f: string, v: unknown) => (v == null || v === '' ? '—' : f === 'price' ? eur(v as number) : String(v));
const cat = (c: string) => CATS[c] ?? c;

/** Changelog for the PR body / terminal: Nuovi, Modificati (field: old → new), Non più sul sito. */
export function diffMarkdown(d: Diff, summary: string): string {
  const out: string[] = [`## ${summary}`, ''];
  if (d.added.length) {
    out.push('### Nuovi', '');
    for (const r of d.added) out.push(`- **${r.name}** (${cat(r.cat)})${dimsOf(r) ? ` — ${dimsOf(r)}` : ''}${r.price != null ? ` · ${eur(r.price)}` : ''}${r.pack ? ` /${r.pack} pz` : ''}`);
    out.push('');
  }
  if (d.changed.length) {
    out.push('### Modificati', '');
    for (const c of d.changed) {
      out.push(`- **${c.r.name}** (${cat(c.r.cat)})`);
      for (const f of c.ch) {
        out.push(`  - ${FIELD_LABEL[f] ?? f}: ${fv(f, (c.cur as unknown as Record<string, unknown>)[f])} → ${fv(f, (c.r as unknown as Record<string, unknown>)[f])}`);
      }
    }
    out.push('');
  }
  if (d.removed.length) {
    out.push('### Non più sul sito', '');
    for (const r of d.removed) out.push(`- **${r.name}** (${cat(r.cat)}) — resta nel catalogo con l’etichetta «non più su WR»`);
    out.push('');
  }
  if (d.revived.length) {
    out.push('### Tornati sul sito', '');
    for (const r of d.revived) out.push(`- **${r.r.name}** (${cat(r.r.cat)})`);
    out.push('');
  }
  if (d.warns.length) {
    out.push('### Avvisi', '');
    for (const w of d.warns) out.push(`- ⚠️ ${w}`);
    out.push('');
  }
  out.push(`_${d.same} formati invariati._`);
  return out.join('\n') + '\n';
}
