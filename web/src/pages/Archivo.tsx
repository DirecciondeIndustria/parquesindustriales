import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { usePermisos } from '../lib/permisos';
import { Boton, Modal, Campo, inputCls, EncabezadoPagina } from '../components/ui';

interface Registro {
  id: string;
  expediente_id: string | null;
  estanteria: string | null;
  caja: string | null;
  archivo: string | null;
  estado: string;
  observaciones: string | null;
}
interface Expediente { id: string; numero: number; anio: number; }

const ESTADOS = ['activo', 'archivado', 'baja'];
const vacio = { expediente_id: '', estanteria: '', caja: '', archivo: '', estado: 'activo', observaciones: '' };

export default function Archivo() {
  const qc = useQueryClient();
  const { puedeEditar } = usePermisos();
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(vacio);
  const [filtro, setFiltro] = useState('');

  const { data: expedientes = [] } = useQuery({
    queryKey: ['expedientes-min'],
    queryFn: async () => {
      const { data, error } = await supabase.from('expedientes').select('id, numero, anio').order('anio', { ascending: false });
      if (error) throw error; return data as Expediente[];
    },
  });
  const { data: registros = [], isLoading } = useQuery({
    queryKey: ['archivo'],
    queryFn: async () => {
      const { data, error } = await supabase.from('archivo_fisico').select('*').order('created_at', { ascending: false });
      if (error) throw error; return data as Registro[];
    },
  });

  const expNom = (id: string | null) => {
    const e = expedientes.find((x) => x.id === id);
    return e ? `${e.numero}/${e.anio}` : '—';
  };

  const guardar = useMutation({
    mutationFn: async () => {
      const payload = {
        expediente_id: form.expediente_id || null,
        estanteria: form.estanteria || null, caja: form.caja || null, archivo: form.archivo || null,
        estado: form.estado, observaciones: form.observaciones || null,
      };
      const q = editId
        ? supabase.from('archivo_fisico').update(payload).eq('id', editId)
        : supabase.from('archivo_fisico').insert(payload);
      const { error } = await q; if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['archivo'] }); cerrar(); },
  });
  const eliminar = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('archivo_fisico').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['archivo'] }),
  });

  function abrirNuevo() { setEditId(null); setForm(vacio); setModal(true); }
  function abrirEditar(r: Registro) {
    setEditId(r.id);
    setForm({
      expediente_id: r.expediente_id ?? '', estanteria: r.estanteria ?? '', caja: r.caja ?? '',
      archivo: r.archivo ?? '', estado: r.estado, observaciones: r.observaciones ?? '',
    });
    setModal(true);
  }
  function cerrar() { setModal(false); setEditId(null); }
  function onSubmit(e: FormEvent) { e.preventDefault(); guardar.mutate(); }

  const visibles = filtro ? registros.filter((r) => r.estado === filtro) : registros;

  return (
    <div>
      <EncabezadoPagina titulo="Departamento de archivo" descripcion={`${registros.length} ubicaciones`}
        accion={puedeEditar && <Boton onClick={abrirNuevo}>+ Nueva ubicación</Boton>} />

      <select className={`${inputCls} max-w-xs mb-4`} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
        <option value="">Todos los estados</option>
        {ESTADOS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
      </select>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Expediente</th>
              <th className="px-4 py-3 font-medium">Estantería</th>
              <th className="px-4 py-3 font-medium">Caja</th>
              <th className="px-4 py-3 font-medium">Archivo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              {puedeEditar && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Cargando…</td></tr>}
            {!isLoading && visibles.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Sin registros.</td></tr>}
            {visibles.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-[var(--brand)]">{expNom(r.expediente_id)}</td>
                <td className="px-4 py-3 text-slate-600">{r.estanteria ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{r.caja ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{r.archivo ?? '—'}</td>
                <td className="px-4 py-3 capitalize text-slate-600">{r.estado}</td>
                {puedeEditar && (
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => abrirEditar(r)} className="text-[var(--brand)] hover:underline mr-3">Editar</button>
                    <button onClick={() => { if (confirm('¿Eliminar registro?')) eliminar.mutate(r.id); }} className="text-red-600 hover:underline">Eliminar</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal titulo={editId ? 'Editar ubicación' : 'Nueva ubicación'} abierto={modal} onCerrar={cerrar}>
        <form onSubmit={onSubmit} className="space-y-4">
          <Campo label="Expediente">
            <select className={inputCls} value={form.expediente_id} onChange={(e) => setForm({ ...form, expediente_id: e.target.value })}>
              <option value="">Sin asignar</option>
              {expedientes.map((e) => <option key={e.id} value={e.id}>{e.numero}/{e.anio}</option>)}
            </select>
          </Campo>
          <div className="grid grid-cols-3 gap-4">
            <Campo label="Estantería"><input className={inputCls} value={form.estanteria} onChange={(e) => setForm({ ...form, estanteria: e.target.value })} /></Campo>
            <Campo label="Caja"><input className={inputCls} value={form.caja} onChange={(e) => setForm({ ...form, caja: e.target.value })} /></Campo>
            <Campo label="Archivo"><input className={inputCls} value={form.archivo} onChange={(e) => setForm({ ...form, archivo: e.target.value })} /></Campo>
          </div>
          <Campo label="Estado">
            <select className={inputCls} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
              {ESTADOS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
          </Campo>
          <Campo label="Observaciones">
            <textarea className={inputCls} rows={2} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
          </Campo>
          {guardar.isError && <p className="text-sm text-red-600">No se pudo guardar.</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Boton type="button" variante="secundario" onClick={cerrar}>Cancelar</Boton>
            <Boton type="submit" disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar'}</Boton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
