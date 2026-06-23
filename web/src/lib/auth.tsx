import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type Usuario } from './supabase';

interface AuthState {
  session: Session | null;
  perfil: Usuario | null;
  cargando: boolean;
  salir: () => Promise<void>;
}

const Ctx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  async function cargarPerfil(userId: string | undefined) {
    if (!userId) { setPerfil(null); return; }
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre, email, rol, activo')
      .eq('id', userId)
      .maybeSingle();
    setPerfil(data as Usuario | null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await cargarPerfil(data.session?.user.id);
      setCargando(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      await cargarPerfil(s?.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const salir = async () => { await supabase.auth.signOut(); };

  return (
    <Ctx.Provider value={{ session, perfil, cargando, salir }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}
