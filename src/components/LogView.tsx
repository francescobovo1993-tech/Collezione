import { CATS, FIELD_LABEL } from '../lib/constants';
import { eur, fmtDate } from '../lib/format';
import type { ChangelogEntry } from '../lib/types';

const fv = (f: string, v: unknown) => (v == null || v === '' ? '—' : f === 'price' ? eur(v as number) : String(v));

export function LogView({ log }: { log: ChangelogEntry[] }) {
  return (
    <div>
      <p className="sub" style={{ marginTop: 8 }}>Ogni volta che aggiorni dal sito WR, qui resta traccia di cosa è cambiato.</p>
      <section className="card" style={{ padding: 4 }}>
        <div className="group log" style={{ margin: 0 }}>
          {log.length ? log.map((l, i) => <LogEntry key={l.at + i} l={l} />) : (
            <div className="rowi"><span className="v left">Nessun aggiornamento registrato.</span></div>
          )}
        </div>
      </section>
    </div>
  );
}

function LogEntry({ l }: { l: ChangelogEntry }) {
  const parts = [
    l.added ? <span key="a" className="st-a">{l.added} nuovi</span> : null,
    l.changed ? <span key="c" className="st-c">{l.changed} modificati</span> : null,
    l.removed ? <span key="r" className="st-r">{l.removed} rimossi</span> : null,
  ].filter(Boolean);
  return (
    <div className="rowi stack">
      <span className="k">{l.summary}</span>
      <span className="v">{fmtDate(l.at)}{parts.map(p => <span key={p!.key}> · {p}</span>)}</span>
      {l.items.length > 0 && (
        <details>
          <summary className="fd" style={{ cursor: 'pointer' }}>Dettagli ({l.items.length})</summary>
          <div className="log-items">
            {l.items.map((it, j) => (
              <span key={j} className="fd">
                <span className={{ add: 'st-a', chg: 'st-c', del: 'st-r' }[it.t]}>{{ add: 'Nuovo', chg: 'Modificato', del: 'Non più sul sito' }[it.t]}</span>{' '}
                <b style={{ color: 'var(--ink)', fontWeight: 500 }}>{it.name}</b> · {CATS[it.cat] ?? it.cat}
                {it.fields?.map(f => (
                  <span key={f.f} className="fd" style={{ paddingLeft: 12 }}>
                    {FIELD_LABEL[f.f] ?? f.f}: <del>{fv(f.f, f.from)}</del> → <ins>{fv(f.f, f.to)}</ins>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
