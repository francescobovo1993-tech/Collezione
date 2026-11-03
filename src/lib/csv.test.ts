import { describe, expect, it } from 'vitest';
import bobbi from '../../seed/bobbi-state-seed.json';
import { data } from '../test/helpers';
import { csvToState, parseCsv, stateToCsv } from './csv';
import { toRows } from './rows';
import { normState } from './state';

const rows = toRows(data.catalog, data.volumi);
const st = normState(bobbi);
const strip = (s: { owned: object; stock: object; cart: Record<string, { qty: number }> }) =>
  ({ owned: s.owned, stock: s.stock, cart: Object.fromEntries(Object.entries(s.cart).map(([k, v]) => [k, v.qty])) });

describe('CSV export', () => {
  const csv = stateToCsv(rows, st);
  it('has a BOM, ";" separators, a header and one row per format', () => {
    expect(csv.startsWith('﻿id;Formato;Categoria;Lato A;Lato B;Ce l’ho;Scorte;Carrello (pz)\r\n')).toBe(true);
    expect(csv.trim().split('\r\n')).toHaveLength(135);
    expect(csv).toContain('fumetti~manga-tp1;MANGA TP1;Fumetti;140;178;;;100\r\n');
    expect(csv).toContain('fumetti~a3-portfolio;A3 PORTFOLIO;Fumetti;315;420;sì;Poche;\r\n');
  });
  it('round-trips through import', () => {
    const r = csvToState(csv, rows);
    expect(r.matched).toBe(134);
    expect(r.unknown).toEqual([]);
    expect(strip(r.state)).toEqual(strip(st));
  });
});

describe('CSV import', () => {
  it('accepts a hand-edited file: "," separator, names instead of ids, loose values', () => {
    const csv = 'Formato,Ce l\'ho,Scorte,Carrello\nMANGA TP1,si,tante,"1.000"\nmanga tp2,x,POCHE,\nBOH,sì,,\n';
    const r = csvToState(csv, rows);
    expect(r.matched).toBe(2);
    expect(r.unknown).toEqual(['BOH']);
    expect(r.state.owned).toEqual({ 'fumetti~manga-tp1': true, 'fumetti~manga-tp2': true });
    expect(r.state.stock).toEqual({ 'fumetti~manga-tp1': 'tante', 'fumetti~manga-tp2': 'poche' });
    expect(r.state.cart['fumetti~manga-tp1'].qty).toBe(1000);
  });
  it('uses Categoria to tell apart formats with the same name', () => {
    const r = csvToState('Formato;Categoria;Ce l’ho\nBONELLI;Chiusura laterale;sì\n', rows);
    expect(Object.keys(r.state.owned)).toEqual(['laterale~bonelli']);
  });
  it('explains unusable files', () => {
    expect(() => csvToState('', rows)).toThrow('Il file è vuoto.');
    expect(() => csvToState('a;b\n1;2', rows)).toThrow(/colonna «id» o «Formato»/);
    expect(() => csvToState('Formato;Note\nA4;x', rows)).toThrow(/Mancano le colonne/);
    expect(() => csvToState('Formato;Ce l’ho\nNIENTE;sì', rows)).toThrow(/Nessuna riga/);
  });
  it('parses quotes, doubled quotes and newlines inside quotes', () => {
    expect(parseCsv('a;"b;c";"d ""e""\nf"\r\n1;2;3\n', ';')).toEqual([['a', 'b;c', 'd "e"\nf'], ['1', '2', '3']]);
  });
});
