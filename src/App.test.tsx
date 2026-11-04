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
  it('shows WR info and read-only volumi when sync is not set up', () => {
    setup();
    fireEvent.click(within(row('fumetti~a3-portfolio-2')).getByRole('button', { name: 'A3 PORTFOLIO 2' }));
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByText('Cofanetto Corto Maltese')).toBeTruthy();
    expect(within(dlg).getByText('325×420 mm')).toBeTruthy();
    expect(within(dlg).queryByText('Materiale')).toBeNull();
    expect(within(dlg).queryByRole('button', { name: /Modifica/ })).toBeNull();
    expect(within(dlg).queryByRole('link')).toBeNull();
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

describe('Impostazioni', () => {
  it('has CSV export/import and no old-sheet import', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Impostazioni/ }));
    expect(screen.getByRole('menuitem', { name: 'Esporta CSV' })).toBeTruthy();
    expect(screen.getByText('Importa CSV')).toBeTruthy();
    expect(screen.queryByText(/vecchio foglio/)).toBeNull();
    expect(screen.queryByText(/JSON/)).toBeNull();
  });
  it('importing a CSV replaces the marks', async () => {
    const store = new MemoryStore(normState(bobbi));
    render(<App data={data} store={store} repo="" />);
    fireEvent.click(screen.getByRole('button', { name: /Impostazioni/ }));
    const input = screen.getByText('Importa CSV').querySelector('input')!;
    const file = new File(['Formato;Ce l’ho;Scorte;Carrello (pz)\nA3;sì;Tante;200\n'], 'm.csv', { type: 'text/csv' });
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    expect(store.last.owned).toEqual({ 'fumetti~a3': true });
    expect(store.last.stock).toEqual({ 'fumetti~a3': 'tante' });
    expect(store.last.cart['fumetti~a3'].qty).toBe(200);
    expect(within(row('fumetti~a3')).getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });
});

describe('Aggiornamenti', () => {
  it('lists the changelog and links "Aggiorna da WR" to the refresh workflow', () => {
    setup();
    fireEvent.click(document.querySelector('.nav button[data-view="log"]')!);
    expect(screen.getByText('Importazione iniziale: 134 formati')).toBeTruthy();
    expect(screen.getByText('134 nuovi')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Aggiorna da WR/ }).getAttribute('href'))
      .toBe('https://github.com/owner/repo/actions/workflows/refresh-wr.yml');
  });
});

