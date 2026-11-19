import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { secureGet, secureSet } from './secureStorage';

/**
 * Identifiant d'installation généré aléatoirement et gardé dans le coffre sécurisé (Keychain / Keystore).
 * Ce n'est PAS une preuve de sécurité : la vraie protection est la session côté serveur.
 * Il sert à reconnaître "le même appareil" pour l'affichage administrateur.
 */
const KEY = 'primal.device_id';
export async function getDeviceId(): Promise<string> {
  let id = await secureGet(KEY);
  if (!id) {
    const bytes = new Uint8Array(24);
    globalThis.crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    await secureSet(KEY, id);
  }
  return id;
}
export function deviceLabel(): { label: string; platform: string } {
  return { label: [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || Application.applicationName || 'Appareil', platform: Platform.OS };
}
