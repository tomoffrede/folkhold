// The connection to Supabase. Other files import "supabase" from here.
// The library itself is the local file lib/supabase.js, loaded in index.html (it defines window.supabase).

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
