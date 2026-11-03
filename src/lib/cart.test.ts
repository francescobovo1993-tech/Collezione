import { describe, expect, it } from 'vitest';
import { data } from '../test/helpers';
import { cartLines, cartText, DEFAULT_COPY, estimate } from './cart';
import { toRows } from './rows';
import { normState } from './state';

const byId = new Map(toRows(data.catalog, data.volumi).map(r => [r.id, r]));
const st = (cart: Record<string, number>) => normState({ cart: Object.fromEntries(Object.entries(cart).map(([k, q]) => [k, { qty: q }])) });

describe('cartText', () => {
  it('matches the prototype format exactly', () => {
    const ls = cartLines(st({ 'fumetti~manga-tp1': 100, 'fumetti~a4': 510 }), byId);
    const a4 = byId.get('fumetti~a4')!, tp1 = byId.get('fumetti~manga-tp1')!;
    expect(cartText(ls, DEFAULT_COPY)).toBe(
      'Buongiorno,\nvorrei ordinare le seguenti buste W.R.:\n\n' +
      `- A4 (${a4.a}x${a4.b} mm) – 510 pz\n` +
      `- MANGA TP1 (${tp1.a}x${tp1.b} mm) – 100 pz\n\n` +
      'Totale: 610 buste\n\nGrazie mille!');
    expect(tp1.a).toBe(140); expect(tp1.b).toBe(178);
  });
  it('honours the Misure / Prezzi stimati / Saluti toggles', () => {
    const ls = cartLines(st({ 'fumetti~manga-tp1': 150 }), byId);
    const p = byId.get('fumetti~manga-tp1')!.price!;
    const two = '€' + (2 * p).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    expect(cartText(ls, { dims: false, prices: true, greet: false })).toBe(`- MANGA TP1 – 150 pz (≈ ${two})\n\nTotale: 150 buste (≈ ${two} a listino WR)`);
  });
  it('labels side-closing bags', () => {
    expect(cartText(cartLines(st({ 'laterale~bonelli': 100 }), byId), { dims: false, prices: false, greet: false }))
      .toBe('- BONELLI – chiusura laterale – 100 pz\n\nTotale: 100 buste');
  });
  it('is empty with an empty cart', () => expect(cartText([], DEFAULT_COPY)).toBe(''));
  it('estimates whole packs', () => {
    expect(estimate(101, 100, 12)).toBe(24);
    expect(estimate(100, 100, 12)).toBe(12);
    expect(estimate(5, null, 12)).toBe(12);
    expect(estimate(5, 100, null)).toBeNull();
  });
});
