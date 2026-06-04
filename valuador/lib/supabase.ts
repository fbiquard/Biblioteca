import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Cliente Supabase OPCIONAL. Si no hay variables de entorno, devolvemos null
// y la app cae a localStorage. Esto permite correr el MVP sin configurar nada.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: false },
    });
  }
  return client;
}

export const isSupabaseEnabled = Boolean(url && anonKey);
