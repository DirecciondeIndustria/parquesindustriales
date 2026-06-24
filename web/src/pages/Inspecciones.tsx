import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { usePermisos } from '../lib/permisos';
import { Boton, Modal, Campo, inputCls, EncabezadoPagina } from '../components/ui';
import { ESTADOS_INSPECCION } from '../lib/constantes';
import { fmtFecha } from '../lib/fechas';

interface Inspeccion {
  id: string;
  expediente_id: string | null;
  parcela_id: string | null;
  empresa_id: string | null;
  fecha_programada: string | null;
  fecha_realizada: string | null;
  estado: string;
  inspector: string | null;
  observaciones: string | null;
}
interface Empresa { id: string; razon_social: string; }
interface Parcela { id: string; identificacion: string; }
interface ExpedienteMin { id: string; numero: number; anio: number; sigla: string | null; }

const vacio = {
  expediente_id: '', parcela_id: '', empresa_id: '', fecha_programada: '', fecha_realizada: '',
  estado: 'pendiente', inspector: '', observaciones: '',
};

export default function Inspecciones() {
  const qc = useQueryClient();
  const { puedeEditar } = usePermisos();
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(vacio);
  const [busca, setBusca] = useState('');

  const { data: expedientes = [] } = useQuery({
    queryKey: ['expedientes-min'],
    queryFn: async () => {
      const { data, error } = await supabase.from('expedientes').select('id, numero, anio, sigla').order('anio', { ascending: false }).order('numero', { ascending: false });
      if (error) throw error; return data as ExpedienteMin[];
    },
  });
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-min'],
    queryFn: async () => {
      const { data, error } = await supabase.from('empresas').select('id, razon_social').order('razon_social');
      if (error) throw error; return data as Empresa[];
    },
  });
  const { data: parcelas = [] } = useQuery({
    queryKey: ['parcelas-min'],
    queryFn: async () => {
      const { data, error } = await supabase.from('parcelas').select('id, identificacion').order('identificacion');
      if (error) throw error; return data as Parcela[];
    },
  });
  const { data: insp = [], isLoading } = useQuery({
    queryKey: ['inspecciones'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inspecciones').select('*').order('fecha_programada', { ascending: false, nullsFirst: false });
      if (error) throw error; return data as Inspeccion[];
    },
  });

  const empNom = (id: string | null) => empresas.find((e) => e.id === id)?.razon_social ?? '—';
  const parNom = (id: string | null) => parcelas.find((p) => p.id === id)?.identificacion ?? '—';
  const expNom = (id: string | null) => {
    const e = expedientes.find((x) => x.id === id);
    return e ? `${e.sigla ? e.sigla + ' ' : ''}${e.numero}/${e.anio}` : '—';
  };

  const q = busca.trim().toLowerCase();
  const visibles = q
    ? insp.filter((i) =>
        [empNom(i.empresa_id), parNom(i.parcela_id), expNom(i.expediente_id), i.inspector ?? '']
          .join(' ').toLowerCase().includes(q))
    : insp;

  const guardar = useMutation({
    mutationFn: async () => {
      const payload = {
        expediente_id: form.expediente_id || null,
        parcela_id: form.parcela_id || null,
        empresa_id: form.empresa_id || null,
        fecha_programada: form.fecha_programada || null,
        fecha_realizada: form.fecha_realizada || null,
        estado: form.estado,
        inspector: form.inspector || null,
        observaciones: form.observaciones || null,
      };
      const q = editId
        ? supabase.from('inspecciones').update(payload).eq('id', editId)
        : supabase.from('inspecciones').insert(payload);
      const { error } = await q; if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inspecciones'] }); cerrar(); },
  });
  const eliminar = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('inspecciones').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspecciones'] }),
  });

  function abrirNuevo() { setEditId(null); setForm(vacio); setModal(true); }
  function abrirEditar(i: Inspeccion) {
    setEditId(i.id);
    setForm({
      expediente_id: i.expediente_id ?? '', parcela_id: i.parcela_id ?? '', empresa_id: i.empresa_id ?? '',
      fecha_programada: i.fecha_programada ?? '', fecha_realizada: i.fecha_realizada ?? '',
      estado: i.estado, inspector: i.inspector ?? '', observaciones: i.observaciones ?? '',
    });
    setModal(true);
  }
  function cerrar() { setModal(false); setEditId(null); }
  function onSubmit(e: FormEvent) { e.preventDefault(); guardar.mutate(); }

  return (
    <div>
      <EncabezadoPagina titulo="Inspecciones" descripcion={`${insp.length} registradas`}
        accion={puedeEditar && <Boton onClick={abrirNuevo}>+ Nueva inspección</Boton>} />

      <p className="text-xs text-slate-400 mb-4">La carga detallada de actas (firmas, fotos, PDF) seguirá en la app de inspecciones; acá se gestiona la programación y el estado.</p>

      <input
        className={`${inputCls} mb-4 max-w-sm`} placeholder="Buscar por empresa, expediente, parcela o inspector…"
        value={busca} onChange={(e) => setBusca(e.target.value)}
      />

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Expediente</th>
              <th className="px-4 py-3 font-medium">Parcela</th>
              <th className="px-4 py-3 font-medium">Programada</th>
              <th className="px-4 py-3 font-medium">Realizada</th>
              <th className="px-4 py-3 font-medium">Inspector</th>
              {puedeEditar && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Cargando…</td></tr>}
            {!isLoading && visibles.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Sin inspecciones.</td></tr>}
            {visibles.map((i) => {
              const e = ESTADOS_INSPECCION[i.estado] ?? { label: i.estado, color: '#94a3b8' };
              return (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: e.color }} />{e.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{empNom(i.empresa_id)}</td>
                  <td className="px-4 py-3 text-slate-600">{expNom(i.expediente_id)}</td>
                  <td className="px-4 py-3 text-slate-600">{parNom(i.parcela_id)}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtFecha(i.fecha_programada)}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtFecha(i.fecha_realizada)}</td>
                  <td className="px-4 py-3 text-slate-600">{i.inspector ?? '—'}</td>
                  {puedeEditar && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => abrirEditar(i)} className="text-[var(--brand)] hover:underline mr-3">Editar</button>
                      <button onClick={() => { if (confirm('¿Eliminar inspección?')) eliminar.mutate(i.id); }} className="text-red-600 hover:underline">Eliminar</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal titulo={editId ? 'Editar inspección' : 'Nueva inspección'} abierto={modal} onCerrar={cerrar}>
        <form onSubmit={onSubmit} className="space-y-4">
          <Campo label="Expediente (opcional)">
            <select className={inputCls} value={form.expediente_id} onChange={(e) => setForm({ ...form, expediente_id: e.target.value })}>
              <option value="">Sin asociar</option>
              {expedientes.map((x) => <option key={x.id} value={x.id}>{x.sigla ? x.sigla + ' ' : ''}{x.numero}/{x.anio}</option>)}
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Empresa">
              <select className={inputCls} value={form.empresa_id} onChange={(e) => setForm({ ...form, empresa_id: e.target.value })}>
                <option value="">Sin asignar</option>
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
              </select>
            </Campo>
            <Campo label="Parcela">
              <select className={inputCls} value={form.parcela_id} onChange={(e) => setForm({ ...form, parcela_id: e.target.value })}>
                <option value="">Sin asignar</option>
                {parcelas.map((p) => <option key={p.id} value={p.id}>{p.identificacion}</option>)}
              </select>
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Fecha programada">
              <input className={inputCls} type="date" value={form.fecha_programada} onChange={(e) => setForm({ ...form, fecha_programada: e.target.value })} />
            </Campo>
            <Campo label="Fecha realizada">
              <input className={inputCls} type="date" value={form.fecha_realizada} onChange={(e) => setForm({ ...form, fecha_realizada: e.target.value })} />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Estado">
              <select className={inputCls} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                {Object.entries(ESTADOS_INSPECCION).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Campo>
            <Campo label="Inspector">
              <input className={inputCls} value={form.inspector} onChange={(e) => setForm({ ...form, inspector: e.target.value })} />
            </Campo>
          </div>
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
