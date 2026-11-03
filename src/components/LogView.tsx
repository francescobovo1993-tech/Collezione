import { refreshWorkflowUrl } from '../lib/constants';
import { fmtDate } from '../lib/format';
import type { ChangelogEntry } from '../lib/types';
import { IcRefresh } from './icons';

export function LogView({ log, repo }: { log: ChangelogEntry[]; repo: string }) {
  const url = refreshWorkflowUrl(repo);
  return (
    <div>
      <div className="log-head">
        <p className="sub" style={{ margin: 0 }}>Ogni volta che aggiorni dal sito WR, qui resta traccia di cosa è cambiato.</p>
        {url && (
          <a className="btn" href={url} target="_blank" rel="noopener" title="Apre GitHub Actions: premi «Run workflow»">
            <IcRefresh />Aggiorna da WR
          </a>
        )}
      </div>
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
  const names = l.items.slice(0, 12).map(i => i.name).join(', ') + (l.items.length > 12 ? '…' : '');
  return (
    <div className="rowi stack">
      <span className="k">{l.summary}</span>
      <span className="v">{fmtDate(l.at)}{parts.map(p => <span key={p!.key}> · {p}</span>)}</span>
      {l.items.length > 0 && <span className="fd">{names}</span>}
    </div>
  );
}
