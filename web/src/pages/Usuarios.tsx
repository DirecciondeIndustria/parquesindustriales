import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, type Rol } from '../lib/supabase';
import { usePermisos } from '../lib/permisos';
import { Boton, Modal, Campo, inputCls, EncabezadoPagina } from '../components/ui';

interface UsuarioRow { id: string; nombre: string; email: string | null; rol: Rol; activo: boolean; }

export const ROLES: { valor: Rol; label: string }[] = [
  { valor: 'administrador', label: 'Administrador' },
  { valor: 'director', label: 'Director' },
  { valor: 'direccion_general', label: 'Dirección general' },
  { valor: 'parques', label: 'Parques' },
  { valor: 'archivo', label: 'Mesa de entrada / Archivo' },
  { valor: 'inspector', label: 'Inspector' },
  { valor: 'consulta', label: 'Consulta' },
];

/** Llama a la Edge Function admin-usuarios con el token del admin. */
async function adminUsuarios(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-usuarios', { body: payload });
  if (error) {
    // El cuerpo de error de la función trae el detalle.
    let msg = error.message;
    try { const ctx = await (error as { context?: Response }).context?.json(); if (ctx?.error) msg = ctx.error; } catch { /* */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function Usuarios() {
  const qc = useQueryClient();
  const { esAdmin } = usePermisos();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'consulta' as Rol });
  const [reset, setReset] = useState<{ u: UsuarioRow; password: string } | null>(null);
  const [msg, setMsg] = useState('');

  const { data: usuarios = [], isLoading } = useQuery({
    enabled: esAdmin,
    queryKey: ['usuarios-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('usuarios').select('id, nombre, email, rol, activo').order('nombre');
      if (error) throw error;
      return data as UsuarioRow[];
    },
  });

  const refresca = () => qc.invalidateQueries({ queryKey: ['usuarios-admin'] });

  const crear = useMutation({
    mutationFn: () => adminUsuarios({ action: 'crear', ...form }),
    onSuccess: () => { setModal(false); setMsg(''); refresca(); },
    onError: (e: Error) => setMsg(e.message),
  });
  const setRol = useMutation({
    mutationFn: (v: { user_id: string; rol: Rol }) => adminUsuarios({ action: 'set_rol', ...v }),
    onSuccess: refresca, onError: (e: Error) => setMsg(e.message),
  });
  const setActivo = useMutation({
    mutationFn: (v: { user_id: string; activo: boolean }) => adminUsuarios({ action: 'set_activo', ...v }),
    onSuccess: refresca, onError: (e: Error) => setMsg(e.message),
  });
  const resetPass = useMutation({
    mutationFn: (v: { user_id: string; password: string }) => adminUsuarios({ action: 'resetear_password', ...v }),
    onSuccess: () => { setReset(null); setMsg('Contraseña actualizada.'); },
    onError: (e: Error) => setMsg(e.message),
  });

  if (!esAdmin) {
    return (
      <div>
        <EncabezadoPagina titulo="Usuarios y roles" />
        <p className="text-amber-600">Solo un administrador puede gestionar usuarios.</p>
      </div>
    );
  }

  return (
    <div>
      <EncabezadoPagina
        titulo="Usuarios y roles"
        descripcion={`${usuarios.length} usuarios`}
        accion={<Boton onClick={() => { setForm({ nombre: '', email: '', password: '', rol: 'consulta' }); setMsg(''); setModal(true); }}>+ Nuevo usuario</Boton>}
      />

      {msg && <div className="mb-4 text-sm bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-700">{msg}</div>}

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Cargando…</td></tr>}
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{u.nombre}</td>
                <td className="px-4 py-3 text-slate-600">{u.email ?? '—'}</td>
                <td className="px-4 py-3">
                  <select className={`${inputCls} py-1`} value={u.rol}
                    onChange={(e) => setRol.mutate({ user_id: u.id, rol: e.target.value as Rol })}>
                    {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {u.activo
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Activo</span>
                    : <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">Inactivo</span>}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => { setMsg(''); setReset({ u, password: '' }); }} className="text-[var(--brand)] hover:underline mr-3">Resetear clave</button>
                  <button onClick={() => setActivo.mutate({ user_id: u.id, activo: !u.activo })}
                    className={u.activo ? 'text-red-600 hover:underline' : 'text-emerald-600 hover:underline'}>
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-3">Rol <strong>Mesa de entrada / Archivo</strong>: registra y deriva documentación, y puede delegar su función desde “Mi cuenta”.</p>

      {/* Modal: nuevo usuario */}
      <Modal titulo="Nuevo usuario" abierto={modal} onCerrar={() => setModal(false)}>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); crear.mutate(); }} className="space-y-4">
          <Campo label="Nombre y apellido">
            <input className={inputCls} required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </Campo>
          <Campo label="Email">
            <input className={inputCls} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Campo>
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Contraseña genérica (ej: DNI)">
              <input className={inputCls} required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Campo>
            <Campo label="Rol">
              <select className={inputCls} value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}>
                {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.label}</option>)}
              </select>
            </Campo>
          </div>
          <p className="text-xs text-slate-500">El usuario después podrá cambiar esta contraseña desde “Mi cuenta”. Mínimo 6 caracteres.</p>
          {crear.isError && <p className="text-sm text-red-600">{(crear.error as Error).message}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Boton type="button" variante="secundario" onClick={() => setModal(false)}>Cancelar</Boton>
            <Boton type="submit" disabled={crear.isPending}>{crear.isPending ? 'Creando…' : 'Crear usuario'}</Boton>
          </div>
        </form>
      </Modal>

      {/* Modal: resetear contraseña */}
      <Modal titulo="Resetear contraseña" abierto={!!reset} onCerrar={() => setReset(null)}>
        {reset && (
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (reset.password.length >= 6) resetPass.mutate({ user_id: reset.u.id, password: reset.password }); }} className="space-y-4">
            <p className="text-sm text-slate-600">Nueva contraseña para <strong>{reset.u.nombre}</strong>. Después la persona puede cambiarla desde “Mi cuenta”.</p>
            <Campo label="Nueva contraseña (mín. 6)">
              <input className={inputCls} required minLength={6} autoFocus value={reset.password} onChange={(e) => setReset({ ...reset, password: e.target.value })} />
            </Campo>
            {resetPass.isError && <p className="text-sm text-red-600">{(resetPass.error as Error).message}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Boton type="button" variante="secundario" onClick={() => setReset(null)}>Cancelar</Boton>
              <Boton type="submit" disabled={resetPass.isPending || reset.password.length < 6}>{resetPass.isPending ? 'Guardando…' : 'Guardar'}</Boton>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
