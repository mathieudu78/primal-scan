import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Field, Notice, Screen, T } from '../../src/ui/components';
import { useAuth } from '../../src/auth/AuthProvider';

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    const r = await signIn(email, pw);
    setBusy(false);
    if (!r.ok) setErr(r.message ?? 'Erreur');
  };
  return (
    <Screen title="Connexion">
      <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Mot de passe" value={pw} onChangeText={setPw} secureTextEntry autoComplete="current-password" />
      {err ? <Notice tone="danger" text={err} /> : null}
      <Button label="Se connecter" loading={busy} disabled={!email || !pw} onPress={submit} />
      <Button label="Mot de passe oublié ?" variant="ghost" onPress={() => router.push('/reset')} />
      <T v="caption">Si ce compte est déjà connecté sur un autre appareil, celui-ci sera automatiquement déconnecté.</T>
    </Screen>
  );
}
