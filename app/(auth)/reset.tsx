import React, { useState } from 'react';
import { Button, Field, Notice, Screen } from '../../src/ui/components';
import { useAuth } from '../../src/auth/AuthProvider';

/** Récupération par code à 6 chiffres envoyé par e-mail (aucun lien profond nécessaire). */
export default function Reset() {
  const { requestReset, confirmReset } = useAuth();
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false);
  const [token, setToken] = useState(''); const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);

  const send = async () => { setBusy(true); setErr(null); const r = await requestReset(email); setBusy(false); if (r.ok) setSent(true); else setErr(r.message ?? 'Erreur'); };
  const confirm = async () => { setBusy(true); setErr(null); const r = await confirmReset(email, token, pw); setBusy(false); if (!r.ok) setErr(r.message ?? 'Erreur'); };
  return (
    <Screen title="Mot de passe oublié">
      <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" editable={!sent} />
      {!sent ? <Button label="Recevoir un code" loading={busy} disabled={!/.+@.+\..+/.test(email)} onPress={send} /> : (
        <>
          <Notice text="Si un compte existe pour cet e-mail, un code vient d’être envoyé." />
          <Field label="Code reçu" value={token} onChangeText={setToken} keyboardType="number-pad" />
          <Field label="Nouveau mot de passe (8 caractères min.)" value={pw} onChangeText={setPw} secureTextEntry />
          <Button label="Changer le mot de passe" loading={busy} disabled={token.length < 6 || pw.length < 8} onPress={confirm} />
        </>
      )}
      {err ? <Notice tone="danger" text={err} /> : null}
    </Screen>
  );
}
