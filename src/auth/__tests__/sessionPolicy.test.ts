import { describe, expect, it } from 'vitest';
import { decide, friendlyAuthError, OFFLINE_MAX_MS, type PolicyContext } from '../sessionPolicy';

const T = 1_800_000_000_000;
const ctx = (over: Partial<PolicyContext> = {}): PolicyContext => ({ now: T, lastValidatedAt: T - 1000, maxClockSeen: T - 1000, ...over });

describe('politique de session', () => {
  it('serveur : active -> autorisé', () => expect(decide({ kind: 'server', status: 'active' }, ctx())).toEqual({ action: 'allow', offline: false }));
  it('serveur : revoked / disabled -> verrouillage immédiat', () => {
    expect(decide({ kind: 'server', status: 'revoked' }, ctx())).toEqual({ action: 'lock', reason: 'revoked' });
    expect(decide({ kind: 'server', status: 'disabled' }, ctx())).toEqual({ action: 'lock', reason: 'disabled' });
  });
  it('jeton refusé (401/403) = appareil révoqué', () => expect(decide({ kind: 'auth_rejected' }, ctx())).toEqual({ action: 'lock', reason: 'revoked' }));
  it('connecté mais pas encore enregistré -> réclamer la place', () => expect(decide({ kind: 'server', status: 'unclaimed' }, ctx())).toEqual({ action: 'claim' }));
  it('hors ligne dans la durée autorisée -> accès limité', () => {
    expect(decide({ kind: 'network_error' }, ctx({ lastValidatedAt: T - OFFLINE_MAX_MS + 1000 }))).toEqual({ action: 'allow', offline: true });
  });
  it('P. hors ligne trop longtemps -> verrouillé, ne contourne pas durablement la révocation', () => {
    expect(decide({ kind: 'network_error' }, ctx({ lastValidatedAt: T - OFFLINE_MAX_MS - 1 }))).toEqual({ action: 'lock', reason: 'offline_expired' });
    expect(decide({ kind: 'network_error' }, ctx({ lastValidatedAt: null }))).toEqual({ action: 'lock', reason: 'offline_expired' });
  });
  it('retour en arrière de l’horloge pour prolonger l’accès hors ligne -> verrouillé', () => {
    expect(decide({ kind: 'network_error' }, ctx({ now: T - 3 * 3600_000, lastValidatedAt: T - 3600_000, maxClockSeen: T }))).toEqual({ action: 'lock', reason: 'clock_tampered' });
  });
  it('au retour du réseau, une révocation est appliquée même après une période hors ligne valide', () => {
    expect(decide({ kind: 'network_error' }, ctx({ lastValidatedAt: T - 3600_000 })).action).toBe('allow');
    expect(decide({ kind: 'server', status: 'revoked' }, ctx({ lastValidatedAt: T - 3600_000 }))).toEqual({ action: 'lock', reason: 'revoked' });
  });
});

describe('messages', () => {
  it('erreurs d’inscription sans fuite d’information', () => {
    expect(friendlyAuthError('Database error saving new user', 'signup')).toMatch(/invitation/);
    expect(friendlyAuthError('Invalid login credentials', 'signin')).toBe('E-mail ou mot de passe incorrect.');
  });
});
