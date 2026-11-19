import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Field, Notice, Screen, T } from '../../src/ui/components';
import { useAuth } from '../../src/auth/AuthProvider';

/** Écran « Code d’invitation » — vérifié côté serveur avant de créer le compte. */
export default function Invite() {
  const router = useRouter();
  const { checkInvite } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    const ok = await checkInvite(code.trim());
    setBusy(false);
    if (ok) router.push({ pathname: '/signup', params: { code: code.trim() } });
    else setErr('Code d’invitation invalide, expiré ou déjà utilisé.');
  };
  return (
    <Screen title="Code d’invitation" subtitle="Saisissez le code que vous avez reçu">
      <T v="caption">Chaque code est personnel et ne peut être utilisé qu’une seule fois.</T>
      <Field label="Code" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="PRIMAL-XXXX-XXXX-XXXX" error={err ?? undefined} />
      <Button label="Vérifier le code" loading={busy} disabled={code.trim().length < 8} onPress={submit} />
      <Notice text="La vérification est faite par le serveur. Le code sera consommé uniquement à la création réussie de votre compte." />
    </Screen>
  );
}
