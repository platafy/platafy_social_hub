import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const DEFAULT_URL = 'https://sabzbazyxfxorrfshhgf.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhYnpiYXp5eGZ4b3JyZnNoaGdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2OTQ5NjAsImV4cCI6MjEwNDI3MDk2MH0.6D3o1VP-PfQ86s-HhlBxyfchQNCoWGTuS7cRo8Zs1z8';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  (rawUrl && !rawUrl.includes('SEU_PROJECT_ID') && !rawUrl.includes('placeholder')) || DEFAULT_URL
);

const SUPABASE_URL = (rawUrl && !rawUrl.includes('SEU_PROJECT_ID') && !rawUrl.includes('placeholder')) 
  ? rawUrl 
  : DEFAULT_URL;

const SUPABASE_PUBLISHABLE_KEY = (rawKey && !rawKey.includes('SUA_PUBLISHABLE_KEY') && !rawKey.includes('placeholder')) 
  ? rawKey 
  : DEFAULT_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});