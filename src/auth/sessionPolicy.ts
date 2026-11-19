/**
 * Politique d'accès, pure et testable (aucun accès réseau / stockage ici).
 *
 * LIMITE À CONNAÎTRE : un téléphone totalement hors ligne ne peut pas apprendre
 * qu'il a été révoqué. On borne donc la durée pendant laquelle un appareil peut
 * rester "autorisé" sans contact avec le serveur (OFFLINE_MAX_MS) ; au-delà, les
 * données privées sont verrouillées jusqu'à une reconnexion validée par le serveur.
 */
export const OFFLINE_MAX_MS = 48 * 60 * 60 * 1000; // 48 h
export const HEARTBEAT_MS = 20 * 1000;             // vérification toutes les 20 s (appli au premier plan)
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export type ServerStatus = 'active' | 'revoked' | 'disabled' | 'unclaimed' | 'none';
export type LockReason = 'revoked' | 'disabled' | 'offline_expired' | 'clock_tampered';

export type Heartbeat =
  | { kind: 'server'; status: ServerStatus }
  | { kind: 'network_error' }
  | { kind: 'auth_rejected' };   // 401/403 : jeton refusé par le serveur

export type Decision =
  | { action: 'allow'; offline: boolean }
  | { action: 'claim' }                       // connecté mais pas encore enregistré comme appareil actif
  | { action: 'lock'; reason: LockReason }
  | { action: 'signout' };                    // plus de session valide

export interface PolicyContext {
  now: number;
  /** dernière validation réussie par le serveur (ms) */
  lastValidatedAt: number | null;
  /** plus grande heure d'horloge jamais observée (détection de retour en arrière) */
  maxClockSeen: number | null;
}

export function decide(h: Heartbeat, ctx: PolicyContext): Decision {
  if (ctx.maxClockSeen !== null && ctx.now < ctx.maxClockSeen - CLOCK_SKEW_MS && h.kind === 'network_error') {
    return { action: 'lock', reason: 'clock_tampered' };
  }
  switch (h.kind) {
    case 'server':
      switch (h.status) {
        case 'active': return { action: 'allow', offline: false };
        case 'unclaimed': return { action: 'claim' };
        case 'revoked': return { action: 'lock', reason: 'revoked' };
        case 'disabled': return { action: 'lock', reason: 'disabled' };
        case 'none': return { action: 'signout' };
      }
      return { action: 'signout' };
    case 'auth_rejected':
      // Jeton invalide/expiré côté serveur : l'ancien appareil est déconnecté
      return { action: 'lock', reason: 'revoked' };
    case 'network_error':
      if (ctx.lastValidatedAt !== null && ctx.now - ctx.lastValidatedAt <= OFFLINE_MAX_MS && ctx.now >= ctx.lastValidatedAt - CLOCK_SKEW_MS) {
        return { action: 'allow', offline: true };
      }
      return { action: 'lock', reason: 'offline_expired' };
  }
}

export const LOCK_MESSAGES: Record<LockReason, { title: string; body: string }> = {
  revoked: {
    title: 'Session terminée',
    body: 'Votre compte PRIMAL SCAN a été connecté sur un autre appareil. Pour continuer à utiliser votre compte, veuillez vous reconnecter.',
  },
  disabled: { title: 'Compte désactivé', body: 'Ce compte a été désactivé. Contactez le propriétaire de PRIMAL SCAN.' },
  offline_expired: {
    title: 'Vérification requise',
    body: 'Cet appareil n’a pas pu confirmer sa session depuis trop longtemps. Connectez-vous à Internet puis reconnectez-vous pour déverrouiller vos données.',
  },
  clock_tampered: { title: 'Horloge incohérente', body: 'L’heure de l’appareil semble avoir été modifiée. Connectez-vous à Internet pour vérifier votre session.' },
};

/** Traduit les erreurs d'inscription/connexion Supabase en messages clairs (sans fuite d'information). */
export function friendlyAuthError(message: string | undefined, ctx: 'signup' | 'signin' | 'other' = 'other'): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invite_invalid') || (ctx === 'signup' && m.includes('database error'))) return 'Code d’invitation invalide, expiré ou déjà utilisé.';
  if (m.includes('invalid login')) return 'E-mail ou mot de passe incorrect.';
  if (m.includes('account_disabled')) return 'Ce compte a été désactivé.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Un compte existe déjà avec cet e-mail.';
  if (m.includes('password') && m.includes('characters')) return 'Mot de passe trop court (8 caractères minimum).';
  if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives. Réessayez dans quelques minutes.';
  if (m.includes('network') || m.includes('fetch')) return 'Connexion Internet indisponible.';
  if (m.includes('email not confirmed')) return 'Confirmez votre e-mail avant de vous connecter.';
  return 'Une erreur est survenue. Réessayez.';
}