describe('account menu', () => {
  type Acc = { id: string; email: string; name: string } | null;
  const fakeSync = (account: Acc, over: Partial<Record<string, unknown>> = {}) => {
    const calls: string[] = [];
    const info = { status: account ? 'synced' as const : 'local' as const, account, error: '', recovery: false, editor: !!account, ...(over.info as object) };
    let volumi: Record<string, string> = { 'fumetti~a4': 'Note condivise' };
    let volCb = () => {};
    return {
      calls,
      api: {
        getInfo: () => info,
        onInfo: () => () => {},
        getVolumi: () => volumi,
        onVolumi: (cb: () => void) => { volCb = cb; return () => {}; },
        saveVolumi: async (id: string, t: string) => { calls.push(`vol:${id}:${t}`); if (t === 'boom') throw new Error('Il tuo account non può modificare i volumi.'); volumi = { ...volumi, [id]: t }; volCb(); },
        signIn: async () => { calls.push('google'); },
        signInWithPassword: async (e: string, p: string) => { calls.push(`pw:${e}:${p}`); if (p === 'bad') throw new Error('Email o password non corretti.'); },
        signUp: async (e: string) => { calls.push(`signup:${e}`); return 'confirm-email' as const; },
        sendPasswordReset: async (e: string) => { calls.push(`reset:${e}`); },
        setPassword: async (p: string) => { calls.push(`set:${p}`); },
        endRecovery: () => { calls.push('endRecovery'); },
        signOut: async () => { calls.push('out'); },
        ...over,
      },
    };
  };
  const openLogin = () => {
    fireEvent.click(screen.getByRole('button', { name: /Impostazioni/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Accedi o crea un account' }));
    return screen.getByRole('dialog');
  };

  it('login window: Google, email + password, and error messages', async () => {
    const f = fakeSync(null);
    render(<App data={data} store={new MemoryStore(normState(bobbi))} sync={f.api} repo="" />);
    expect(screen.getByText(/Accedi per sincronizzarle/)).toBeTruthy();
    let dlg = openLogin();
    fireEvent.click(within(dlg).getByRole('button', { name: /Continua con Google/ }));
    expect(f.calls).toEqual(['google']);

    fireEvent.change(within(dlg).getByLabelText('Email'), { target: { value: 'bobbi@example.com' } });
    fireEvent.change(within(dlg).getByLabelText('Password'), { target: { value: 'bad' } });
    await act(async () => { fireEvent.click(within(dlg).getByRole('button', { name: 'Accedi' })); });
    expect(within(dlg).getByRole('alert').textContent).toBe('Email o password non corretti.');

    fireEvent.change(within(dlg).getByLabelText('Password'), { target: { value: 'giusta123' } });
    await act(async () => { fireEvent.click(within(dlg).getByRole('button', { name: 'Accedi' })); });
    expect(f.calls).toContain('pw:bobbi@example.com:giusta123');
    expect(screen.queryByRole('dialog')).toBeNull();

    dlg = openLogin();
    fireEvent.change(within(dlg).getByLabelText('Email'), { target: { value: 'non-una-email' } });
    fireEvent.change(within(dlg).getByLabelText('Password'), { target: { value: 'x' } });
    await act(async () => { fireEvent.click(within(dlg).getByRole('button', { name: 'Accedi' })); });
    expect(within(dlg).getByRole('alert').textContent).toBe('Inserisci un indirizzo email valido.');
  });

  it('sign-up asks to confirm the email; reset sends a link', async () => {
    const f = fakeSync(null);
    render(<App data={data} store={new MemoryStore(normState(bobbi))} sync={f.api} repo="" />);
    const dlg = openLogin();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Creane uno' }));
    expect(within(dlg).getByRole('heading').textContent).toBe('Crea un account');
    fireEvent.change(within(dlg).getByLabelText('Email'), { target: { value: 'pomo@example.com' } });
    fireEvent.change(within(dlg).getByLabelText(/Password/), { target: { value: 'corta' } });
    await act(async () => { fireEvent.click(within(dlg).getByRole('button', { name: 'Crea account' })); });
    expect(within(dlg).getByRole('alert').textContent).toMatch(/almeno 8 caratteri/);
    fireEvent.change(within(dlg).getByLabelText(/Password/), { target: { value: 'lunghissima' } });
    await act(async () => { fireEvent.click(within(dlg).getByRole('button', { name: 'Crea account' })); });
    expect(f.calls).toContain('signup:pomo@example.com');
    expect(within(dlg).getByRole('status').textContent).toMatch(/apri il link per confermare/);

    fireEvent.click(within(dlg).getByRole('button', { name: /Torna all’accesso/ }));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Password dimenticata?' }));
    await act(async () => { fireEvent.click(within(dlg).getByRole('button', { name: 'Mandami il link' })); });
    expect(f.calls).toContain('reset:pomo@example.com');
  });

  it('signed in: shows the account, Imposta password and Esci', async () => {
    const f = fakeSync({ id: 'u1', email: 'bobbi@example.com', name: 'Bobbi' });
    render(<App data={data} store={new MemoryStore(normState(bobbi))} sync={f.api} repo="" />);
    fireEvent.click(screen.getByRole('button', { name: /Impostazioni/ }));
    expect(screen.getByText('bobbi@example.com')).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Imposta password' }));
    const dlg = screen.getByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText(/Nuova password/), { target: { value: 'segreta123' } });
    fireEvent.change(within(dlg).getByLabelText('Ripeti la password'), { target: { value: 'segreta124' } });
    await act(async () => { fireEvent.click(within(dlg).getByRole('button', { name: 'Salva password' })); });
    expect(within(dlg).getByRole('alert').textContent).toBe('Le due password non coincidono.');
    fireEvent.change(within(dlg).getByLabelText('Ripeti la password'), { target: { value: 'segreta123' } });
    await act(async () => { fireEvent.click(within(dlg).getByRole('button', { name: 'Salva password' })); });
    expect(f.calls).toContain('set:segreta123');
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Impostazioni/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Esci' }));
    expect(f.calls).toContain('out');
  });

  it('Volumi: shared notes show in the table; editors edit them in the card', async () => {
    const f = fakeSync({ id: 'u1', email: 'bobbi@example.com', name: 'Bobbi' });
    render(<App data={data} store={new MemoryStore(normState(bobbi))} sync={f.api} repo="" />);
    expect(within(row('fumetti~a4')).getByText('Note condivise')).toBeTruthy();
    fireEvent.click(within(row('fumetti~a4')).getByRole('button', { name: 'A4' }));
    const dlg = screen.getByRole('dialog');
    fireEvent.click(within(dlg).getByRole('button', { name: /Modifica/ }));
    const ta = within(dlg).getByLabelText(/Volumi che entrano/) as HTMLTextAreaElement;
    expect(ta.value).toBe('Note condivise');
    fireEvent.change(ta, { target: { value: 'boom' } });
    await act(async () => { fireEvent.click(within(dlg).getByRole('button', { name: 'Salva' })); });
    expect(within(dlg).getByRole('alert').textContent).toMatch(/non può modificare/);
    fireEvent.change(within(dlg).getByLabelText(/Volumi che entrano/), { target: { value: 'Dylan Dog, Tex' } });
    await act(async () => { fireEvent.click(within(dlg).getByRole('button', { name: 'Salva' })); });
    expect(f.calls).toContain('vol:fumetti~a4:Dylan Dog, Tex');
    expect(within(dlg).getByText('Dylan Dog, Tex')).toBeTruthy();
    expect(within(row('fumetti~a4')).getByText('Dylan Dog, Tex')).toBeTruthy();
  });

  it('Volumi: signed out asks to sign in; non-editors only read', () => {
    const out = fakeSync(null);
    const { unmount } = render(<App data={data} store={new MemoryStore(normState(bobbi))} sync={out.api} repo="" />);
    fireEvent.click(within(row('fumetti~a4')).getByRole('button', { name: 'A4' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Accedi per modificarli' }));
    expect(screen.getByRole('heading', { name: 'Accedi' })).toBeTruthy();
    unmount();
    const reader = fakeSync({ id: 'u2', email: 'x@example.com', name: 'X' }, { info: { editor: false } });
    render(<App data={data} store={new MemoryStore(normState(bobbi))} sync={reader.api} repo="" />);
    fireEvent.click(within(row('fumetti~a4')).getByRole('button', { name: 'A4' }));
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: /Modifica|Accedi/ })).toBeNull();
    expect(within(screen.getByRole('dialog')).getByText('Solo gli editor possono modificarli.')).toBeTruthy();
  });

  it('opening a reset link asks for a new password straight away', () => {
    const f = fakeSync({ id: 'u1', email: 'bobbi@example.com', name: 'Bobbi' }, { info: { recovery: true } });
    render(<App data={data} store={new MemoryStore(normState(bobbi))} sync={f.api} repo="" />);
    expect(screen.getByRole('heading', { name: 'Scegli una nuova password' })).toBeTruthy();
  });

  it('without sync there is no sign-in option', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Impostazioni/ }));
    expect(screen.queryByText(/Accedi con Google/)).toBeNull();
    expect(screen.getByText('Le tue spunte sono salvate solo in questo browser.')).toBeTruthy();
  });
  it('state pushed by the store (another device) replaces the screen', () => {
    let push: (s: ReturnType<typeof normState>) => void = () => {};
    const store = Object.assign(new MemoryStore(normState({ imported: 'none' })), { subscribe: (cb: typeof push) => { push = cb; return () => {}; } });
    render(<App data={data} store={store} repo="" />);
    expect(within(row('fumetti~a3')).getByRole('switch').getAttribute('aria-checked')).toBe('false');
    act(() => push(normState({ owned: { 'fumetti~a3': true }, imported: 'bobbi' })));
    expect(within(row('fumetti~a3')).getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });
});

