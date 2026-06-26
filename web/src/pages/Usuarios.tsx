import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, type Rol } from '../lib/supabase';
import { usePermisos } from '../lib/permisos';
import { useAuth } from '../lib/auth';
import { adminUsuarios } from '../lib/adminApi';
import { Boton, Modal, Campo, inputCls, EncabezadoPagina } from '../components/ui';

interface UsuarioRow {
  id: string; nombre: string; email: string | null;
  rol: Rol; rol_secundario: Rol | null; activo: boolean;
}

// Roles principales (catálogo). El secundario solo puede ser Inspector.
export const ROLES: { valor: Rol; label: string }[] = [
  { valor: 'administrador', label: 'Administrador' },
  { valor: 'director', label: 'Director' },
  { valor: 'jefe_departamento', label: 'Jefe de Departamento' },
  { valor: 'mesa_entrada', label: 'Mesa de Entrada' },
  { valor: 'tecnico_administrativo', label: 'Técnico Administrativo' },
  { valor: 'inspector', label: 'Inspector' },
];

const ERRORES: Record<string, string> = {
  YA_EXISTE_MESA_ENTRADA: 'Ya hay un agente con el rol de Mesa de Entrada. Cambiá ese primero.',
  ROL_SECUNDARIO_INVALIDO: 'El rol secundario solo puede ser Inspector.',
  ROL_PRINCIPAL_INVALIDO: 'Rol principal inválido.',
  SOLO_ADMIN: 'Solo un administrador puede cambiar roles.',
};
const traduce = (m: string) => Object.keys(ERRORES).find((k) => m.includes(k)) ? ERRORES[Object.keys(ERRORES).find((k) => m.includes(k))!] : m;

export default function Usuarios() {
  const qc = useQueryClient();
  const { esAdmin } = usePermisos();
  const { perfil } = useAuth();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'inspector' as Rol });
  const [reset, setReset] = useState<{ u: UsuarioRow; password: string } | null>(null);
  const [msg, setMsg] = useState('');

  const { data: usuarios = [], isLoading } = useQuery({
    enabled: esAdmin,
    queryKey: ['usuarios-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('usuarios').select('id, nombre, email, rol, rol_secundario, activo').order('nombre');
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
  // Asignación de roles (principal + secundario) vía RPC admin_set_roles (solo admin).
  const setRoles = useMutation({
    mutationFn: async (v: { user_id: string; principal: Rol; secundario: Rol | null }) => {
      const { error } = await supabase.rpc('admin_set_roles', {
        p_user: v.user_id, p_principal: v.principal, p_secundario: v.secundario,
      });
      if (error) throw error;
    },
    onSuccess: () => { setMsg(''); refresca(); },
    onError: (e: Error) => setMsg(traduce(e.message)),
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
  const eliminar = useMutation({
    mutationFn: (user_id: string) => adminUsuarios({ action: 'eliminar', user_id }),
    onSuccess: () => { setMsg('Usuario eliminado.'); refresca(); },
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
        accion={<Boton onClick={() => { setForm({ nombre: '', email: '', password: '', rol: 'inspector' }); setMsg(''); setModal(true); }}>+ Nuevo usuario</Boton>}
      />

      {msg && <div className="mb-4 text-sm bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-700">{msg}</div>}

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Rol principal</th>
              <th className="px-4 py-3 font-medium">Rol secundario</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Cargando…</td></tr>}
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{u.nombre}</td>
                <td className="px-4 py-3 text-slate-600">{u.email ?? '—'}</td>
                <td className="px-4 py-3">
                  <select className={`${inputCls} py-1`} value={u.rol}
                    onChange={(e) => setRoles.mutate({ user_id: u.id, principal: e.target.value as Rol, secundario: u.rol_secundario })}>
                    {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select className={`${inputCls} py-1`} value={u.rol_secundario ?? ''}
                    disabled={u.rol === 'inspector'}
                    onChange={(e) => setRoles.mutate({ user_id: u.id, principal: u.rol, secundario: (e.target.value || null) as Rol | null })}>
                    <option value="">— Ninguno</option>
                    <option value="inspector">Inspector</option>
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
                    className={u.activo ? 'text-amber-600 hover:underline' : 'text-emerald-600 hover:underline'}>
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  {u.id !== perfil?.id && (
                    <button onClick={() => { setMsg(''); if (confirm(`¿Eliminar definitivamente a "${u.nombre}"? Esta acción no se puede deshacer.`)) eliminar.mutate(u.id); }}
                      className="text-red-600 hover:underline ml-3">Eliminar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-3">
        Solo el administrador edita roles. <strong>Mesa de Entrada</strong>: único a la vez (puede delegar su función desde “Mi cuenta”).
        El rol secundario <strong>Inspector</strong> habilita la app de actas sin cambiar los permisos del rol principal.
      </p>

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
            <Campo label="Rol principal">
              <select className={inputCls} value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}>
                {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.label}</option>)}
              </select>
            </Campo>
          </div>
          <p className="text-xs text-slate-500">El rol secundario se asigna después desde la tabla. El usuario puede cambiar su contraseña desde “Mi cuenta”. Mínimo 6 caracteres.</p>
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
