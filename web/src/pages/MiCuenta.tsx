import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Boton, Campo, inputCls, EncabezadoPagina } from '../components/ui';

interface UsuarioMin { id: string; nombre: string; }
interface Delegacion { id: string; a_usuario: string; desde: string; hasta: string | null; revocada: boolean; }

export default function MiCuenta() {
  const { perfil } = useAuth();
  const qc = useQueryClient();
  const [pass, setPass] = useState({ a: '', b: '' });
  const [msg, setMsg] = useState('');
  const esMesaEntrada = perfil?.rol === 'archivo';

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
          <div><div className="text-xs text-slate-400">Rol</div><div className="font-medium text-slate-800 capitalize">{perfil?.rol?.replace('_', ' ')}</div></div>
        </div>
      </div>

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

      {/* Delegación de mesa de entrada (solo rol archivo) */}
      {esMesaEntrada && <DelegacionMesa miId={perfil!.id} qc={qc} />}
    </div>
  );
}

function DelegacionMesa({ miId, qc }: { miId: string; qc: ReturnType<typeof useQueryClient> }) {
  const [form, setForm] = useState({ a_usuario: '', desde: new Date().toISOString().slice(0, 10), hasta: '' });

  const { data: agentes = [] } = useQuery({
    queryKey: ['usuarios-min-deleg'],
    queryFn: async () => {
      const { data, error } = await supabase.from('usuarios').select('id, nombre').neq('id', miId).order('nombre');
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
      const { error } = await supabase.from('delegaciones_mesa').insert({
        de_usuario: miId, a_usuario: form.a_usuario, desde: form.desde, hasta: form.hasta || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setForm({ ...form, a_usuario: '', hasta: '' }); refresca(); },
  });
  const revocar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('delegaciones_mesa').update({ revocada: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresca,
  });

  const hoy = new Date().toISOString().slice(0, 10);
  const activa = (d: Delegacion) => !d.revocada && d.desde <= hoy && (!d.hasta || d.hasta >= hoy);

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h2 className="font-semibold text-slate-800 mb-1">Delegar mesa de entrada</h2>
      <p className="text-sm text-slate-500 mb-4">Cuando no estés (vacaciones, licencia), pasá tu función de mesa de entrada a otro agente por un período. Podés revocarla cuando vuelvas.</p>

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

      <div className="space-y-2">
        {delegaciones.length === 0 && <p className="text-sm text-slate-400">No hay delegaciones registradas.</p>}
        {delegaciones.map((d) => (
          <div key={d.id} className="flex items-center gap-2 text-sm border border-slate-100 rounded-lg px-3 py-2">
            <span className="flex-1 text-slate-700">
              {nombre(d.a_usuario)} · {d.desde}{d.hasta ? ` → ${d.hasta}` : ' (sin fin)'}
            </span>
            {activa(d)
              ? <>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Activa</span>
                  <button onClick={() => revocar.mutate(d.id)} className="text-xs text-red-600 hover:underline">Revocar</button>
                </>
              : <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">{d.revocada ? 'Revocada' : 'Inactiva'}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
