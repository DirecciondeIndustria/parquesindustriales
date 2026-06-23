import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { usePermisos } from '../lib/permisos';
import { Boton, Modal, Campo, inputCls, EncabezadoPagina } from '../components/ui';
import { semaforo, SEMAFORO_COLOR, ESTADO_LABEL, type Expediente } from '../lib/expediente';

interface TipoTramite { id: string; nombre: string; }
interface Empresa { id: string; razon_social: string; }
interface Parcela { id: string; identificacion: string; }

export default function Expedientes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { puedeEditar } = usePermisos();
  const [modal, setModal] = useState(false);
  const anioActual = new Date().getFullYear();
  const [form, setForm] = useState({
    anio: anioActual.toString(), tipo_tramite_id: '', empresa_id: '',
    parcela_id: '', plazo_vencimiento: '', observaciones: '',
  });

  const { data: tipos = [] } = useQuery({
    queryKey: ['tipos-tramite'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tipos_tramite').select('id, nombre').eq('activo', true).order('nombre');
      if (error) throw error;
      return data as TipoTramite[];
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
  const { data: parcelas = [] } = useQuery({
    queryKey: ['parcelas-min'],
    queryFn: async () => {
      const { data, error } = await supabase.from('parcelas').select('id, identificacion').order('identificacion');
      if (error) throw error;
      return data as Parcela[];
    },
  });
  const { data: expedientes = [], isLoading } = useQuery({
    queryKey: ['expedientes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('expedientes').select('*').order('anio', { ascending: false }).order('numero', { ascending: false });
      if (error) throw error;
      return data as Expediente[];
    },
  });

  const tipoNom = (id: string | null) => tipos.find((t) => t.id === id)?.nombre ?? '—';
  const empNom = (id: string | null) => empresas.find((e) => e.id === id)?.razon_social ?? '—';

  const crear = useMutation({
    mutationFn: async () => {
      const anio = Number(form.anio);
      // Numerador correlativo por año.
      const { data: ult } = await supabase
        .from('expedientes').select('numero').eq('anio', anio)
        .order('numero', { ascending: false }).limit(1).maybeSingle();
      const numero = (ult?.numero ?? 0) + 1;

      const { data, error } = await supabase.from('expedientes').insert({
        numero, anio,
        tipo_tramite_id: form.tipo_tramite_id || null,
        empresa_id: form.empresa_id || null,
        parcela_id: form.parcela_id || null,
        plazo_vencimiento: form.plazo_vencimiento || null,
        observaciones: form.observaciones || null,
        estado: 'iniciado',
      }).select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['expedientes'] });
      setModal(false);
      navigate(`/expedientes/${id}`);
    },
  });

  function abrir() {
    setForm({ anio: anioActual.toString(), tipo_tramite_id: '', empresa_id: '', parcela_id: '', plazo_vencimiento: '', observaciones: '' });
    setModal(true);
  }
  function onSubmit(e: FormEvent) { e.preventDefault(); crear.mutate(); }

  return (
    <div>
      <EncabezadoPagina
        titulo="Expedientes"
        descripcion={`${expedientes.length} en el sistema`}
        accion={puedeEditar && <Boton onClick={abrir}>+ Nuevo expediente</Boton>}
      />

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">N°</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Situación</th>
              <th className="px-4 py-3 font-medium">Semáforo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Cargando…</td></tr>}
            {!isLoading && expedientes.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Sin expedientes.</td></tr>
            )}
            {expedientes.map((e) => {
              const s = semaforo(e);
              return (
                <tr key={e.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/expedientes/${e.id}`)}>
                  <td className="px-4 py-3"><span className="text-slate-600">{ESTADO_LABEL[e.estado]}</span></td>
                  <td className="px-4 py-3 font-semibold text-[var(--brand)]">{e.numero}/{e.anio}</td>
                  <td className="px-4 py-3 text-slate-600">{tipoNom(e.tipo_tramite_id)}</td>
                  <td className="px-4 py-3 text-slate-600">{empNom(e.empresa_id)}</td>
                  <td className="px-4 py-3 text-slate-500">{s.motivo}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block w-3.5 h-3.5 rounded-full" style={{ background: SEMAFORO_COLOR[s.color] }} title={s.motivo} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal titulo="Nuevo expediente" abierto={modal} onCerrar={() => setModal(false)}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Tipo de trámite">
              <select className={inputCls} required value={form.tipo_tramite_id}
                onChange={(ev) => setForm({ ...form, tipo_tramite_id: ev.target.value })}>
                <option value="">Elegí…</option>
                {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Año">
              <input className={inputCls} type="number" required value={form.anio}
                onChange={(ev) => setForm({ ...form, anio: ev.target.value })} />
            </Campo>
          </div>
          <Campo label="Empresa">
            <select className={inputCls} value={form.empresa_id}
              onChange={(ev) => setForm({ ...form, empresa_id: ev.target.value })}>
              <option value="">Sin asignar</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
            </select>
          </Campo>
          <Campo label="Parcela">
            <select className={inputCls} value={form.parcela_id}
              onChange={(ev) => setForm({ ...form, parcela_id: ev.target.value })}>
              <option value="">Sin asignar</option>
              {parcelas.map((p) => <option key={p.id} value={p.id}>{p.identificacion}</option>)}
            </select>
          </Campo>
          <Campo label="Plazo de vencimiento (opcional)">
            <input className={inputCls} type="date" value={form.plazo_vencimiento}
              onChange={(ev) => setForm({ ...form, plazo_vencimiento: ev.target.value })} />
          </Campo>
          <Campo label="Observaciones">
            <textarea className={inputCls} rows={2} value={form.observaciones}
              onChange={(ev) => setForm({ ...form, observaciones: ev.target.value })} />
          </Campo>
          <p className="text-xs text-slate-500">El número se asigna automáticamente (correlativo por año) y se generan las etapas del flujo.</p>
          {crear.isError && <p className="text-sm text-red-600">No se pudo crear.</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Boton type="button" variante="secundario" onClick={() => setModal(false)}>Cancelar</Boton>
            <Boton type="submit" disabled={crear.isPending}>{crear.isPending ? 'Creando…' : 'Crear expediente'}</Boton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
