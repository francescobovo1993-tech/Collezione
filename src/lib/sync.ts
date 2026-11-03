/*
 * Personal state synced to an online account, with the browser copy as a cache.
 * - Signed out: behaves exactly like the local store.
 * - First sign-in with no online row: uploads what this browser has.
 * - Online row exists: it wins; the browser's previous copy is kept as a backup.
 * - Saves go to the browser at once and online shortly after (debounced).
 * - Coming back to the tab re-reads the online row, so another device's changes show up
 *   (or retries a save that failed).
 */
import { normState, type StateStore } from './state';
import type { State } from './types';

export interface Account { id: string; email: string; name: string }

/** Result of creating an account with email + password. */
export type SignUpResult = 'signed-in' | 'confirm-email';

/** What the sync needs from a backend. Supabase implements it in supabase.ts; tests use a fake. */
export interface Remote {
  getAccount(): Promise<Account | null>;
  onAuthChange(cb: (a: Account | null) => void): () => void;
  /** Called when the user arrives from a "reset password" email link. */
  onPasswordRecovery(cb: () => void): () => void;
  signIn(): Promise<void>; // Google
  signInWithPassword(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<SignUpResult>;
  sendPasswordReset(email: string): Promise<void>;
  /** Set or change the signed-in user's password (also adds password sign-in to a Google account). */
  setPassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  fetch(userId: string): Promise<State | null>;
  put(userId: string, state: State): Promise<void>;
  /** Shared Volumi notes (same for everyone). */
  fetchVolumi(): Promise<Record<string, string>>;
  putVolumi(id: string, text: string, byEmail: string): Promise<void>;
  /** Whether the signed-in account may edit the shared Volumi. */
  isEditor(email: string): Promise<boolean>;
}

export type SyncStatus = 'local' | 'loading' | 'synced' | 'saving' | 'error';
export interface SyncInfo {
  status: SyncStatus;
  account: Account | null;
  error: string;
  /** Signed in and allowed to edit the shared Volumi notes. */
  editor: boolean;
  /** True after opening a password-reset link: the app should ask for a new password. */
  recovery: boolean;
}

export const BACKUP_KEY = 'wrbuste.state.v1.backup';

export class SyncedStore implements StateStore {
  private listeners = new Set<(s: State) => void>();
  private infoListeners = new Set<() => void>();
  private info: SyncInfo = { status: 'local', account: null, error: '', recovery: false, editor: false };
  private volumi: Record<string, string> = {};
  private volumiListeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: State | null = null;
  private saving = false;
  private pullSeq = 0;
  private current: State | null;

  constructor(private local: StateStore, private remote: Remote, private debounceMs = 600) {
    this.current = local.load();
  }

  /* ---------- StateStore ---------- */
  load(): State | null { return this.current; }

