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
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!isSupabaseConfigured) {
  console.warn(
    'EROF COGES: Supabase credentials are not configured. The application is running in high-fidelity LOCAL DEMO MODE.'
  );
}
