import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryStore } from '../test/helpers';
import { normState, setStock, toggleOwned } from './state';
import { BACKUP_KEY, SyncedStore, type Account, type Remote } from './sync';
import type { State } from './types';

class FakeRemote implements Remote {
  rows = new Map<string, State>();
  puts: [string, State][] = [];
  account: Account | null = null;
  failPut = false;
  private cbs = new Set<(a: Account | null) => void>();
  recover: () => void = () => {};
  volumi: Record<string, string> = {};
  editors = new Set<string>(['bobbi@example.com']);
  failVolumi = false;
  passwords = new Map<string, string>();
  async getAccount() { return this.account; }
  onAuthChange(cb: (a: Account | null) => void) { this.cbs.add(cb); return () => { this.cbs.delete(cb); }; }
  async signIn() { this.login({ id: 'u1', email: 'bobbi@example.com', name: 'Bobbi' }); }
  onPasswordRecovery(cb: () => void) { this.recover = cb; return () => {}; }
  async signInWithPassword(email: string, pw: string) {
    if (this.passwords.get(email) !== pw) throw new Error('Email o password non corretti.');
    this.login({ id: 'u1', email, name: email });
  }
  async signUp() { return 'confirm-email' as const; }
  async sendPasswordReset() {}
  async fetchVolumi() { return { ...this.volumi }; }
  async putVolumi(id: string, text: string) {
    if (this.failVolumi) throw new Error('Il tuo account non può modificare i volumi.');
    this.volumi[id] = text;
  }
  async isEditor(email: string) { return this.editors.has(email); }
  async setPassword(pw: string) { if (this.account) this.passwords.set(this.account.email, pw); }
  async signOut() { this.login(null); }
  async fetch(id: string) { return this.rows.get(id) ?? null; }
  async put(id: string, s: State) {
    if (this.failPut) throw new Error('offline');
    this.puts.push([id, s]);
    this.rows.set(id, s);
  }
  login(a: Account | null) { this.account = a; this.cbs.forEach(cb => cb(a)); }
}
const tick = () => new Promise(r => setTimeout(r, 0));
const mine = normState({ owned: { 'fumetti~a4': true }, stock: { 'fumetti~a4': 'poche' }, imported: 'bobbi' });

