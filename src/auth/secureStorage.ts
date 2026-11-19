import * as SecureStore from 'expo-secure-store';

/** SecureStore limite chaque valeur à ~2 Ko : on découpe la session Supabase en morceaux. */
const CHUNK = 1800;
const opts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export const secureAdapter = {
  async getItem(key: string): Promise<string | null> {
    const n = await SecureStore.getItemAsync(`${key}.n`, opts);
    if (n === null) return SecureStore.getItemAsync(key, opts);
    let out = '';
    for (let i = 0; i < Number(n); i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`, opts);
      if (part === null) return null;
      out += part;
    }
    return out;
  },
  async setItem(key: string, value: string): Promise<void> {
    await this.removeItem(key);
    const parts = Math.max(1, Math.ceil(value.length / CHUNK));
    for (let i = 0; i < parts; i++) await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK), opts);
    await SecureStore.setItemAsync(`${key}.n`, String(parts), opts);
  },
  async removeItem(key: string): Promise<void> {
    const n = await SecureStore.getItemAsync(`${key}.n`, opts);
    for (let i = 0; i < Number(n ?? 0); i++) await SecureStore.deleteItemAsync(`${key}.${i}`, opts);
    await SecureStore.deleteItemAsync(`${key}.n`, opts);
    await SecureStore.deleteItemAsync(key, opts).catch(() => {});
  },
};

export async function secureGet(key: string) { return SecureStore.getItemAsync(key, opts); }
export async function secureSet(key: string, value: string) { await SecureStore.setItemAsync(key, value, opts); }
export async function secureDelete(key: string) { await SecureStore.deleteItemAsync(key, opts); }
