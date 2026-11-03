import { LS_KEY } from './constants';
import type { Catalog, State, Stock } from './types';

export const emptyState = (): State => ({ owned: {}, stock: {}, cart: {}, imported: null });

/** Coerce anything (localStorage, an imported file) into a fresh, well-formed State. */
export function normState(v: unknown): State {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<State>;
  const owned: State['owned'] = {};
  for (const [k, x] of Object.entries(o.owned ?? {})) if (x) owned[k] = true;
  const stock: State['stock'] = {};
  for (const [k, x] of Object.entries(o.stock ?? {})) if (x === 'poche' || x === 'tante') stock[k] = x;
  const cart: State['cart'] = {};
  for (const [k, x] of Object.entries(o.cart ?? {})) {
    const qty = Math.round(Number((x as { qty?: unknown })?.qty));
    if (qty > 0) cart[k] = { qty, ...((x as { at?: string }).at ? { at: (x as { at: string }).at } : {}) };
  }
  return { owned, stock, cart, imported: typeof o.imported === 'string' ? o.imported : null };
}

/** Where personal state lives. Swap this for a synced backend later. */
export interface StateStore {
  load(): State | null;
  save(state: State): void;
  /** Optional: stores that can change on their own (e.g. synced from another device) push new state here. */
  subscribe?(cb: (state: State) => void): () => void;
}

export class LocalStorageStore implements StateStore {
  constructor(private key = LS_KEY) {}
  load(): State | null {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? normState(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }
  save(state: State): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(state));
    } catch {
      /* storage blocked or full: keep working in memory */
    }
  }
}

/* ---------- pure updates: every one returns a new State and never mutates its input ---------- */

export function toggleOwned(s: State, id: string): State {
  const owned = { ...s.owned };
  if (owned[id]) delete owned[id];
  else owned[id] = true;
  return { ...s, owned };
}

export function setStock(s: State, id: string, v: Stock | ''): State {
  const stock = { ...s.stock };
  if (v) stock[id] = v;
  else delete stock[id];
  return { ...s, stock };
}

export function setCartQty(s: State, id: string, qty: number, at = new Date().toISOString()): State {
  const cart = { ...s.cart };
  const q = Math.round(qty);
  if (!(q >= 1)) delete cart[id];
  else cart[id] = { ...cart[id], qty: q, at };
  return { ...s, cart };
}

export const removeFromCart = (s: State, id: string): State => setCartQty(s, id, 0);
export const clearCart = (s: State): State => ({ ...s, cart: {} });

/** Add every "Poche" format that exists and isn't in the cart yet, at pack quantity. */
export function addPoche(s: State, catalog: Catalog, at = new Date().toISOString()): { state: State; added: number } {
  const cart = { ...s.cart };
  let added = 0;
  for (const [id, v] of Object.entries(s.stock)) {
    if (v === 'poche' && catalog[id] && !cart[id]) {
      cart[id] = { qty: catalog[id].pack || 100, at };
      added++;
    }
  }
  return { state: { ...s, cart }, added };
}
