import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Account, Remote, SignUpResult } from './sync';
import type { State } from './types';

const URL_ = import.meta.env.VITE_SUPABASE_URL ?? '';
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

const toAccount = (u: User | null | undefined): Account | null =>
  u ? { id: u.id, email: u.email ?? '', name: (u.user_metadata?.full_name as string) || (u.user_metadata?.name as string) || u.email || '' } : null;

/** Supabase auth errors → messages for the login form. */
export function authMessage(e: unknown): string {
  const err = e as { code?: string; message?: string; status?: number };
  switch (err?.code) {
    case 'invalid_credentials': return 'Email o password non corretti.';
    case 'email_not_confirmed': return 'Conferma prima il tuo indirizzo: apri il link nell’email che ti abbiamo mandato.';
    case 'user_already_exists':
    case 'email_exists': return 'Esiste già un account con questa email. Accedi (anche con Google) oppure reimposta la password.';
    case 'weak_password': return 'Password troppo debole: usa almeno 8 caratteri.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return 'Troppi tentativi: riprova tra qualche minuto.';
    case 'signup_disabled': return 'La creazione di nuovi account è disattivata.';
    case 'validation_failed': return 'Controlla l’indirizzo email.';
    case 'same_password': return 'La nuova password deve essere diversa da quella attuale.';
    case 'reauthentication_needed': return 'Per sicurezza esci e accedi di nuovo, poi cambia la password.';
    case '42501': return 'Il tuo account non può modificare i volumi.';
    case '42P01':
    case 'PGRST205': return 'La tabella dei volumi non esiste ancora: esegui supabase/volumi.sql in Supabase.';
  }
  if (err?.status === 0 || /fetch/i.test(err?.message ?? '')) return 'Nessuna connessione: riprova.';
  return err?.message || 'Qualcosa è andato storto: riprova.';
}
const rethrow = (e: unknown): never => { throw new Error(authMessage(e)); };
const here = () => window.location.origin + window.location.pathname;

export class SupabaseRemote implements Remote {
  private db: SupabaseClient;
  constructor(url = URL_, key = KEY) {
    this.db = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
  }
  async getAccount() {
    const { data } = await this.db.auth.getSession();
    return toAccount(data.session?.user);
  }
  onAuthChange(cb: (a: Account | null) => void) {
    const { data } = this.db.auth.onAuthStateChange((_e, session) => cb(toAccount(session?.user)));
    return () => data.subscription.unsubscribe();
  }
  onPasswordRecovery(cb: () => void) {
    const { data } = this.db.auth.onAuthStateChange(e => { if (e === 'PASSWORD_RECOVERY') cb(); });
    return () => data.subscription.unsubscribe();
  }
  async signIn() {
    // Come back to this exact page (works at /Collezione/ on GitHub Pages and on localhost).
    const { error } = await this.db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: here() } });
    if (error) throw error;
  }
  async signInWithPassword(email: string, password: string) {
    const { error } = await this.db.auth.signInWithPassword({ email: email.trim(), password });
    if (error) rethrow(error);
  }
  async signUp(email: string, password: string): Promise<SignUpResult> {
    const { data, error } = await this.db.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: here() } });
    if (error) rethrow(error);
    // With email confirmation on, Supabase hides "already registered" by returning a user with no identities.
    if (data.user && data.user.identities?.length === 0) rethrow({ code: 'user_already_exists' });
    return data.session ? 'signed-in' : 'confirm-email';
  }
  async sendPasswordReset(email: string) {
    const { error } = await this.db.auth.resetPasswordForEmail(email.trim(), { redirectTo: here() });
    if (error) rethrow(error);
  }
  async setPassword(password: string) {
    const { error } = await this.db.auth.updateUser({ password });
    if (error) rethrow(error);
  }
  async signOut() {
    await this.db.auth.signOut();
  }
  async fetch(userId: string): Promise<State | null> {
    const { data, error } = await this.db.from('user_state').select('state').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return (data?.state as State | undefined) ?? null;
  }
  async put(userId: string, state: State) {
    const { error } = await this.db.from('user_state').upsert({ user_id: userId, state, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
  async fetchVolumi(): Promise<Record<string, string>> {
    const { data, error } = await this.db.from('volumi').select('id, text');
    if (error) throw error;
    return Object.fromEntries((data ?? []).map(r => [r.id as string, (r.text as string) ?? '']));
  }
  async putVolumi(id: string, text: string, byEmail: string) {
    const { error } = await this.db.from('volumi').upsert({ id, text, updated_by: byEmail, updated_at: new Date().toISOString() });
    if (error) rethrow(error);
  }
  async isEditor(email: string) {
    // Row-level security only ever returns your own row, so "any row" = "I'm an editor".
    const { data, error } = await this.db.from('editors').select('email').limit(1);
    if (error) return false;
    return (data ?? []).some(r => String(r.email).toLowerCase() === email.toLowerCase());
  }
}
