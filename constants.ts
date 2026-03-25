
import { User, UserRole } from './types';

// Chaves do Supabase com fallback para as chaves atuais
// Em produção na Vercel, recomenda-se configurar VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Dashboard

export const STORAGE_KEYS = {
  AUTH: 'sgaft_auth',
  APPROACHES: 'sgaft_approaches',
  INDIVIDUALS: 'sgaft_individuals',
  GALLERY: 'sgaft_gallery'
};
