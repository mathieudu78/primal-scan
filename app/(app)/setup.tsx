import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Notice, Screen } from '../../src/ui/components';
import { GoalsForm } from '../../src/ui/GoalsForm';
import { useData } from '../../src/data/AppData';

/** Configuration initiale : profil et objectifs (modifiables ensuite à tout moment). */
export default function Setup() {
  const router = useRouter();
  const { settings, saveSettings } = useData();
  const [goals, setGoals] = useState(settings.goals);
  const [profile, setProfile] = useState(settings.profile);
  return (
    <Screen title="Bienvenue" subtitle="Configurez vos objectifs" back={false}
      footer={<Button label="Terminer" onPress={async () => { await saveSettings({ ...settings, goals, profile, setupDone: true }); router.replace('/'); }} />}>
      <Notice text="PRIMAL SCAN est un outil de suivi et d’analyse : il ne donne aucune recommandation. Fixez vos objectifs vous-même ou demandez une proposition de calcul." />
      <GoalsForm goals={goals} profile={profile} onChange={setGoals} onProfile={setProfile} />
    </Screen>
  );
}
