import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { usePermisos } from '../lib/permisos';
import { Boton, Campo, inputCls, EncabezadoPagina } from '../components/ui';

interface UsuarioMin { id: string; nombre: string; }
interface Delegacion {
  id: string; de_usuario: string; a_usuario: string;
  desde: string; hasta: string | null; estado: string;
}

const hoy = () => new Date().toISOString().slice(0, 10);

export default function MiCuenta() {
  const { perfil } = useAuth();
  const { esAdmin } = usePermisos();
  const qc = useQueryClient();
  const [pass, setPass] = useState({ a: '', b: '' });
  const [msg, setMsg] = useState('');
  const puedeDelegar = perfil?.rol === 'mesa_entrada' || esAdmin;

  const cambiarPass = useMutation({
    mutationFn: async () => {
      if (pass.a.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
      if (pass.a !== pass.b) throw new Error('Las contraseñas no coinciden.');
      const { error } = await supabase.auth.updateUser({ password: pass.a });
      if (error) throw error;
    },
    onSuccess: () => { setPass({ a: '', b: '' }); setMsg('Contraseña actualizada correctamente.'); },
    onError: (e: Error) => setMsg(e.message),
  });

  return (
    <div className="max-w-2xl">
      <EncabezadoPagina titulo="Mi cuenta" descripcion={perfil?.nombre ?? ''} />

      {/* Datos */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div><div className="text-xs text-slate-400">Nombre</div><div className="font-medium text-slate-800">{perfil?.nombre}</div></div>
          <div><div className="text-xs text-slate-400">Email</div><div className="font-medium text-slate-800">{perfil?.email ?? '—'}</div></div>
          <div><div className="text-xs text-slate-400">Rol principal</div><div className="font-medium text-slate-800 capitalize">{perfil?.rol?.replace(/_/g, ' ')}</div></div>
          <div><div className="text-xs text-slate-400">Rol secundario</div><div className="font-medium text-slate-800 capitalize">{perfil?.rol_secundario?.replace(/_/g, ' ') ?? '—'}</div></div>
        </div>
      </div>

      {/* Delegaciones recibidas (consentimiento) — para cualquier usuario */}
      {perfil && <DelegacionesRecibidas miId={perfil.id} qc={qc} />}

      {/* Cambiar contraseña */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-slate-800 mb-3">Cambiar mi contraseña</h2>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setMsg(''); cambiarPass.mutate(); }} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo label="Nueva contraseña (mín. 6)">
              <input className={inputCls} type="password" required minLength={6} value={pass.a} onChange={(e) => setPass({ ...pass, a: e.target.value })} />
            </Campo>
            <Campo label="Repetir contraseña">
              <input className={inputCls} type="password" required value={pass.b} onChange={(e) => setPass({ ...pass, b: e.target.value })} />
            </Campo>
          </div>
          {msg && <p className={`text-sm ${cambiarPass.isError ? 'text-red-600' : 'text-emerald-600'}`}>{msg}</p>}
          <Boton type="submit" disabled={cambiarPass.isPending}>{cambiarPass.isPending ? 'Guardando…' : 'Actualizar contraseña'}</Boton>
        </form>
      </div>

      {/* Delegar mesa de entrada (solo Mesa de Entrada principal o admin) */}
      {puedeDelegar && perfil && <DelegacionMesa miId={perfil.id} qc={qc} />}
    </div>
  );
}

// ─────────── Panel de delegaciones recibidas (el receptor acepta/rechaza) ───────────
function DelegacionesRecibidas({ miId, qc }: { miId: string; qc: ReturnType<typeof useQueryClient> }) {
  const { data: agentes = [] } = useQuery({
    queryKey: ['agentes-min'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_agentes');
      if (error) throw error;
      return data as UsuarioMin[];
    },
  });
  const { data: pendientes = [] } = useQuery({
    queryKey: ['delegaciones-recibidas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('delegaciones_mesa').select('*')
        .eq('a_usuario', miId).eq('estado', 'pendiente').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Delegacion[];
    },
  });
  const refresca = () => qc.invalidateQueries({ queryKey: ['delegaciones-recibidas'] });
  const nombre = (id: string) => agentes.find((a) => a.id === id)?.nombre ?? 'Mesa de Entrada';

  // Realtime: aviso cuando me delegan
  useEffect(() => {
    const ch = supabase.channel('deleg_in_' + miId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'delegaciones_mesa', filter: 'a_usuario=eq.' + miId }, () => {
        try { new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { /* noop */ }
        refresca();
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miId]);

  const aceptar = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.rpc('aceptar_delegacion_mesa', { p_id: id }); if (error) throw error; },
    onSuccess: refresca,
  });
  const rechazar = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.rpc('rechazar_delegacion_mesa', { p_id: id }); if (error) throw error; },
    onSuccess: refresca,
  });

  if (pendientes.length === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
      <h2 className="font-semibold text-amber-800 mb-1">Delegación de Mesa de Entrada pendiente</h2>
      <p className="text-sm text-amber-700 mb-3">Te están delegando la función de Mesa de Entrada. Aceptala para poder operarla.</p>
      <div className="space-y-2">
        {pendientes.map((d) => (
          <div key={d.id} className="flex items-center gap-2 text-sm bg-white border border-amber-200 rounded-lg px-3 py-2">
            <span className="flex-1 text-slate-700">
              <strong>{nombre(d.de_usuario)}</strong> · {d.desde}{d.hasta ? ` → ${d.hasta}` : ' (sin fin)'}
            </span>
            <Boton onClick={() => aceptar.mutate(d.id)} disabled={aceptar.isPending}>Aceptar</Boton>
            <button onClick={() => rechazar.mutate(d.id)} className="text-sm text-red-600 hover:underline px-2">Rechazar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────── Delegar mesa de entrada (Mesa de Entrada principal / admin) ───────────
function DelegacionMesa({ miId, qc }: { miId: string; qc: ReturnType<typeof useQueryClient> }) {
  const [form, setForm] = useState({ a_usuario: '', desde: hoy(), hasta: '' });
  const [err, setErr] = useState('');

  const { data: agentes = [] } = useQuery({
    queryKey: ['agentes-min'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_agentes');
      if (error) throw error;
      return data as UsuarioMin[];
    },
  });
  const { data: delegaciones = [] } = useQuery({
    queryKey: ['mis-delegaciones'],
    queryFn: async () => {
      const { data, error } = await supabase.from('delegaciones_mesa').select('*').eq('de_usuario', miId).order('created_at', { ascending: false });
      if (error) throw error;
      return data as Delegacion[];
    },
  });
  const nombre = (id: string) => agentes.find((a) => a.id === id)?.nombre ?? id.slice(0, 8);
  const refresca = () => qc.invalidateQueries({ queryKey: ['mis-delegaciones'] });

  const delegar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('delegar_mesa', {
        p_a: form.a_usuario, p_desde: form.desde, p_hasta: form.hasta || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setForm({ ...form, a_usuario: '', hasta: '' }); setErr(''); refresca(); },
    onError: (e: Error) => setErr(e.message),
  });
  const revocar = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.rpc('revocar_delegacion_mesa', { p_id: id }); if (error) throw error; },
    onSuccess: refresca,
  });

  const ESTADO: Record<string, { label: string; cls: string }> = {
    pendiente: { label: 'Pendiente de aceptación', cls: 'bg-amber-100 text-amber-700' },
    aceptada: { label: 'Aceptada', cls: 'bg-emerald-100 text-emerald-700' },
    rechazada: { label: 'Rechazada', cls: 'bg-red-100 text-red-700' },
    revocada: { label: 'Revocada', cls: 'bg-slate-200 text-slate-600' },
  };
  const vigente = (d: Delegacion) => d.estado === 'aceptada' && d.desde <= hoy() && (!d.hasta || d.hasta >= hoy());

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h2 className="font-semibold text-slate-800 mb-1">Delegar Mesa de Entrada</h2>
      <p className="text-sm text-slate-500 mb-4">Cuando no estés (vacaciones, licencia), delegá tu función de Mesa de Entrada a otro agente. La persona debe <strong>aceptar</strong> la delegación desde su cuenta. Podés revocarla cuando vuelvas.</p>

      <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (form.a_usuario) delegar.mutate(); }}
        className="grid sm:grid-cols-[2fr,1fr,1fr,auto] gap-3 items-end mb-5">
        <Campo label="Delegar en">
          <select className={inputCls} value={form.a_usuario} onChange={(e) => setForm({ ...form, a_usuario: e.target.value })}>
            <option value="">Elegí un agente…</option>
            {agentes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Desde">
          <input className={inputCls} type="date" value={form.desde} onChange={(e) => setForm({ ...form, desde: e.target.value })} />
        </Campo>
        <Campo label="Hasta (opcional)">
          <input className={inputCls} type="date" value={form.hasta} onChange={(e) => setForm({ ...form, hasta: e.target.value })} />
        </Campo>
        <Boton type="submit" disabled={delegar.isPending || !form.a_usuario}>Delegar</Boton>
      </form>
      {err && <p className="text-sm text-red-600 mb-3">{err}</p>}

      <div className="space-y-2">
        {delegaciones.length === 0 && <p className="text-sm text-slate-400">No hay delegaciones registradas.</p>}
        {delegaciones.map((d) => {
          const e = ESTADO[d.estado] ?? { label: d.estado, cls: 'bg-slate-200 text-slate-600' };
          return (
            <div key={d.id} className="flex items-center gap-2 text-sm border border-slate-100 rounded-lg px-3 py-2">
              <span className="flex-1 text-slate-700">
                {nombre(d.a_usuario)} · {d.desde}{d.hasta ? ` → ${d.hasta}` : ' (sin fin)'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${e.cls}`}>{vigente(d) ? 'Vigente' : e.label}</span>
              {(d.estado === 'pendiente' || d.estado === 'aceptada') &&
                <button onClick={() => revocar.mutate(d.id)} className="text-xs text-red-600 hover:underline">Revocar</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
