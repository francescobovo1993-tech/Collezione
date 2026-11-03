/* Read the wrbuste.it product page HTML with cheerio. */
import * as cheerio from 'cheerio';
import { parseRow, sectionCat, type Section } from '../../src/lib/wr.ts';

const clean = (s: string) => s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

export interface HtmlParse {
  sections: Section[];
  /** Reasons the static HTML can't be trusted to hold every row (→ use the browser fallback). */
  problems: string[];
}

/**
 * Walk headings, paragraphs and tables in document order.
 * "BUSTE PER …" headings open a section; the tables after it belong to it.
 * DataTables with client-side paging ship every row in the HTML, so a table's row count is its total,
 * unless the page loads rows by AJAX / server-side, or the browser fallback stamped data-wr-total.
 */
export function parseHtml(html: string): HtmlParse {
  const $ = cheerio.load(html);
  const problems: string[] = [];
  const scripts = $('script').map((_, el) => $(el).text()).get().join('\n');
  const remote = /serverSide\s*["']?\s*:\s*true|["']?ajax["']?\s*:/.test(scripts);
  if (remote) problems.push('le tabelle DataTables caricano le righe dal server (ajax/serverSide)');

  const sections: Section[] = [];
  let cur: Section | null = null;
  const totals = new Map<Section, { sum: number; unknown: boolean }>();
  $('h1,h2,h3,h4,h5,h6,p,div.wr-updated,table').each((_, el) => {
    const $el = $(el);
    if (el.tagName !== 'table' && $el.closest('table').length) return;
    if (el.tagName === 'table') {
      if (!cur) return;
      const trs = $el.find('tbody tr').length ? $el.find('tbody tr') : $el.find('tr').filter((_, tr) => $(tr).find('td').length > 0);
      let n = 0;
      trs.each((_, tr) => {
        const $tr = $(tr);
        if ($tr.find('td.dataTables_empty').length) return;
        const cells = $tr.find('td').map((_, td) => clean($(td).text())).get();
        n++;
        if (!cells.some(Boolean)) { cur!.blank++; return; }
        const r = parseRow(cells, cur!.cat);
        if (r) cur!.rows.push(r);
      });
      const stamped = Number($el.attr('data-wr-total'));
      const t = totals.get(cur) ?? { sum: 0, unknown: false };
      if (stamped > 0) t.sum += stamped;
      else if (remote) t.unknown = true;
      else t.sum += n;
      totals.set(cur, t);
      if (n === 0) problems.push(`«${cur.label}»: tabella senza righe nell’HTML`);
      return;
    }
    const text = clean($el.text());
    const h = /^h[1-6]$/.test(el.tagName) ? text.match(/^BUSTE PER (.+)$/i) : null;
    if (h) {
      cur = { cat: sectionCat(h[1]), label: h[1].trim(), updated: '', total: null, rows: [], blank: 0 };
      sections.push(cur);
      return;
    }
    const m = cur && text.match(/Ultimo aggiornamento:\s*(.+)/i);
    if (m && cur && !cur.updated) cur.updated = m[1].trim();
  });
  for (const s of sections) {
    const t = totals.get(s);
    s.total = t && !t.unknown ? t.sum : null;
    if (!t) problems.push(`«${s.label}»: nessuna tabella`);
  }
  if (!sections.length) problems.push('nessuna sezione «BUSTE PER …» trovata');
  return { sections, problems };
}
