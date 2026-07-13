/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

// Retrieve variables from Vite or raw env fallbacks
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || (import.meta as any).env?.SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || (import.meta as any).env?.SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = supabaseUrl.trim() !== '' && supabaseAnonKey.trim() !== '';

// Gracefully instantiate client or null
// return=minimal avoids asking PostgREST to hand back the written row on
// insert/upsert. Returning the row forces Postgres to also re-check it
// against the table's SELECT RLS policy, and a couple of policies here call
// a SECURITY DEFINER function that self-joins the very table being written
// to — inside that same INSERT statement the just-inserted row isn't yet
// visible to the function's own lookup, so the policy spuriously fails
// ("new row violates row-level security policy") even though the write
// itself was allowed. Skipping the representation entirely sidesteps it.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Prefer: 'return=minimal' } }
    })
  : null;

if (!isSupabaseConfigured) {
  console.warn(
    'EROF COGES: Supabase credentials are not configured. The application is running in high-fidelity LOCAL DEMO MODE.'
  );
}