  save(state: State): void {
    this.current = state;
    this.local.save(state);
    if (!this.info.account) return;
    this.pending = state;
    this.setInfo({ status: 'saving' });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush(); }, this.debounceMs);
  }

  subscribe(cb: (s: State) => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  /* ---------- account ---------- */
  getInfo = (): SyncInfo => this.info;
  onInfo = (cb: () => void): (() => void) => {
    this.infoListeners.add(cb);
    return () => { this.infoListeners.delete(cb); };
  };
  signIn = () => this.remote.signIn().catch(e => this.fail(e));
  // These reject with a user-facing message, so the login form can show it.
  signInWithPassword = (email: string, password: string) => this.remote.signInWithPassword(email, password);
  signUp = (email: string, password: string) => this.remote.signUp(email, password);
  sendPasswordReset = (email: string) => this.remote.sendPasswordReset(email);
  setPassword = async (password: string) => {
    await this.remote.setPassword(password);
    this.setInfo({ recovery: false });
  };
  endRecovery = () => this.setInfo({ recovery: false });

  /* ---------- shared Volumi ---------- */
  getVolumi = (): Record<string, string> => this.volumi;
  onVolumi = (cb: () => void): (() => void) => {
    this.volumiListeners.add(cb);
    return () => { this.volumiListeners.delete(cb); };
  };
  async loadVolumi(): Promise<void> {
    try { this.setVolumiMap(await this.remote.fetchVolumi()); } catch { /* keep what we have */ }
  }
  /** Save a shared note. Shows at once; rolls back and rejects with a message if the save fails. */
  saveVolumi = async (id: string, text: string): Promise<void> => {
    const acc = this.info.account;
    if (!acc) throw new Error('Accedi per modificare i volumi.');
    if (!this.info.editor) throw new Error('Il tuo account non può modificare i volumi.');
    const before = this.volumi;
    this.setVolumiMap({ ...before, [id]: text.trim() });
    try {
      await this.remote.putVolumi(id, text.trim(), acc.email);
    } catch (e) {
      this.setVolumiMap(before);
      throw e instanceof Error ? e : new Error(String(e));
    }
  };
  /** Ask the backend whether the signed-in account may edit the shared Volumi. */
  async checkEditor(): Promise<void> {
    const a = this.info.account;
    if (!a) return;
    const ok = await this.remote.isEditor(a.email).catch(() => false);
    if (this.info.account?.id === a.id && ok !== this.info.editor) this.setInfo({ editor: ok });
  }
  private setVolumiMap(v: Record<string, string>) {
    this.volumi = v;
    this.volumiListeners.forEach(cb => cb());
  }
  signOut = async () => {
    await this.flush();
    await this.remote.signOut().catch(() => {});
    this.setInfo({ account: null, status: 'local', error: '', editor: false });
  };

  /** Begin listening for sign-in/out and tab focus. Returns a stop function. */
  start(): () => void {
    let authEvent = false;
    const off = this.remote.onAuthChange(a => { authEvent = true; this.useAccount(a); });
    const offRecovery = this.remote.onPasswordRecovery(() => this.setInfo({ recovery: true }));
    void this.loadVolumi();
    // The initial check can resolve after a newer auth event: then it's stale, ignore it.
    void this.remote.getAccount().then(a => { if (!authEvent) this.useAccount(a); }).catch(e => this.fail(e));
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !this.info.account) return;
      if (this.pending) void this.flush(); else void this.pull();
    };
    // Notes and editor rights can change elsewhere (another device, the Supabase dashboard).
    const onVisibleVolumi = () => {
      if (document.visibilityState !== 'visible') return;
      void this.loadVolumi();
      void this.checkEditor();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible);
      document.addEventListener('visibilitychange', onVisibleVolumi);
    }
    return () => {
      off(); offRecovery();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
        document.removeEventListener('visibilitychange', onVisibleVolumi);
      }
    };
  }

  /** Wait for any pending online save. */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    const acc = this.info.account;
    if (!acc || this.saving || !this.pending) return;
    const state = this.pending;
    this.pending = null;
    this.saving = true;
    let failed = false;
    try {
      await this.remote.put(acc.id, state);
      if (!this.pending) this.setInfo({ status: 'synced', error: '' });
    } catch (e) {
      failed = true;
      this.pending ??= state; // kept for the next save, focus or flush() — no tight retry loop
      this.fail(e);
    } finally {
      this.saving = false;
    }
    // A save that arrived while this one was in flight goes out now.
    if (!failed && this.pending) await this.flush();
  }

  /* ---------- internals ---------- */
  private useAccount(a: Account | null) {
    const prev = this.info.account;
    if (a?.id === prev?.id) return;
    if (!a) { this.setInfo({ account: null, status: 'local', editor: false }); return; }
    this.setInfo({ account: a, status: 'loading', error: '', editor: false });
    void this.pull();
    void this.checkEditor();
  }

  async pull(): Promise<void> {
    const acc = this.info.account;
    if (!acc) return;
    const seq = ++this.pullSeq;
    try {
      const remote = await this.remote.fetch(acc.id);
      if (seq !== this.pullSeq || this.info.account?.id !== acc.id) return;
      if (this.pending || this.saving) return; // local edits are newer: they'll be pushed
      if (!remote) {
        // First sign-in: upload what this browser has (even if empty, so the row exists).
        this.pending = this.current ?? normState({});
        await this.flush();
        return;
      }
      const next = normState(remote);
      if (this.current && JSON.stringify(this.current) !== JSON.stringify(next)) {
        try { localStorage.setItem(BACKUP_KEY, JSON.stringify(this.current)); } catch { /* ignore */ }
      }
      this.current = next;
      this.local.save(next);
      this.listeners.forEach(cb => cb(next));
      this.setInfo({ status: 'synced', error: '' });
    } catch (e) {
      this.fail(e);
    }
  }

  private fail(e: unknown) {
    this.setInfo({ status: 'error', error: e instanceof Error ? e.message : String(e) });
  }

  private setInfo(p: Partial<SyncInfo>) {
    this.info = { ...this.info, ...p };
    this.infoListeners.forEach(cb => cb());
  }
}
