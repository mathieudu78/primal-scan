import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Screen } from '../../src/ui/components';
import { GoalsForm } from '../../src/ui/GoalsForm';
import { useData } from '../../src/data/AppData';

export default function GoalsScreen() {
  const router = useRouter();
  const { settings, saveSettings } = useData();
  const [goals, setGoals] = useState(settings.goals);
  const [profile, setProfile] = useState(settings.profile);
  return (
    <Screen title="Objectifs" footer={<Button label="Enregistrer" onPress={async () => { await saveSettings({ ...settings, goals, profile }); router.back(); }} />}>
      <GoalsForm goals={goals} profile={profile} onChange={setGoals} onProfile={setProfile} />
      <Button variant="secondary" label="Cibles vitamines et minéraux" onPress={() => router.push('/micronutrients')} />
    </Screen>
  );
}
