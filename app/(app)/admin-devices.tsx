import React from 'react';
import { Alert } from 'react-native';
import { Badge, Button, Card, Empty, Row, Screen, T } from '../../src/ui/components';
import { colors } from '../../src/ui/theme';
import { supabase } from '../../src/lib/supabase';
import { useLoad } from '../../src/ui/hooks';

interface Dev { user_id: string; email: string; display_name: string | null; role: string; account_status: 'active' | 'disabled'; device_label: string | null; platform: string | null; device_short: string | null; logged_in_at: string | null; last_seen_at: string | null; session_status: 'active' | 'revoked' | 'none' }
const dt = (s: string | null) => (s ? new Date(s).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

/** GESTION DES APPAREILS (propriétaire) : appareil actif de chaque compte, révocation, désactivation. */
export default function AdminDevices() {
  const { data, reload } = useLoad(async () => {
    const { data: rows, error } = await supabase.rpc('admin_list_devices'); if (error) throw error; return rows as Dev[];
  }, []);
  const revoke = (d: Dev) => Alert.alert('Révoquer la session ?', `${d.email} sera déconnecté de son appareil.`, [{ text: 'Annuler', style: 'cancel' }, { text: 'Révoquer', style: 'destructive', onPress: async () => { await supabase.rpc('admin_revoke_session', { p_user: d.user_id }); reload(); } }]);
  const toggle = (d: Dev) => {
    const disable = d.account_status === 'active';
    Alert.alert(disable ? 'Désactiver ce compte ?' : 'Réactiver ce compte ?', d.email, [{ text: 'Annuler', style: 'cancel' }, { text: disable ? 'Désactiver' : 'Réactiver', style: disable ? 'destructive' : 'default', onPress: async () => { await supabase.rpc('admin_set_account_status', { p_user: d.user_id, p_disabled: disable }); reload(); } }]);
  };
  return (
    <Screen title="Gestion des appareils" subtitle="Un seul appareil actif par compte">
      {!data?.length ? <Empty icon="phone-portrait-outline" title="Aucun compte" /> : data.map((d) => (
        <Card key={d.user_id} style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="body" style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>{d.display_name ? `${d.display_name} · ` : ''}{d.email}</T>
            {d.role === 'owner' ? <Badge text="Propriétaire" color={colors.beige} /> : null}
          </Row>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Badge text={d.account_status === 'active' ? 'Compte actif' : 'Compte désactivé'} color={d.account_status === 'active' ? colors.green : colors.danger} />
            <Badge text={d.session_status === 'active' ? 'Session active' : d.session_status === 'revoked' ? 'Session révoquée' : 'Jamais connecté'} color={d.session_status === 'active' ? colors.greenSoft : colors.muted} />
          </Row>
          <T v="caption">Appareil : {d.device_label ?? '—'} ({d.platform ?? '—'}){d.device_short ? ` · #${d.device_short}` : ''}</T>
          <T v="caption">Dernière connexion : {dt(d.logged_in_at)} · Dernière activité : {dt(d.last_seen_at)}</T>
          {d.role !== 'owner' ? (
            <Row gap={8}>
              <Button style={{ flex: 1, minHeight: 40, paddingVertical: 8 }} variant="secondary" label="Révoquer la session" disabled={d.session_status !== 'active'} onPress={() => revoke(d)} />
              <Button style={{ flex: 1, minHeight: 40, paddingVertical: 8 }} variant="ghost" label={d.account_status === 'active' ? 'Désactiver' : 'Réactiver'} onPress={() => toggle(d)} />
            </Row>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
