import { describe, expect, it } from 'vitest';
import { authMessage } from './supabase';

describe('authMessage', () => {
  it.each([
    ['invalid_credentials', 'Email o password non corretti.'],
    ['email_not_confirmed', /Conferma prima/],
    ['user_already_exists', /Esiste già un account/],
    ['weak_password', /almeno 8 caratteri/],
    ['over_email_send_rate_limit', /Troppi tentativi/],
  ])('%s', (code, expected) => expect(authMessage({ code })).toMatch(expected));
  it('falls back to the original message', () => expect(authMessage({ message: 'boh' })).toBe('boh'));
});
