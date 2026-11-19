import React, { useRef, useState } from 'react';
import { ScrollView, View, type ScrollViewInstance } from 'react-native';
import { Button, Card, Chip, Field, Notice, Row, Screen, T } from '../../src/ui/components';
import { colors, radius } from '../../src/ui/theme';
import { useData } from '../../src/data/AppData';
import { useDay } from '../../src/ui/useDay';
import { LocalAssistant, SUGGESTIONS } from '../../src/engines/assistant';
import { toKey } from '../../src/ui/format';

interface Msg { from: 'user' | 'bot'; text: string }

/** Assistant nutritionnel 100 % local (aucune IA, aucun appel payant). Il explique, il ne conseille pas. */
export default function Assistant() {
  const { settings } = useData();
  const { data } = useDay(toKey(new Date()));
  const [msgs, setMsgs] = useState<Msg[]>([{ from: 'bot', text: 'Bonjour ! Je peux expliquer vos notes, les ingrédients, les vitamines et minéraux, et vos données du jour. Je ne donne pas de conseils.' }]);
  const [q, setQ] = useState('');
  const scroll = useRef<ScrollViewInstance>(null);
  const ask = async (text: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { from: 'user', text }]); setQ('');
    const a = await LocalAssistant.answer(text, { goals: settings.goals, today: data?.summary });
    setMsgs((m) => [...m, { from: 'bot', text: a }]);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  };
  return (
    <Screen title="Assistant" subtitle="Local · hors ligne · sans IA" scroll={false}
      footer={<Row><View style={{ flex: 1 }}><Field placeholder="Posez une question…" value={q} onChangeText={setQ} onSubmitEditing={() => ask(q)} returnKeyType="send" /></View><Button label="OK" onPress={() => ask(q)} style={{ paddingHorizontal: 18 }} /></Row>}>
      <ScrollView ref={scroll} contentContainerStyle={{ gap: 12, paddingBottom: 20 }} style={{ flex: 1 }}>
        {msgs.map((m, i) => (
          <View key={i} style={{ alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', backgroundColor: m.from === 'user' ? colors.forest : colors.surface, padding: 14, borderRadius: radius.lg }}>
            <T v="body">{m.text}</T>
          </View>
        ))}
        <Row gap={8} style={{ flexWrap: 'wrap' }}>{SUGGESTIONS.map((s) => <Chip key={s} label={s} onPress={() => ask(s)} />)}</Row>
        <Notice text="Une IA conversationnelle facultative pourra être branchée plus tard ; l’application reste pleinement fonctionnelle sans elle." />
        <Card tone="alt"><T v="caption">Aucun conseil n’est donné : seules les données, leurs notes et leurs calculs sont présentés.</T></Card>
      </ScrollView>
    </Screen>
  );
}
