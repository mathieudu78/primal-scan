import React, { useState } from 'react';
import { Alert, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Badge, Button, Card, Chip, Empty, Field, Notice, Row, Screen, SectionTitle, T } from '../../src/ui/components';
import { colors } from '../../src/ui/theme';
import { supabase } from '../../src/lib/supabase';
import { useLoad } from '../../src/ui/hooks';

type Expiry = 'none' | '24h' | '7d' | '30d' | 'custom';
type Status = 'available' | 'used' | 'expired' | 'revoked';
interface Inv { id: string; note: string | null; created_at: string; expires_at: string | null; status: Status; used_at: string | null; used_by_email: string | null; revoked_at: string | null }
const EXP: Array<[Expiry, string]> = [['none', 'Sans expiration'], ['24h', '24 heures'], ['7d', '7 jours'], ['30d', '30 jours'], ['custom', 'Date personnalisée']];
const LABEL: Record<Status, string> = { available: 'Disponible', used: 'Utilisé', expired: 'Expiré', revoked: 'Révoqué' };
const COLOR: Record<Status, string> = { available: colors.green, used: colors.beige, expired: colors.muted, revoked: colors.danger };
const dt = (s: string | null) => (s ? new Date(s).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

/** GESTION DES INVITATIONS (propriétaire). Les codes sont générés et vérifiés côté serveur ; seul leur hash est stocké. */
export default function AdminInvites() {
  const [expiry, setExpiry] = useState<Expiry>('7d');
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<{ code: string; expires_at: string | null } | null>(null);
  const [filter, setFilter] = useState<Status | 'all'>('available');
  const [error, setError] = useState<string | null>(null);
  const { data, reload } = useLoad(async () => {
    const { data: rows, error: e } = await supabase.rpc('admin_list_invitations');
    if (e) throw e; return rows as Inv[];
  }, []);

  const create = async () => {
    setBusy(true); setError(null);
    let p_custom: string | null = null;
    if (expiry === 'custom') {
      const d = new Date(`${custom}T23:59:00`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(custom) || isNaN(d.getTime()) || d.getTime() <= Date.now()) { setBusy(false); setError('Date invalide (format AAAA-MM-JJ, dans le futur).'); return; }
      p_custom = d.toISOString();
    }
    const { data: r, error: e } = await supabase.rpc('admin_create_invitation', { p_expiry: expiry, p_custom, p_note: note.trim() || null });
    setBusy(false);
    if (e || !r?.[0]) { setError('Création impossible : ' + (e?.message ?? 'erreur')); return; }
    setFresh({ code: r[0].code, expires_at: r[0].expires_at }); setNote(''); reload();
  };
  const revoke = (i: Inv) => Alert.alert('Révoquer ce code ?', 'Il ne pourra plus être utilisé.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Révoquer', style: 'destructive', onPress: async () => { await supabase.rpc('admin_revoke_invitation', { p_id: i.id }); reload(); } }]);
  const list = (data ?? []).filter((i) => filter === 'all' || i.status === filter);

  return (
    <Screen title="Gestion des invitations">
      <Card>
        <T v="label">Nouveau code</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>{EXP.map(([k, l]) => <Chip key={k} label={l} active={expiry === k} onPress={() => setExpiry(k)} />)}</Row>
        {expiry === 'custom' ? <Field label="Expire le (AAAA-MM-JJ)" value={custom} onChangeText={setCustom} placeholder="2026-12-31" /> : null}
        <Field label="Note (pour vous, facultatif)" value={note} onChangeText={setNote} placeholder="Ex. Mathieu" />
        {error ? <Notice tone="danger" text={error} /> : null}
        <Button label="Créer un code" icon="add-circle-outline" loading={busy} onPress={create} />
      </Card>

      {fresh ? (
        <Card tone="forest">
          <T v="label" style={{ color: colors.greenSoft }}>Code créé — affiché une seule fois</T>
          <T style={{ color: colors.cream, fontSize: 24, fontWeight: '700', letterSpacing: 1.5 }} selectable>{fresh.code}</T>
          <T v="caption" style={{ color: colors.greenSoft }}>Expire : {fresh.expires_at ? dt(fresh.expires_at) : 'jamais'} · Usage unique</T>
          <Row gap={8}>
            <Button style={{ flex: 1 }} variant="secondary" label="Copier" icon="copy-outline" onPress={() => Clipboard.setStringAsync(fresh.code)} />
            <Button style={{ flex: 1 }} variant="secondary" label="Partager" icon="share-outline" onPress={() => Share.share({ message: `Votre code d’invitation PRIMAL SCAN : ${fresh.code}` })} />
          </Row>
          <Notice text="Le serveur ne conserve que l’empreinte du code : il ne pourra plus vous le réafficher. Copiez-le maintenant." />
        </Card>
      ) : null}

      <SectionTitle>Codes</SectionTitle>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {(['available', 'used', 'expired', 'revoked', 'all'] as const).map((s) => <Chip key={s} label={s === 'all' ? 'Tous' : LABEL[s] + 's'.replace('Disponible', '')} active={filter === s} onPress={() => setFilter(s)} />)}
      </Row>
      {!list.length ? <Empty icon="key-outline" title="Aucun code" /> : list.map((i) => (
        <Card key={i.id} style={{ paddingVertical: 14, gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}><T v="body" style={{ fontWeight: '600' }}>{i.note || 'Sans note'}</T><Badge text={LABEL[i.status]} color={COLOR[i.status]} /></Row>
          <T v="caption">Créé : {dt(i.created_at)} · Expiration : {i.expires_at ? dt(i.expires_at) : 'aucune'}</T>
          {i.status === 'used' ? <T v="caption">Utilisé le {dt(i.used_at)} par {i.used_by_email ?? '—'}</T> : null}
          {i.status === 'revoked' ? <T v="caption">Révoqué le {dt(i.revoked_at)}</T> : null}
          {i.status === 'available' ? <Button variant="ghost" label="Révoquer" style={{ minHeight: 40, paddingVertical: 8 }} onPress={() => revoke(i)} /> : null}
        </Card>
      ))}
      <View />
    </Screen>
  );
}
