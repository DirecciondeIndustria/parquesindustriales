import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { usePermisos } from '../lib/permisos';
import { Boton, Modal, Campo, inputCls, EncabezadoPagina } from '../components/ui';

interface Parque {
  id: string;
  nombre: string;
  localidad: string;
  superficie: number | null;
  estado: string | null;
}

const vacio = { nombre: '', localidad: '', superficie: '', estado: 'activo' };

export default function Parques() {
  const qc = useQueryClient();
  const { puedeEditar, esAdmin } = usePermisos();
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(vacio);

  const { data: parques = [], isLoading } = useQuery({
    queryKey: ['parques'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parques_industriales')
        .select('*')
        .order('localidad').order('nombre');
      if (error) throw error;
      return data as Parque[];
    },
  });

  const guardar = useMutation({
    mutationFn: async () => {
      const payload = {
        nombre: form.nombre.trim(),
        localidad: form.localidad.trim(),
        superficie: form.superficie ? Number(form.superficie) : null,
        estado: form.estado,
      };
      const q = editId
        ? supabase.from('parques_industriales').update(payload).eq('id', editId)
        : supabase.from('parques_industriales').insert(payload);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parques'] });
      cerrar();
    },
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('parques_industriales').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parques'] }),
  });

  function abrirNuevo() { setEditId(null); setForm(vacio); setModal(true); }
  function abrirEditar(p: Parque) {
    setEditId(p.id);
    setForm({ nombre: p.nombre, localidad: p.localidad, superficie: p.superficie?.toString() ?? '', estado: p.estado ?? 'activo' });
    setModal(true);
  }
  function cerrar() { setModal(false); setEditId(null); }
  function onSubmit(e: FormEvent) { e.preventDefault(); guardar.mutate(); }

  return (
    <div>
      <EncabezadoPagina
        titulo="Parques industriales"
        descripcion={`${parques.length} registrados`}
        accion={puedeEditar && <Boton onClick={abrirNuevo}>+ Nuevo parque</Boton>}
      />

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Localidad</th>
              <th className="px-4 py-3 font-medium">Superficie</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              {puedeEditar && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Cargando…</td></tr>
            )}
            {!isLoading && parques.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Sin parques cargados.</td></tr>
            )}
            {parques.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{p.nombre}</td>
                <td className="px-4 py-3 text-slate-600">{p.localidad}</td>
                <td className="px-4 py-3 text-slate-600">{p.superficie ? `${p.superficie} ha` : '—'}</td>
                <td className="px-4 py-3"><span className="capitalize text-slate-600">{p.estado}</span></td>
                {puedeEditar && (
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => abrirEditar(p)} className="text-[var(--brand)] hover:underline mr-3">Editar</button>
                    {esAdmin && (
                      <button
                        onClick={() => { if (confirm(`¿Eliminar "${p.nombre}"?`)) eliminar.mutate(p.id); }}
                        className="text-red-600 hover:underline"
                      >Eliminar</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal titulo={editId ? 'Editar parque' : 'Nuevo parque'} abierto={modal} onCerrar={cerrar}>
        <form onSubmit={onSubmit} className="space-y-4">
          <Campo label="Nombre">
            <input className={inputCls} required value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </Campo>
          <Campo label="Localidad">
            <input className={inputCls} required value={form.localidad}
              onChange={(e) => setForm({ ...form, localidad: e.target.value })} />
          </Campo>
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Superficie (ha)">
              <input className={inputCls} type="number" step="any" value={form.superficie}
                onChange={(e) => setForm({ ...form, superficie: e.target.value })} />
            </Campo>
            <Campo label="Estado">
              <select className={inputCls} value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
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
