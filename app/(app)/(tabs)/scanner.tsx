import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Chip, Notice, Row, T } from '../../../src/ui/components';
import { colors, radius, space } from '../../../src/ui/theme';
import { useData } from '../../../src/data/AppData';
import { resolveBarcode, type ScanOutcome } from '../../../src/data/foodService';
import { barcodeFromQr, isValidGtin } from '../../../src/data/barcode';
import { extractIngredients, findGtin } from '../../../src/data/ocr';
import { recognizeText } from '../../../src/data/ocrEngine';

type Mode = 'barcode' | 'photo';

/** Scanner : codes-barres EAN/UPC, QR codes, photo d'emballage et photo des ingrédients (OCR local). Un produit à la fois. */
export default function Scanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { repo } = useData();
  const [perm, requestPerm] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>('barcode');
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<null | { kind: 'not_found' | 'offline' | 'ocr_unavailable' | 'nothing'; barcode?: string; text?: string }>(null);
  const [active, setActive] = useState(true);
  const lock = useRef(false);
  const cam = useRef<CameraView>(null);
  const sweep = useSharedValue(0);
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sweep.value * 180 }] }));

  useFocusEffect(useCallback(() => {
    setActive(true); lock.current = false; setProblem(null);
    sweep.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => { setActive(false); };
  }, [sweep]));

  const handleOutcome = (o: ScanOutcome, barcode?: string) => {
    if (o.kind === 'found') { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); router.push({ pathname: '/result', params: { foodId: o.food.id } }); lock.current = false; }
    else { setProblem({ kind: o.kind, barcode }); lock.current = false; }
  };

  const onCode = async ({ data, type }: { data: string; type: string }) => {
    if (lock.current || mode !== 'barcode') return; // un seul produit à la fois
    lock.current = true;
    const code = type === 'qr' ? barcodeFromQr(data) : data;
    if (!code || !isValidGtin(code.replace(/\D/g, '') || '')) { setProblem({ kind: 'nothing', text: type === 'qr' ? 'Ce QR code ne contient pas de code-barres produit.' : 'Code non reconnu.' }); lock.current = false; return; }
    setBusy('Recherche du produit…');
    const o = await resolveBarcode(repo, code);
    setBusy(null);
    handleOutcome(o, code);
  };

  const processImage = async (uri: string) => {
    setBusy('Lecture du texte…');
    const text = await recognizeText(uri);
    if (text === null) { setBusy(null); setProblem({ kind: 'ocr_unavailable' }); lock.current = false; return; }
    const gtin = findGtin(text);
    if (gtin) { setBusy('Recherche du produit…'); const o = await resolveBarcode(repo, gtin); setBusy(null); if (o.kind === 'found') return handleOutcome(o, gtin); }
    setBusy(null);
    const ingredients = extractIngredients(text);
    if (!ingredients && !gtin) { setProblem({ kind: 'nothing', text: 'Aucun code-barres ni liste d’ingrédients lisible sur cette photo.' }); lock.current = false; return; }
    lock.current = false;
    router.push({ pathname: '/manual-food', params: { ingredients: ingredients ?? '', barcode: gtin ?? '' } });
  };

  const takePhoto = async () => {
    if (lock.current || !cam.current) return; lock.current = true;
    try { const pic = await cam.current.takePictureAsync({ quality: 0.8, skipProcessing: false }); if (pic?.uri) await processImage(pic.uri); else lock.current = false; }
    catch { setBusy(null); lock.current = false; }
  };
  const pickPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!r.canceled && r.assets[0]) { lock.current = true; await processImage(r.assets[0].uri); }
  };

  if (!perm) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!perm.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.xl, paddingTop: insets.top + 60, gap: space.lg }}>
        <T v="title">Scanner</T>
        <Notice text="L’accès à la caméra est nécessaire pour scanner les codes-barres et les listes d’ingrédients. Les images sont analysées sur votre téléphone." />
        {perm.canAskAgain ? <Button label="Autoriser la caméra" onPress={requestPerm} /> : <Button label="Ouvrir les réglages" onPress={() => Linking.openSettings()} />}
        <Button variant="ghost" label="Rechercher manuellement" onPress={() => router.push('/search')} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {active ? (
        <CameraView ref={cam} style={{ flex: 1 }} facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
          onBarcodeScanned={mode === 'barcode' ? onCode : undefined} />
      ) : null}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 280, height: mode === 'barcode' ? 200 : 360, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.greenSoft, overflow: 'hidden' }}>
          {mode === 'barcode' ? <Animated.View style={[{ height: 2, backgroundColor: colors.greenSoft, opacity: 0.9 }, sweepStyle]} /> : null}
        </View>
        <T v="caption" style={{ color: colors.cream, marginTop: space.md, textAlign: 'center', paddingHorizontal: 40 }}>
          {mode === 'barcode' ? 'Placez le code-barres ou le QR code dans le cadre' : 'Photographiez la liste d’ingrédients (ou le code-barres imprimé)'}
        </T>
      </View>
      <View style={{ position: 'absolute', top: insets.top + 12, left: 0, right: 0, alignItems: 'center' }}>
        <Row gap={8} style={{ backgroundColor: colors.overlay, padding: 6, borderRadius: radius.pill }}>
          <Chip label="Code-barres / QR" active={mode === 'barcode'} onPress={() => setMode('barcode')} />
          <Chip label="Photo" active={mode === 'photo'} onPress={() => setMode('photo')} />
        </Row>
      </View>
      <View style={{ position: 'absolute', bottom: 110, left: space.xl, right: space.xl, gap: space.md }}>
        {busy ? <Card tone="alt"><Row><ActivityIndicator color={colors.green} /><T v="body">{busy}</T></Row></Card> : null}
        {problem ? (
          <Card tone="alt">
            {problem.kind === 'not_found' ? <><T v="heading">Produit inconnu</T><T v="caption">Le code {problem.barcode} n’est pas dans Open Food Facts. Vous pouvez photographier la liste d’ingrédients ou saisir les données (rien n’est inventé).</T></> : null}
            {problem.kind === 'offline' ? <><T v="heading">Pas de connexion</T><T v="caption">Ce produit n’est pas enregistré sur l’appareil et Internet est indisponible : l’analyse complète n’est pas possible. Vous pouvez saisir les données manuellement.</T></> : null}
            {problem.kind === 'ocr_unavailable' ? <><T v="heading">Lecture de texte indisponible</T><T v="caption">La reconnaissance de texte fonctionne dans l’application installée (pas dans Expo Go). Saisissez la liste d’ingrédients manuellement.</T></> : null}
            {problem.kind === 'nothing' ? <><T v="heading">Rien de lisible</T><T v="caption">{problem.text}</T></> : null}
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {problem.kind === 'not_found' || problem.kind === 'offline' ? <Button style={{ flex: 1 }} label="Saisir" variant="primary" onPress={() => { router.push({ pathname: '/manual-food', params: { barcode: problem.barcode ?? '' } }); setProblem(null); }} /> : null}
              {problem.kind === 'not_found' ? <Button style={{ flex: 1 }} label="Photo" variant="secondary" onPress={() => { setMode('photo'); setProblem(null); }} /> : null}
              <Button style={{ flex: 1 }} label="Rechercher" variant="secondary" onPress={() => { setProblem(null); router.push('/search'); }} />
              <Button style={{ flex: 1 }} label="Fermer" variant="ghost" onPress={() => setProblem(null)} />
            </Row>
          </Card>
        ) : null}
        {mode === 'photo' && !busy ? (
          <Row gap={space.md} style={{ justifyContent: 'center' }}>
            <Pressable onPress={pickPhoto} style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="images-outline" size={24} color={colors.cream} /></Pressable>
            <Pressable accessibilityLabel="Prendre la photo" onPress={takePhoto} style={{ width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.cream }} /></Pressable>
            <View style={{ width: 54 }} />
          </Row>
        ) : null}
      </View>
    </View>
  );
}
