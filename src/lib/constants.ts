export const WR_URL = 'https://wrbuste.it/prodotti/buste-protettive-fumetti/';
export const LS_KEY = 'wrbuste.state.v1';
export const CATS: Record<string, string> = {
  fumetti: 'Fumetti',
  musica: 'Musica e videogiochi',
  laterale: 'Chiusura laterale',
  sperimentali: 'Formati sperimentali',
  manifesti: 'Manifesti e locandine',
  manuale: 'Non WR',
};
export const STOCK_LABEL: Record<string, string> = { poche: 'Poche', tante: 'Tante', '': 'Nessuna nota' };
/** WR-derived fields compared by the refresh diff. */
export const FIELDS = ['name', 'a', 'b', 'price', 'pack', 'material', 'notes'] as const;
export const FIELD_LABEL: Record<string, string> = {
  name: 'nome', a: 'lato A', b: 'lato B', price: 'prezzo', pack: 'pezzi', material: 'materiale', notes: 'note WR',
};
/** "owner/repo", injected at build time by the deploy workflow. */
export const GITHUB_REPO: string = import.meta.env?.VITE_GITHUB_REPO ?? '';
export const volumiEditUrl = (repo = GITHUB_REPO) =>
  repo ? `https://github.com/${repo}/edit/main/data/volumi.json` : '';
