import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { usePermisos } from '../lib/permisos';
import { Boton, inputCls, EncabezadoPagina } from '../components/ui';

interface Tipo { id: string; nombre: string; }
interface Hito { id: string; tipo_tramite_id: string; orden: number; nombre: string; plazo_dias: number | null; }
interface Sub { id: string; etapa_definicion_id: string; orden: number; nombre: string; obligatorio: boolean; }

export default function Flujos() {
  const qc = useQueryClient();
  const { puedeEditar } = usePermisos();
  const [tipoId, setTipoId] = useState('');

  const { data: tipos = [] } = useQuery({
    queryKey: ['tipos-tramite'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tipos_tramite').select('id, nombre').order('nombre');
      if (error) throw error;
      return data as Tipo[];
    },
  });
  const tipoSel = tipoId || tipos[0]?.id || '';

  const { data: hitos = [] } = useQuery({
    enabled: !!tipoSel,
    queryKey: ['hitos', tipoSel],
    queryFn: async () => {
      const { data, error } = await supabase.from('etapas_definicion').select('*').eq('tipo_tramite_id', tipoSel).order('orden');
      if (error) throw error;
      return data as Hito[];
    },
  });
  const { data: subs = [] } = useQuery({
    enabled: hitos.length > 0,
    queryKey: ['subs', tipoSel, hitos.map((h) => h.id).join(',')],
    queryFn: async () => {
      const { data, error } = await supabase.from('subtramites_definicion').select('*')
        .in('etapa_definicion_id', hitos.map((h) => h.id)).order('orden');
      if (error) throw error;
      return data as Sub[];
    },
  });

  const refresca = () => {
    qc.invalidateQueries({ queryKey: ['hitos', tipoSel] });
    qc.invalidateQueries({ queryKey: ['subs'] });
  };

  const m = {
    addHito: useMutation({
      mutationFn: async () => {
        const orden = (hitos.at(-1)?.orden ?? 0) + 1;
        const { error } = await supabase.from('etapas_definicion').insert({ tipo_tramite_id: tipoSel, orden, nombre: 'Nuevo hito', plazo_dias: null });
        if (error) throw error;
      }, onSuccess: refresca,
    }),
    updHito: useMutation({
      mutationFn: async (h: { id: string; nombre?: string; plazo_dias?: number | null; orden?: number }) => {
        const { id, ...campos } = h;
        const { error } = await supabase.from('etapas_definicion').update(campos).eq('id', id);
        if (error) throw error;
      }, onSuccess: refresca,
    }),
    delHito: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('etapas_definicion').delete().eq('id', id);
        if (error) throw error;
      }, onSuccess: refresca,
    }),
    addSub: useMutation({
      mutationFn: async (hitoId: string) => {
        const orden = (subs.filter((s) => s.etapa_definicion_id === hitoId).at(-1)?.orden ?? 0) + 1;
        const { error } = await supabase.from('subtramites_definicion').insert({ etapa_definicion_id: hitoId, orden, nombre: 'Nuevo requisito' });
        if (error) throw error;
      }, onSuccess: refresca,
    }),
    updSub: useMutation({
      mutationFn: async (s: { id: string; nombre?: string; obligatorio?: boolean }) => {
        const { id, ...campos } = s;
        const { error } = await supabase.from('subtramites_definicion').update(campos).eq('id', id);
        if (error) throw error;
      }, onSuccess: refresca,
    }),
    delSub: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('subtramites_definicion').delete().eq('id', id);
        if (error) throw error;
      }, onSuccess: refresca,
    }),
  };

  function mover(h: Hito, dir: -1 | 1) {
    const vecino = hitos.find((x) => x.orden === h.orden + dir);
    if (!vecino) return;
    m.updHito.mutate({ id: h.id, orden: vecino.orden });
    m.updHito.mutate({ id: vecino.id, orden: h.orden });
  }

  return (
    <div>
      <EncabezadoPagina titulo="Flujos de trámite" descripcion="Plantilla de hitos y requisitos por tipo de trámite" />

      {!puedeEditar && <p className="text-sm text-amber-600 mb-4">Tu rol no permite editar los flujos.</p>}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select className={`${inputCls} max-w-xs`} value={tipoSel} onChange={(e) => setTipoId(e.target.value)}>
          {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        {puedeEditar && <Boton variante="secundario" onClick={() => m.addHito.mutate()}>+ Agregar hito</Boton>}
      </div>

      <div className="space-y-4">
        {hitos.map((h) => (
          <div key={h.id} className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-white bg-[var(--brand)] rounded-full w-6 h-6 grid place-items-center">{h.orden}</span>
              <input
                className={`${inputCls} flex-1 min-w-[180px] font-medium`} defaultValue={h.nombre} disabled={!puedeEditar}
                onBlur={(e) => e.target.value !== h.nombre && m.updHito.mutate({ id: h.id, nombre: e.target.value })}
              />
              <label className="text-xs text-slate-500 flex items-center gap-1">
                Plazo
                <input
                  className={`${inputCls} w-20`} type="number" defaultValue={h.plazo_dias ?? ''} disabled={!puedeEditar} placeholder="días"
                  onBlur={(e) => m.updHito.mutate({ id: h.id, plazo_dias: e.target.value ? Number(e.target.value) : null })}
                />
              </label>
              {puedeEditar && (
                <div className="flex gap-1 text-slate-400">
                  <button onClick={() => mover(h, -1)} className="hover:text-slate-700 px-1" title="Subir">▲</button>
                  <button onClick={() => mover(h, 1)} className="hover:text-slate-700 px-1" title="Bajar">▼</button>
                  <button onClick={() => { if (confirm(`¿Eliminar el hito "${h.nombre}"?`)) m.delHito.mutate(h.id); }} className="hover:text-red-600 px-1" title="Eliminar">✕</button>
                </div>
              )}
            </div>

            {/* Sub-trámites / requisitos */}
            <div className="ml-8 mt-3 space-y-2">
              {subs.filter((s) => s.etapa_definicion_id === h.id).map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="text-slate-300">└</span>
                  <input
                    className={`${inputCls} flex-1 text-sm`} defaultValue={s.nombre} disabled={!puedeEditar}
                    onBlur={(e) => e.target.value !== s.nombre && m.updSub.mutate({ id: s.id, nombre: e.target.value })}
                  />
                  <label className="text-xs text-slate-500 flex items-center gap-1 whitespace-nowrap">
                    <input type="checkbox" defaultChecked={s.obligatorio} disabled={!puedeEditar}
                      onChange={(e) => m.updSub.mutate({ id: s.id, obligatorio: e.target.checked })} />
                    Obligatorio
                  </label>
                  {puedeEditar && (
                    <button onClick={() => m.delSub.mutate(s.id)} className="text-slate-400 hover:text-red-600 px-1" title="Eliminar">✕</button>
                  )}
                </div>
              ))}
              {puedeEditar && (
                <button onClick={() => m.addSub.mutate(h.id)} className="text-sm text-[var(--brand)] hover:underline ml-4">+ Agregar requisito</button>
              )}
            </div>
          </div>
        ))}
        {hitos.length === 0 && <p className="text-slate-400">Este tipo de trámite no tiene hitos definidos.</p>}
      </div>
    </div>
  );
}
