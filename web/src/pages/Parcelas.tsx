import { useState, useMemo, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { usePermisos } from '../lib/permisos';
import { Boton, Modal, Campo, inputCls, EncabezadoPagina } from '../components/ui';

type EstadoParcela = 'libre' | 'operativa' | 'desarrollo' | 'incumplimiento' | 'escriturada';

interface Parcela {
  id: string;
  parque_id: string;
  identificacion: string;
  superficie: number | null;
  estado: EstadoParcela;
  empresa_id: string | null;
  fecha_adjudicacion: string | null;
  escriturada: boolean;
}
interface Parque { id: string; nombre: string; localidad: string; }
interface Empresa { id: string; razon_social: string; }

const ESTADOS: Record<EstadoParcela, { label: string; color: string; texto: string }> = {
  operativa:      { label: 'Operativa',      color: '#16a34a', texto: 'Empresa operativa' },
  desarrollo:     { label: 'En desarrollo',  color: '#eab308', texto: 'Empresa en desarrollo' },
  incumplimiento: { label: 'Incumplimiento', color: '#dc2626', texto: 'Incumplimientos' },
  libre:          { label: 'Libre',          color: '#94a3b8', texto: 'Parcela libre' },
  escriturada:    { label: 'Escriturada',    color: '#2563eb', texto: 'Escriturada' },
};

const vacio = {
  parque_id: '', identificacion: '', superficie: '', estado: 'libre' as EstadoParcela,
  empresa_id: '', fecha_adjudicacion: '', escriturada: false,
};

export default function Parcelas() {
  const qc = useQueryClient();
  const { puedeEditar, esAdmin } = usePermisos();
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(vacio);
  const [filtroParque, setFiltroParque] = useState('');
  const [busca, setBusca] = useState('');

  const { data: parques = [] } = useQuery({
    queryKey: ['parques'],
    queryFn: async () => {
      const { data, error } = await supabase.from('parques_industriales').select('id, nombre, localidad').order('localidad');
      if (error) throw error;
      return data as Parque[];
    },
  });
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-min'],
    queryFn: async () => {
      const { data, error } = await supabase.from('empresas').select('id, razon_social').order('razon_social');
      if (error) throw error;
      return data as Empresa[];
    },
  });
  const { data: parcelas = [], isLoading } = useQuery({
    queryKey: ['parcelas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('parcelas').select('*').order('identificacion');
      if (error) throw error;
      return data as Parcela[];
    },
  });

  const nombreParque = (id: string) => {
    const p = parques.find((x) => x.id === id);
    return p ? `${p.nombre} (${p.localidad})` : '—';
  };
  const nombreEmpresa = (id: string | null) => empresas.find((e) => e.id === id)?.razon_social ?? '—';

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return parcelas.filter((p) =>
      (!filtroParque || p.parque_id === filtroParque) &&
      (!q || [p.identificacion, nombreEmpresa(p.empresa_id)].join(' ').toLowerCase().includes(q)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcelas, filtroParque, busca, empresas]);

  const guardar = useMutation({
    mutationFn: async () => {
      const payload = {
        parque_id: form.parque_id,
        identificacion: form.identificacion.trim(),
        superficie: form.superficie ? Number(form.superficie) : null,
        estado: form.estado,
        empresa_id: form.empresa_id || null,
        fecha_adjudicacion: form.fecha_adjudicacion || null,
        escriturada: form.estado === 'escriturada' ? true : form.escriturada,
      };
      const q = editId
        ? supabase.from('parcelas').update(payload).eq('id', editId)
        : supabase.from('parcelas').insert(payload);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['parcelas'] }); cerrar(); },
  });
  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('parcelas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parcelas'] }),
  });

  function abrirNuevo() {
    setEditId(null);
    setForm({ ...vacio, parque_id: filtroParque || parques[0]?.id || '' });
    setModal(true);
  }
  function abrirEditar(p: Parcela) {
    setEditId(p.id);
    setForm({
      parque_id: p.parque_id, identificacion: p.identificacion,
      superficie: p.superficie?.toString() ?? '', estado: p.estado,
      empresa_id: p.empresa_id ?? '', fecha_adjudicacion: p.fecha_adjudicacion ?? '',
      escriturada: p.escriturada,
    });
    setModal(true);
  }
  function cerrar() { setModal(false); setEditId(null); }
  function onSubmit(e: FormEvent) { e.preventDefault(); guardar.mutate(); }

  return (
    <div>
      <EncabezadoPagina
        titulo="Parcelas"
        descripcion={`${parcelas.length} en total`}
        accion={puedeEditar && <Boton onClick={abrirNuevo} disabled={parques.length === 0}>+ Nueva parcela</Boton>}
      />

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <input className={`${inputCls} max-w-xs`} placeholder="Buscar por parcela o empresa…"
          value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className={`${inputCls} max-w-xs`} value={filtroParque} onChange={(e) => setFiltroParque(e.target.value)}>
          <option value="">Todos los parques</option>
          {parques.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.localidad})</option>)}
        </select>
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(ESTADOS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: v.color }} /> {v.label}
            </span>
          ))}
        </div>
      </div>

      {/* Mapa de parcelas */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        {visibles.length === 0 ? (
          <p className="text-slate-400 text-center py-6">Sin parcelas para mostrar.</p>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))' }}>
            {visibles.map((p) => {
              const est = ESTADOS[p.estado];
              return (
                <button
                  key={p.id}
                  onClick={() => puedeEditar && abrirEditar(p)}
                  title={`${p.identificacion} · ${est.texto}${p.empresa_id ? ' · ' + nombreEmpresa(p.empresa_id) : ''}`}
                  className="aspect-square rounded-lg text-white text-xs font-semibold flex items-center justify-center p-1 text-center hover:opacity-90 transition"
                  style={{ background: est.color }}
                >
                  {p.identificacion}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Identificación</th>
              <th className="px-4 py-3 font-medium">Parque</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Superficie</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              {puedeEditar && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Cargando…</td></tr>}
            {!isLoading && visibles.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Sin parcelas.</td></tr>
            )}
            {visibles.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{p.identificacion}</td>
                <td className="px-4 py-3 text-slate-600">{nombreParque(p.parque_id)}</td>
                <td className="px-4 py-3 text-slate-600">{nombreEmpresa(p.empresa_id)}</td>
                <td className="px-4 py-3 text-slate-600">{p.superficie ? `${p.superficie} m²` : '—'}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: ESTADOS[p.estado].color }} />
                    {ESTADOS[p.estado].label}
                  </span>
                </td>
                {puedeEditar && (
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => abrirEditar(p)} className="text-[var(--brand)] hover:underline mr-3">Editar</button>
                    {esAdmin && (
                      <button onClick={() => { if (confirm(`¿Eliminar parcela "${p.identificacion}"?`)) eliminar.mutate(p.id); }}
                        className="text-red-600 hover:underline">Eliminar</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal titulo={editId ? 'Editar parcela' : 'Nueva parcela'} abierto={modal} onCerrar={cerrar}>
        <form onSubmit={onSubmit} className="space-y-4">
          <Campo label="Parque industrial">
            <select className={inputCls} required value={form.parque_id}
              onChange={(e) => setForm({ ...form, parque_id: e.target.value })}>
              <option value="">Elegí un parque…</option>
              {parques.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.localidad})</option>)}
            </select>
          </Campo>
          <Campo label="Identificación (nomenclatura)">
            <input className={inputCls} required placeholder="Ej. Mz. 10 Parc. 4" value={form.identificacion}
              onChange={(e) => setForm({ ...form, identificacion: e.target.value })} />
          </Campo>
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Superficie (m²)">
              <input className={inputCls} type="number" step="any" value={form.superficie}
                onChange={(e) => setForm({ ...form, superficie: e.target.value })} />
            </Campo>
            <Campo label="Estado">
              <select className={inputCls} value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoParcela })}>
                {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Empresa ocupante">
            <select className={inputCls} value={form.empresa_id}
              onChange={(e) => setForm({ ...form, empresa_id: e.target.value })}>
              <option value="">Sin asignar</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
            </select>
          </Campo>
          <Campo label="Fecha de adjudicación">
            <input className={inputCls} type="date" value={form.fecha_adjudicacion}
              onChange={(e) => setForm({ ...form, fecha_adjudicacion: e.target.value })} />
          </Campo>
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
