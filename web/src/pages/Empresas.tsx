import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { usePermisos } from '../lib/permisos';
import { Boton, Modal, Campo, inputCls, EncabezadoPagina } from '../components/ui';

interface Empresa {
  id: string;
  razon_social: string;
  cuit: string | null;
  domicilio: string | null;
  telefono: string | null;
  email: string | null;
  actividad: string | null;
  estado: string | null;
  fecha_radicacion: string | null;
}

const vacio = {
  razon_social: '', cuit: '', domicilio: '', telefono: '',
  email: '', actividad: '', estado: 'activa', fecha_radicacion: '',
};

export default function Empresas() {
  const qc = useQueryClient();
  const { puedeEditar, esAdmin } = usePermisos();
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(vacio);
  const [busca, setBusca] = useState('');

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('empresas').select('*').order('razon_social');
      if (error) throw error;
      return data as Empresa[];
    },
  });

  const filtradas = empresas.filter((e) =>
    [e.razon_social, e.cuit, e.actividad].join(' ').toLowerCase().includes(busca.toLowerCase()),
  );

  const guardar = useMutation({
    mutationFn: async () => {
      const payload = {
        razon_social: form.razon_social.trim(),
        cuit: form.cuit || null,
        domicilio: form.domicilio || null,
        telefono: form.telefono || null,
        email: form.email || null,
        actividad: form.actividad || null,
        estado: form.estado,
        fecha_radicacion: form.fecha_radicacion || null,
      };
      const q = editId
        ? supabase.from('empresas').update(payload).eq('id', editId)
        : supabase.from('empresas').insert(payload);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['empresas'] }); cerrar(); },
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('empresas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['empresas'] }),
  });

  function abrirNuevo() { setEditId(null); setForm(vacio); setModal(true); }
  function abrirEditar(e: Empresa) {
    setEditId(e.id);
    setForm({
      razon_social: e.razon_social, cuit: e.cuit ?? '', domicilio: e.domicilio ?? '',
      telefono: e.telefono ?? '', email: e.email ?? '', actividad: e.actividad ?? '',
      estado: e.estado ?? 'activa', fecha_radicacion: e.fecha_radicacion ?? '',
    });
    setModal(true);
  }
  function cerrar() { setModal(false); setEditId(null); }
  function onSubmit(ev: FormEvent) { ev.preventDefault(); guardar.mutate(); }

  return (
    <div>
      <EncabezadoPagina
        titulo="Empresas"
        descripcion={`${empresas.length} registradas`}
        accion={puedeEditar && <Boton onClick={abrirNuevo}>+ Nueva empresa</Boton>}
      />

      <input
        className={`${inputCls} mb-4 max-w-sm`} placeholder="Buscar por razón social, CUIT o actividad…"
        value={busca} onChange={(e) => setBusca(e.target.value)}
      />

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Razón social</th>
              <th className="px-4 py-3 font-medium">CUIT</th>
              <th className="px-4 py-3 font-medium">Actividad</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              {puedeEditar && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Cargando…</td></tr>}
            {!isLoading && filtradas.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Sin empresas.</td></tr>
            )}
            {filtradas.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{e.razon_social}</td>
                <td className="px-4 py-3 text-slate-600">{e.cuit ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{e.actividad ?? '—'}</td>
                <td className="px-4 py-3 capitalize text-slate-600">{e.estado}</td>
                {puedeEditar && (
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => abrirEditar(e)} className="text-[var(--brand)] hover:underline mr-3">Editar</button>
                    {esAdmin && (
                      <button onClick={() => { if (confirm(`¿Eliminar "${e.razon_social}"?`)) eliminar.mutate(e.id); }}
                        className="text-red-600 hover:underline">Eliminar</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal titulo={editId ? 'Editar empresa' : 'Nueva empresa'} abierto={modal} onCerrar={cerrar}>
        <form onSubmit={onSubmit} className="space-y-4">
          <Campo label="Razón social">
            <input className={inputCls} required value={form.razon_social}
              onChange={(e) => setForm({ ...form, razon_social: e.target.value })} />
          </Campo>
          <div className="grid grid-cols-2 gap-4">
            <Campo label="CUIT">
              <input className={inputCls} value={form.cuit} placeholder="30-12345678-9"
                onChange={(e) => setForm({ ...form, cuit: e.target.value })} />
            </Campo>
            <Campo label="Actividad industrial">
              <input className={inputCls} value={form.actividad}
                onChange={(e) => setForm({ ...form, actividad: e.target.value })} />
            </Campo>
          </div>
          <Campo label="Domicilio">
            <input className={inputCls} value={form.domicilio}
              onChange={(e) => setForm({ ...form, domicilio: e.target.value })} />
          </Campo>
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Teléfono">
              <input className={inputCls} value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </Campo>
            <Campo label="Email">
              <input className={inputCls} type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Estado">
              <select className={inputCls} value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                <option value="activa">Activa</option>
                <option value="inactiva">Inactiva</option>
              </select>
            </Campo>
            <Campo label="Fecha de radicación">
              <input className={inputCls} type="date" value={form.fecha_radicacion}
                onChange={(e) => setForm({ ...form, fecha_radicacion: e.target.value })} />
            </Campo>
          </div>
          {guardar.isError && <p className="text-sm text-red-600">No se pudo guardar.</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Boton type="button" variante="secundario" onClick={cerrar}>Cancelar</Boton>
            <Boton type="submit" disabled={guardar.isPending}>
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
