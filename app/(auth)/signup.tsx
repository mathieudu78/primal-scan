import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Field, Notice, Screen } from '../../src/ui/components';
import { useAuth } from '../../src/auth/AuthProvider';

export default function Signup() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const mismatch = pw2.length > 0 && pw !== pw2;
  const valid = /.+@.+\..+/.test(email) && pw.length >= 8 && pw === pw2;
  const submit = async () => {
    setBusy(true); setErr(null);
    const r = await signUp({ code: String(code), email, password: pw, name: name.trim() || undefined });
    setBusy(false);
    if (!r.ok) setErr(r.message ?? 'Erreur');
    else if (r.needsEmailConfirmation) setConfirm(true);
  };
  if (confirm) {
    return (
      <Screen title="Vérifiez vos e-mails" back={false}>
        <Notice text="Un e-mail de confirmation vous a été envoyé. Confirmez votre adresse puis connectez-vous." />
        <Button label="Aller à la connexion" onPress={() => router.replace('/login')} />
      </Screen>
    );
  }
  return (
    <Screen title="Créer votre compte" subtitle="Votre code est valide">
      <Field label="Prénom (facultatif)" value={name} onChangeText={setName} autoComplete="given-name" />
      <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Mot de passe (8 caractères min.)" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" />
      <Field label="Confirmer le mot de passe" value={pw2} onChangeText={setPw2} secureTextEntry error={mismatch ? 'Les mots de passe diffèrent' : undefined} />
      {err ? <Notice tone="danger" text={err} /> : null}
      <Button label="Créer mon compte" loading={busy} disabled={!valid} onPress={submit} />
      <Notice text="Votre compte ne peut être utilisé que sur un seul appareil à la fois : se connecter ailleurs déconnecte automatiquement l’appareil précédent." />
    </Screen>
  );
}
