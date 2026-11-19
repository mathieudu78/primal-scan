/**
 * OCR local (ML Kit, gratuit, fonctionne hors ligne). Nécessite l'application installée (build EAS ou dev build) :
 * indisponible dans Expo Go, auquel cas on retourne null et l'interface propose la saisie manuelle.
 */
export async function recognizeText(imageUri: string): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-ml-kit/text-recognition');
    const TextRecognition = mod.default ?? mod;
    const res = await TextRecognition.recognize(imageUri);
    return typeof res?.text === 'string' ? res.text : null;
  } catch { return null; }
}
