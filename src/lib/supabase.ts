import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Vérification stricte
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERREUR CRITIQUE: Variables Supabase manquantes');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'défini' : 'MANQUANT');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'défini' : 'MANQUANT');
  throw new Error('Configuration Supabase manquante. Vérifiez les variables d\'environnement.');
}

export const isSupabaseConfigured = () => {
  return supabaseUrl.startsWith('https://') && supabaseAnonKey.length > 20;
};

export const validateSupabaseProject = () => {
  const projectMatch = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  const projectId = projectMatch ? projectMatch[1] : null;
  
  console.log('🔍 Projet Supabase:', projectId);
  return projectId === 'oupbuzbcvlouyaorwyfw';
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

console.log('✅ Supabase initialisé:', supabaseUrl);
