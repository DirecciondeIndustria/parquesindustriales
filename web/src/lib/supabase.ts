import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env y completalos.',
  );
}

export const supabase = createClient(url, key);

export type Rol =
  | 'administrador' | 'director' | 'jefe_departamento'
  | 'mesa_entrada' | 'tecnico_administrativo' | 'inspector';

export interface Usuario {
  id: string;
  nombre: string;
  email: string | null;
  rol: Rol;
  rol_secundario: Rol | null;
  activo: boolean;
}