describe('mobile chrome', () => {
  it('burger opens a full-screen menu that navigates and closes', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Apri menu' }));
    const menu = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(menu).getByRole('button', { name: /Catalogo/ }).getAttribute('aria-current')).toBe('page');
    expect(within(menu).getByRole('button', { name: /Carrello/ }).textContent).toContain('7');
    fireEvent.click(within(menu).getByRole('button', { name: /Aggiornamenti/ }));
    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Aggiornamenti WR');
    fireEvent.click(screen.getByRole('button', { name: 'Apri menu' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull();
  });

  it('no duplicate Carrello button in the catalogue toolbar', () => {
    setup();
    expect(document.querySelector('.card-tb')!.textContent).not.toMatch(/Carrello/);
  });

  it('Ordina bottom sheet: one tap applies and closes; red dot when not default', () => {
    setup();
    const btn = () => screen.getByRole('button', { name: /^Ordina:/ });
    expect(btn().getAttribute('aria-label')).toBe('Ordina: Lato A: dal più piccolo');
    expect(btn().querySelector('.dot-on')).toBeNull();
    fireEvent.click(btn());
    const sheet = screen.getByRole('dialog', { name: 'Ordina per' });
    expect(within(sheet).getByRole('radio', { name: 'Lato A: dal più piccolo' }).getAttribute('aria-checked')).toBe('true');
    expect(within(sheet).queryByRole('button', { name: 'Applica' })).toBeNull();
    expect(within(sheet).getAllByRole('radio').map(r => r.textContent)).toEqual([
      'Lato A: dal più piccolo', 'Lato A: dal più grande', 'Lato B: dal più piccolo', 'Lato B: dal più grande',
    ]);
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Lato B: dal più grande' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(btn().getAttribute('aria-label')).toBe('Ordina: Lato B: dal più grande');
    expect(btn().querySelector('.dot-on')).not.toBeNull();
    const bs = [...document.querySelectorAll('tbody tr td.c-b')].slice(0, 3).map(e => Number(e.textContent));
    expect([...bs].sort((x, y) => y - x)).toEqual(bs);
    fireEvent.click(btn());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('no category filter anywhere', () => {
    setup();
    expect(screen.queryByRole('combobox', { name: 'Categoria' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Filtri/ })).toBeNull();
  });
});
