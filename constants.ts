
import { User, UserRole } from './types';

// Chaves do Supabase com fallback para as chaves atuais
// Em produção na Vercel, recomenda-se configurar VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Dashboard
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://moktyclwhfcrrneoxysy.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1va3R5Y2x3aGZjcnJuZW94eXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNjg3NDMsImV4cCI6MjA4Njc0NDc0M30.tCOc3qPClsrf6hAEm4aq5XJQRODIrINcVUEsepf_MOA';

export const STORAGE_KEYS = {
  AUTH: 'sgaft_auth',
  APPROACHES: 'sgaft_approaches',
  INDIVIDUALS: 'sgaft_individuals',
  GALLERY: 'sgaft_gallery'
};