describe('SyncedStore', () => {
  let remote: FakeRemote;
  beforeEach(() => { localStorage.clear(); remote = new FakeRemote(); });

  it('signed out: works like the local store and never calls the backend', async () => {
    const local = new MemoryStore(mine);
    const s = new SyncedStore(local, remote, 0);
    s.start();
    await tick();
    expect(s.load()).toEqual(mine);
    s.save(toggleOwned(mine, 'fumetti~a3'));
    await tick();
    expect(local.last.owned['fumetti~a3']).toBe(true);
    expect(remote.puts).toEqual([]);
    expect(s.getInfo().status).toBe('local');
  });

  it('first sign-in with no online row uploads this browser’s marks', async () => {
    const s = new SyncedStore(new MemoryStore(mine), remote, 0);
    s.start();
    await s.signIn();
    await tick(); await tick();
    expect(remote.rows.get('u1')).toEqual(mine);
    expect(s.getInfo()).toMatchObject({ status: 'synced', account: { email: 'bobbi@example.com' } });
  });

  it('an existing online row wins, is pushed to the screen, and the old browser copy is backed up', async () => {
    const online = normState({ owned: { 'fumetti~manga': true }, imported: 'bobbi' });
    remote.rows.set('u1', online);
    const local = new MemoryStore(mine);
    const s = new SyncedStore(local, remote, 0);
    const seen: State[] = [];
    s.subscribe(st => seen.push(st));
    s.start();
    await s.signIn();
    await tick();
    expect(seen).toEqual([online]);
    expect(s.load()).toEqual(online);
    expect(local.last).toEqual(online);
    expect(JSON.parse(localStorage.getItem(BACKUP_KEY)!)).toEqual(mine);
    expect(remote.puts).toEqual([]);
  });

  it('saves go online (debounced into one write) while signed in', async () => {
    remote.rows.set('u1', mine);
    remote.account = { id: 'u1', email: 'b@x', name: 'B' };
    const s = new SyncedStore(new MemoryStore(mine), remote, 5);
    s.start();
    await tick();
    const a = setStock(mine, 'fumetti~a4', 'tante');
    const b = toggleOwned(a, 'fumetti~a3');
    s.save(a); s.save(b);
    expect(s.getInfo().status).toBe('saving');
    await new Promise(r => setTimeout(r, 20));
    expect(remote.puts).toEqual([['u1', b]]);
    expect(s.getInfo().status).toBe('synced');
  });

  it('a failed online save keeps the browser copy, reports the error, and retries on the next flush', async () => {
    remote.rows.set('u1', mine);
    remote.account = { id: 'u1', email: 'b@x', name: 'B' };
    const local = new MemoryStore(mine);
    const s = new SyncedStore(local, remote, 0);
    s.start(); await tick();
    remote.failPut = true;
    const next = toggleOwned(mine, 'fumetti~a3');
    s.save(next);
    await s.flush();
    expect(local.last).toEqual(next);
    expect(s.getInfo()).toMatchObject({ status: 'error', error: 'offline' });
    remote.failPut = false;
    await s.flush();
    expect(remote.rows.get('u1')).toEqual(next);
    expect(s.getInfo().status).toBe('synced');
  });

  it('a pull that lands while local edits are pending does not overwrite them', async () => {
    remote.rows.set('u1', mine);
    remote.account = { id: 'u1', email: 'b@x', name: 'B' };
    const s = new SyncedStore(new MemoryStore(mine), remote, 50);
    s.start(); await tick();
    const next = toggleOwned(mine, 'fumetti~a3');
    s.save(next);
    await s.pull();
    expect(s.load()).toEqual(next);
    await s.flush();
    expect(remote.rows.get('u1')).toEqual(next);
  });

  it('a Google account can add a password, then sign in with it as the same user', async () => {
    const s = new SyncedStore(new MemoryStore(mine), remote, 0);
    s.start();
    await s.signIn();
    await tick();
    await s.setPassword('segreta123');
    await s.signOut();
    await expect(s.signInWithPassword('bobbi@example.com', 'sbagliata')).rejects.toThrow('Email o password non corretti.');
    await s.signInWithPassword('bobbi@example.com', 'segreta123');
    await tick();
    expect(s.getInfo().account?.id).toBe('u1');
  });

  it('a password-reset link turns on recovery until the new password is saved', async () => {
    remote.account = { id: 'u1', email: 'b@x', name: 'B' };
    const s = new SyncedStore(new MemoryStore(mine), remote, 0);
    s.start(); await tick();
    remote.recover();
    expect(s.getInfo().recovery).toBe(true);
    await s.setPassword('nuovapass1');
    expect(s.getInfo().recovery).toBe(false);
  });

  it('shared Volumi: loaded for everyone, editable only by editors, rolled back on failure', async () => {
    remote.volumi = { 'fumetti~a4': 'Dylan Dog' };
    const s = new SyncedStore(new MemoryStore(mine), remote, 0);
    s.start(); await tick();
    expect(s.getVolumi()).toEqual({ 'fumetti~a4': 'Dylan Dog' });         // signed out can read
    await expect(s.saveVolumi('fumetti~a4', 'x')).rejects.toThrow('Accedi per modificare i volumi.');

    await s.signIn(); await tick(); await tick();                          // bobbi@example.com is an editor
    expect(s.getInfo().editor).toBe(true);
    await s.saveVolumi('fumetti~a4', '  Dylan Dog, Tex  ');
    expect(remote.volumi['fumetti~a4']).toBe('Dylan Dog, Tex');
    expect(s.getVolumi()['fumetti~a4']).toBe('Dylan Dog, Tex');

    remote.failVolumi = true;
    await expect(s.saveVolumi('fumetti~a4', 'altro')).rejects.toThrow(/non può modificare/);
    expect(s.getVolumi()['fumetti~a4']).toBe('Dylan Dog, Tex');            // rolled back
  });

  it('a signed-in account that is not in the editors list cannot edit', async () => {
    remote.editors.clear();
    const s = new SyncedStore(new MemoryStore(mine), remote, 0);
    s.start(); await s.signIn(); await tick(); await tick();
    expect(s.getInfo().editor).toBe(false);
    await expect(s.saveVolumi('fumetti~a4', 'x')).rejects.toThrow('Il tuo account non può modificare i volumi.');
    remote.editors.add('bobbi@example.com');                                // added later, e.g. in Supabase
    await s.checkEditor();
    expect(s.getInfo().editor).toBe(true);
  });

  it('signing out flushes pending changes and returns to browser-only', async () => {
    remote.rows.set('u1', mine);
    remote.account = { id: 'u1', email: 'b@x', name: 'B' };
    const s = new SyncedStore(new MemoryStore(mine), remote, 1000);
    s.start(); await tick();
    const next = toggleOwned(mine, 'fumetti~a3');
    s.save(next);
    await s.signOut();
    expect(remote.rows.get('u1')).toEqual(next);
    expect(s.getInfo()).toMatchObject({ status: 'local', account: null });
  });
});
