import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type Usuario } from './supabase';

interface AuthState {
  session: Session | null;
  perfil: Usuario | null;          // personal interno (null si es cuenta de empresa)
  empresaId: string | null;        // empresa de la cuenta externa (null si es interna)
  cargando: boolean;
  recovery: boolean;               // sesión iniciada desde el enlace de recuperar contraseña
  salir: () => Promise<void>;
}

const Ctx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [recovery, setRecovery] = useState(false);

  async function cargarContexto(userId: string | undefined) {
    if (!userId) { setPerfil(null); setEmpresaId(null); return; }
    const { data: u } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setPerfil(u as Usuario | null);

    // Si no es personal interno, ver si es una cuenta de empresa (portal externo).
    if (!u) {
      const { data: acc } = await supabase
        .from('empresa_accesos')
        .select('empresa_id')
        .eq('user_id', userId)
        .eq('activo', true)
        .maybeSingle();
      setEmpresaId((acc?.empresa_id as string) ?? null);
    } else {
      setEmpresaId(null);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await cargarContexto(data.session?.user.id);
      setCargando(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (e, s) => {
      if (e === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s);
      await cargarContexto(s?.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const salir = async () => { await supabase.auth.signOut(); };

  return (
    <Ctx.Provider value={{ session, perfil, empresaId, cargando, recovery, salir }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}
