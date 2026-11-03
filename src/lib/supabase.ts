import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Account, Remote } from './sync';
import type { State } from './types';

const URL_ = import.meta.env.VITE_SUPABASE_URL ?? '';
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

const toAccount = (u: User | null | undefined): Account | null =>
  u ? { id: u.id, email: u.email ?? '', name: (u.user_metadata?.full_name as string) || (u.user_metadata?.name as string) || u.email || '' } : null;

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
  async signIn() {
    // Come back to this exact page (works at /Collezione/ on GitHub Pages and on localhost).
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await this.db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) throw error;
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
}
