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
  async getAccount() { return this.account; }
  onAuthChange(cb: (a: Account | null) => void) { this.cbs.add(cb); return () => { this.cbs.delete(cb); }; }
  async signIn() { this.login({ id: 'u1', email: 'bobbi@example.com', name: 'Bobbi' }); }
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
