/*
 * Fallback when the static HTML is missing rows: open the page in Chromium,
 * make every DataTable show all rows, stamp each table with its real total, return the HTML.
 */
export async function fetchWithBrowser(url: string): Promise<string> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ locale: 'it-IT' });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.waitForSelector('table', { timeout: 30_000 });
    await page.evaluate(async () => {
      const w = window as unknown as { jQuery?: any };
      const $ = w.jQuery;
      const tables = [...document.querySelectorAll('table')];
      for (const t of tables) {
        if ($?.fn?.dataTable?.isDataTable?.(t)) {
          const dt = $(t).DataTable();
          dt.search('').page.len(-1).draw(false);
          t.setAttribute('data-wr-total', String(dt.page.info().recordsTotal));
        }
      }
      await new Promise(r => setTimeout(r, 1500));
      // Not DataTables, or ajax tables still drawing: fall back to picking the largest page length.
      for (const sel of document.querySelectorAll<HTMLSelectElement>('select[name$="_length"]')) {
        const best = [...sel.options].sort((a, b) => (+b.value === -1 ? 1e9 : +b.value) - (+a.value === -1 ? 1e9 : +a.value))[0];
        if (best && sel.value !== best.value) { sel.value = best.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      }
    });
    await page.waitForLoadState('networkidle');
    return await page.content();
  } finally {
    await browser.close();
  }
}
