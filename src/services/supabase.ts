import { createClient } from '@supabase/supabase-js';
import CONFIG from '@/lib/config';

export const supabase = createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'qafrica-auth-session',
    },
    global: {
      headers: {
        'Accept': 'application/json',
      },
    },
  }
);

export default supabase;
