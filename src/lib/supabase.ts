import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = () => {
  const isConfigured = supabaseUrl && supabaseAnonKey && 
    supabaseUrl !== '' && supabaseAnonKey !== '' &&
    supabaseUrl.startsWith('https://') && 
    supabaseAnonKey.length > 20;
  
  if (!isConfigured) {
    console.warn('⚠️ Configuration Supabase Missan V3 incomplète:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      urlValid: supabaseUrl.startsWith('https://'),
      keyLength: supabaseAnonKey.length,
      projectId: 'aycqqlxjuczgewyuzrqb'
    });
  }
  
  return isConfigured;
};

// Vérifier la connexion au projet Missan V3
export const validateSupabaseProject = () => {
  if (!supabaseUrl) return false;
  
  // Extraire l'ID du projet depuis l'URL
  const projectMatch = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  const projectId = projectMatch ? projectMatch[1] : null;
  
  console.log('🔍 Projet Supabase détecté:', {
    url: supabaseUrl,
    projectId: projectId,
    expectedProjectId: 'oupbuzbcvlouyaorwyfw',
    isCorrectProject: projectId === 'oupbuzbcvlouyaorwyfw'
  });
  
  return projectId === 'oupbuzbcvlouyaorwyfw';
};

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : null;

// Log de connexion au démarrage
if (supabase && isSupabaseConfigured()) {
  const isValidProject = validateSupabaseProject();
  if (isValidProject) {
    console.log('✅ Supabase Missan V3 (oupbuzbcvlouyaorwyfw) configuré et prêt');
  } else {
    console.warn('⚠️ Projet Supabase incorrect - Attendu: oupbuzbcvlouyaorwyfw');
  }
} else {
  console.log('❌ Supabase Missan V3 non configuré');
}