import { describe, expect, it, beforeEach } from 'vitest';
import bobbi from '../../seed/bobbi-state-seed.json';
import { data, deepFreeze } from '../test/helpers';
import {
  addPoche, clearCart, emptyState, LocalStorageStore, normState, removeFromCart, setCartQty, setStock, toggleOwned,
} from './state';
import type { State } from './types';

const frozen = (): State => deepFreeze(normState({
  owned: { 'fumetti~a4': true }, stock: { 'fumetti~a4': 'poche', 'fumetti~manga': 'poche' }, cart: { 'fumetti~a4': { qty: 100 } }, imported: 'bobbi',
}));

describe('state updates are immutable', () => {
  it('work on deeply frozen state and return new objects', () => {
    const s = frozen();
    const snapshot = JSON.stringify(s);
    const steps: [string, State][] = [
      ['toggleOwned on', toggleOwned(s, 'fumetti~manga')],
      ['toggleOwned off', toggleOwned(s, 'fumetti~a4')],
      ['setStock', setStock(s, 'fumetti~a4', 'tante')],
      ['setStock clear', setStock(s, 'fumetti~a4', '')],
      ['setCartQty', setCartQty(s, 'fumetti~manga', 50)],
      ['removeFromCart', removeFromCart(s, 'fumetti~a4')],
      ['clearCart', clearCart(s)],
      ['addPoche', addPoche(s, data.catalog).state],
    ];
    for (const [, next] of steps) expect(next).not.toBe(s);
    expect(JSON.stringify(s)).toBe(snapshot);
    const [on, off, tante, clear, qty, rm, empty, poche] = steps.map(x => x[1]);
    expect(on.owned['fumetti~manga']).toBe(true);
    expect(off.owned['fumetti~a4']).toBeUndefined();
    expect(tante.stock['fumetti~a4']).toBe('tante');
    expect(clear.stock['fumetti~a4']).toBeUndefined();
    expect(qty.cart['fumetti~manga'].qty).toBe(50);
    expect(rm.cart['fumetti~a4']).toBeUndefined();
    expect(empty.cart).toEqual({});
    expect(poche.cart['fumetti~manga'].qty).toBe(100);
    expect(poche.cart['fumetti~a4'].qty).toBe(100); // already in cart: untouched
  });

  it('only copies the slice that changed', () => {
    const s = frozen();
    const n = setStock(s, 'fumetti~a4', 'tante');
    expect(n.stock).not.toBe(s.stock);
    expect(n.owned).toBe(s.owned);
  });
});

describe('import', () => {
  it('normState accepts bobbi-state-seed.json and drops junk', () => {
    const s = normState(bobbi);
    expect(s.imported).toBe('bobbi');
    expect(s.cart['fumetti~manga-tp1'].qty).toBe(100);
    expect(normState({ owned: { x: false }, stock: { y: 'boh' }, cart: { z: { qty: 0 } } })).toEqual(emptyState());
    expect(normState(null)).toEqual(emptyState());
  });
  it('every id in bobbi-state-seed exists in the catalogue', () => {
    const s = normState(bobbi);
    for (const id of [...Object.keys(s.owned), ...Object.keys(s.stock), ...Object.keys(s.cart)]) expect(data.catalog).toHaveProperty([id]);
  });
});

describe('LocalStorageStore', () => {
  beforeEach(() => localStorage.clear());
  it('round-trips under wrbuste.state.v1', () => {
    const st = new LocalStorageStore();
    expect(st.load()).toBeNull();
    st.save(normState(bobbi));
    expect(localStorage.getItem('wrbuste.state.v1')).toContain('fumetti~a4');
    expect(st.load()).toEqual(normState(bobbi));
  });
  it('survives broken JSON and a throwing localStorage', () => {
    localStorage.setItem('wrbuste.state.v1', '{nope');
    expect(new LocalStorageStore().load()).toBeNull();
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('QuotaExceeded'); };
    try { expect(() => new LocalStorageStore().save(emptyState())).not.toThrow(); } finally { Storage.prototype.setItem = orig; }
  });
});
