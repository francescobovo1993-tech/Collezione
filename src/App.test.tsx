import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import bobbi from '../seed/bobbi-state-seed.json';
import { App } from './App';
import { normState } from './lib/state';
import { data, deepFreeze, MemoryStore } from './test/helpers';

afterEach(cleanup);
const row = (id: string) => document.querySelector<HTMLTableRowElement>(`tr[data-id="${id}"]`)!;
const setup = (frozen = true) => {
  const initial = normState(bobbi);
  const store = new MemoryStore(frozen ? deepFreeze(initial) : initial);
  render(<App data={data} store={store} repo="owner/repo" />);
  return store;
};

describe('catalogue rows update immediately (frozen-state regression)', () => {
  it('Scorte select changes the row and saves, even when loaded state is frozen', () => {
    const store = setup();
    const id = 'fumetti~a3';
    const sel = within(row(id)).getByLabelText('Scorte di A3') as HTMLSelectElement;
    expect(sel.value).toBe('');
    expect(sel.className).toBe('ssel none');

    fireEvent.change(sel, { target: { value: 'poche' } });
    expect((within(row(id)).getByLabelText('Scorte di A3') as HTMLSelectElement).value).toBe('poche');
    expect(within(row(id)).getByLabelText('Scorte di A3').className).toBe('ssel poche');
    expect(store.last.stock[id]).toBe('poche');

    fireEvent.change(within(row(id)).getByLabelText('Scorte di A3'), { target: { value: 'tante' } });
    expect(within(row(id)).getByLabelText('Scorte di A3').className).toBe('ssel tante');

    fireEvent.change(within(row(id)).getByLabelText('Scorte di A3'), { target: { value: '' } });
    expect(within(row(id)).getByLabelText('Scorte di A3').className).toBe('ssel none');
    expect(store.last.stock[id]).toBeUndefined();
  });

  it('Ce l’ho toggle flips on the row and in the detail modal', () => {
    const store = setup();
    const id = 'fumetti~a3';
    const sw = within(row(id)).getByRole('switch');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(within(row(id)).getByRole('switch').getAttribute('aria-checked')).toBe('true');
    expect(store.last.owned[id]).toBe(true);

    fireEvent.click(within(row(id)).getByRole('button', { name: 'A3' }));
    const dlg = screen.getByRole('dialog');
    const dsw = within(dlg).getByRole('switch', { name: 'Ce l’ho' });
    fireEvent.click(dsw);
    expect(within(dlg).getByRole('switch', { name: 'Ce l’ho' }).getAttribute('aria-checked')).toBe('false');
    expect(within(row(id)).getByRole('switch').getAttribute('aria-checked')).toBe('false');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Tante' }));
    expect(within(row(id)).getByLabelText('Scorte di A3').className).toBe('ssel tante');
  });
});

describe('detail modal', () => {
  it('shows WR info, read-only volumi and the GitHub edit link', () => {
    setup();
    fireEvent.click(within(row('fumetti~a3-portfolio-2')).getByRole('button', { name: 'A3 PORTFOLIO 2' }));
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByText('Cofanetto Corto Maltese')).toBeTruthy();
    expect(within(dlg).getByRole('link', { name: /Modifica su GitHub/ }).getAttribute('href'))
      .toBe('https://github.com/owner/repo/edit/main/data/volumi.json');
    expect(within(dlg).getByText('325×420 mm')).toBeTruthy();
    expect(dlg.querySelector('textarea')).toBeNull();
  });
});

describe('buy flow and cart', () => {
  it('adds to the cart from the Compra modal and builds the message', () => {
    const store = setup();
    fireEvent.click(within(row('fumetti~a3')).getByRole('button', { name: 'Compra' }));
    const dlg = screen.getByRole('dialog');
    const qty = within(dlg).getByLabelText('Pezzi') as HTMLInputElement;
    expect(qty.value).toBe('100');
    fireEvent.click(within(dlg).getByRole('button', { name: '200' }));
    expect(within(dlg).getByText('≈ €80,00')).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Aggiungi al carrello' }));
    expect(store.last.cart['fumetti~a3'].qty).toBe(200);
    expect(within(row('fumetti~a3')).getByRole('button', { name: '200 pz' })).toBeTruthy();

    fireEvent.click(within(row('fumetti~a3')).getByRole('button', { name: '200 pz' }));
    expect(screen.getByRole('button', { name: 'Aggiorna carrello' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Togli dal carrello' }));
    expect(store.last.cart['fumetti~a3']).toBeUndefined();
  });

  it('cart page: add Poche, edit qty, toggle options, confirm clear', () => {
    const store = setup();
    fireEvent.click(document.querySelector('.nav button[data-view="cart"]')!);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Carrello');
    const before = Object.keys(normState(bobbi).cart).length;
    fireEvent.click(screen.getByRole('button', { name: /Aggiungi le buste «Poche»/ }));
    expect(Object.keys(store.last.cart).length).toBeGreaterThan(before);

    const msg = screen.getByLabelText('Testo da incollare') as HTMLTextAreaElement;
    expect(msg.value.startsWith('Buongiorno,\nvorrei ordinare le seguenti buste W.R.:\n\n- ')).toBe(true);
    expect(msg.value).toContain('- MANGA TP1 (140x178 mm) – 100 pz');
    fireEvent.click(screen.getByRole('button', { name: 'Saluti' }));
    expect((screen.getByLabelText('Testo da incollare') as HTMLTextAreaElement).value.startsWith('- ')).toBe(true);

    const q = screen.getByLabelText('Pezzi di MANGA TP1');
    fireEvent.change(q, { target: { value: '150' } });
    fireEvent.blur(q);
    expect(store.last.cart['fumetti~manga-tp1'].qty).toBe(150);

    fireEvent.click(screen.getByRole('button', { name: 'Svuota carrello' }));
    fireEvent.click(screen.getByRole('button', { name: 'Svuota' }));
    expect(store.last.cart).toEqual({});
    expect(screen.getByText('Carrello vuoto')).toBeTruthy();
  });
});

describe('first run', () => {
  it('shows the import banner and Sono Bobbi imports from the sheet', () => {
    const store = new MemoryStore(null);
    render(<App data={data} store={store} repo="" />);
    expect(screen.getByText('Prima volta qui?')).toBeTruthy();
    expect(screen.getByText('Importa il mio stato')).toBeTruthy();
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Sono Bobbi' })); });
    expect(store.last.imported).toBe('bobbi');
    expect(store.last.stock['fumetti~a3-portfolio']).toBe('poche');
    expect(screen.queryByText('Prima volta qui?')).toBeNull();
  });
});
