import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { secureAdapter } from '../auth/secureStorage';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

export const supabase = createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_ANON_KEY || 'placeholder-anon-key-placeholder', {
  auth: { storage: secureAdapter, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
