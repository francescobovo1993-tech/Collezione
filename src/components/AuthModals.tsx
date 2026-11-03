import { useState } from 'react';
import type { SignUpResult } from '../lib/sync';
import { Modal } from './Modal';

export interface AuthApi {
  signIn(): Promise<void>; // Google
  signInWithPassword(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<SignUpResult>;
  sendPasswordReset(email: string): Promise<void>;
}

type Mode = 'login' | 'signup' | 'reset';
const TITLE: Record<Mode, string> = { login: 'Accedi', signup: 'Crea un account', reset: 'Reimposta la password' };
const SUB: Record<Mode, string> = {
  login: 'Le tue spunte saranno sincronizzate su tutti i tuoi dispositivi.',
  signup: 'Se poi accedi con Google usando la stessa email, è lo stesso account.',
  reset: 'Ti mandiamo un link per scegliere una nuova password.',
};
const MIN = 8;
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function LoginModal({ api, onClose, toast }: { api: AuthApi; onClose: () => void; toast: (m: string) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const go = (m: Mode) => { setMode(m); setError(''); setInfo(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Inserisci un indirizzo email valido.'); return; }
    if (mode !== 'reset' && password.length < (mode === 'signup' ? MIN : 1)) {
      setError(mode === 'signup' ? `La password deve avere almeno ${MIN} caratteri.` : 'Inserisci la password.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await api.signInWithPassword(email, password);
        toast('Accesso effettuato.');
        onClose();
      } else if (mode === 'signup') {
        const r = await api.signUp(email, password);
        if (r === 'signed-in') { toast('Account creato.'); onClose(); }
        else setInfo(`Ti abbiamo mandato un’email a ${email.trim()}: apri il link per confermare l’account, poi accedi.`);
      } else {
        await api.sendPasswordReset(email);
        setInfo(`Se esiste un account per ${email.trim()}, riceverai un’email con il link per scegliere una nuova password.`);
      }
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal labelledBy="authTitle" onClose={onClose}>
      <h2 id="authTitle">{TITLE[mode]}</h2>
      <p className="sub">{SUB[mode]}</p>
      {mode !== 'reset' && (
        <>
          <button type="button" className="btn google wide" onClick={() => { void api.signIn(); }}><GoogleG />Continua con Google</button>
          <div className="or"><span>oppure</span></div>
        </>
      )}
      <form onSubmit={submit} noValidate>
        <div className="stack">
          <div className="field">
            <label htmlFor="authEmail">Email</label>
            <input id="authEmail" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          {mode !== 'reset' && (
            <div className="field">
              <label htmlFor="authPw">Password{mode === 'signup' ? ` (almeno ${MIN} caratteri)` : ''}</label>
              <input id="authPw" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} />
            </div>
          )}
        </div>
        {error && <div className="form-msg err" role="alert">{error}</div>}
        {info && <div className="form-msg ok" role="status">{info}</div>}
        <div className="actions">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'Attendi…' : mode === 'login' ? 'Accedi' : mode === 'signup' ? 'Crea account' : 'Mandami il link'}
          </button>
        </div>
      </form>
      <div className="auth-links">
        {mode === 'login' && <>
          <button type="button" className="btn link" onClick={() => go('reset')}>Password dimenticata?</button>
          <span>Non hai un account? <button type="button" className="btn link" onClick={() => go('signup')}>Creane uno</button></span>
        </>}
        {mode !== 'login' && <button type="button" className="btn link" onClick={() => go('login')}>← Torna all’accesso</button>}
      </div>
    </Modal>
  );
}

/** Set a password: new users from a reset link, or Google users adding password sign-in. */
export function PasswordModal({ email, recovery, onSave, onClose, toast }: {
  email: string; recovery: boolean; onSave: (pw: string) => Promise<void>; onClose: () => void; toast: (m: string) => void;
}) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pw.length < MIN) { setError(`La password deve avere almeno ${MIN} caratteri.`); return; }
    if (pw !== pw2) { setError('Le due password non coincidono.'); return; }
    setBusy(true);
    try {
      await onSave(pw);
      toast('Password salvata.');
      onClose();
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal labelledBy="pwTitle" onClose={onClose}>
      <h2 id="pwTitle">{recovery ? 'Scegli una nuova password' : 'Password'}</h2>
      <p className="sub">
        {recovery ? `Per l’account ${email}.` : <>Dopo potrai accedere anche con <b>{email}</b> e questa password. È lo stesso account: Google continua a funzionare.</>}
      </p>
      <form onSubmit={submit} noValidate>
        <div className="stack">
          <input type="email" autoComplete="username" value={email} readOnly hidden />
          <div className="field">
            <label htmlFor="pwNew">Nuova password (almeno {MIN} caratteri)</label>
            <input id="pwNew" type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pwNew2">Ripeti la password</label>
            <input id="pwNew2" type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} />
          </div>
        </div>
        {error && <div className="form-msg err" role="alert">{error}</div>}
        <div className="actions"><button className="btn primary" type="submit" disabled={busy}>{busy ? 'Salvo…' : 'Salva password'}</button></div>
      </form>
    </Modal>
  );
}

export const GoogleG = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);
