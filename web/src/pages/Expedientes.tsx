import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { usePermisos } from '../lib/permisos';
import { Boton, Modal, Campo, inputCls, EncabezadoPagina } from '../components/ui';
import { semaforo, SEMAFORO_COLOR, ESTADO_LABEL, fmtExp, type Expediente } from '../lib/expediente';

interface TipoTramite { id: string; nombre: string; }
interface Empresa { id: string; razon_social: string; }
interface Parcela { id: string; identificacion: string; }
interface Sigla { id: string; nombre: string; sigla: string; vigente: boolean; orden: number; }

export default function Expedientes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { puedeEditar } = usePermisos();
  const [modal, setModal] = useState(false);
  const [modalSiglas, setModalSiglas] = useState(false);
  const [busca, setBusca] = useState('');
  const anioActual = new Date().getFullYear();
  const [form, setForm] = useState({
    numero: '', anio: anioActual.toString(), sigla: '', numero_fichero: '', tipo_tramite_id: '', empresa_id: '',
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
  const { data: siglas = [] } = useQuery({
    queryKey: ['siglas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('siglas_ministerio').select('*').order('orden').order('nombre');
      if (error) throw error;
      return data as Sigla[];
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
  const siglaVigente = siglas.find((s) => s.vigente)?.sigla ?? '';

  const q = busca.trim().toLowerCase();
  const filtrados = q
    ? expedientes.filter((e) =>
        [`${e.sigla ?? ''} ${e.numero}/${e.anio}`, `${e.numero}`, empNom(e.empresa_id), tipoNom(e.tipo_tramite_id)]
          .join(' ').toLowerCase().includes(q))
    : expedientes;

  const crear = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('expedientes').insert({
        numero: Number(form.numero),
        anio: Number(form.anio),
        sigla: form.sigla || null,
        numero_fichero: form.numero_fichero || null,
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
    setForm({
      numero: '', anio: anioActual.toString(), sigla: siglaVigente, numero_fichero: '',
      tipo_tramite_id: '', empresa_id: '', parcela_id: '', plazo_vencimiento: '', observaciones: '',
    });
    setModal(true);
  }
  function onSubmit(e: FormEvent) { e.preventDefault(); crear.mutate(); }

  // ── Administración de siglas ──
  const refrescaSiglas = () => qc.invalidateQueries({ queryKey: ['siglas'] });
  const addSigla = useMutation({
    mutationFn: async (s: { nombre: string; sigla: string; vigente: boolean }) => {
      const orden = (siglas.at(-1)?.orden ?? 0) + 1;
      const { error } = await supabase.from('siglas_ministerio').insert({ ...s, orden });
      if (error) throw error;
    },
    onSuccess: refrescaSiglas,
  });
  const setVigente = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('siglas_ministerio').update({ vigente: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: refrescaSiglas,
  });
  const delSigla = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('siglas_ministerio').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refrescaSiglas,
  });
  const [nuevaSigla, setNuevaSigla] = useState({ nombre: '', sigla: '' });

  return (
    <div>
      <EncabezadoPagina
        titulo="Expedientes"
        descripcion={`${expedientes.length} en el sistema`}
        accion={puedeEditar && (
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={() => setModalSiglas(true)}>⚙ Siglas</Boton>
            <Boton onClick={abrir}>+ Nuevo expediente</Boton>
          </div>
        )}
      />

      <input
        className={`${inputCls} mb-4 max-w-sm`} placeholder="Buscar por N° de expediente o empresa…"
        value={busca} onChange={(e) => setBusca(e.target.value)}
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
            {!isLoading && filtrados.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Sin expedientes.</td></tr>
            )}
            {filtrados.map((e) => {
              const s = semaforo(e);
              return (
                <tr key={e.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/expedientes/${e.id}`)}>
                  <td className="px-4 py-3"><span className="text-slate-600">{ESTADO_LABEL[e.estado]}</span></td>
                  <td className="px-4 py-3 font-semibold text-[var(--brand)]">{fmtExp(e)}</td>
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

      {/* Modal: nuevo expediente */}
      <Modal titulo="Nuevo expediente" abierto={modal} onCerrar={() => setModal(false)}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Campo label="N° de expediente">
              <input className={inputCls} type="number" min={1} required value={form.numero}
                placeholder="Ej: 1234" onChange={(ev) => setForm({ ...form, numero: ev.target.value })} />
            </Campo>
            <Campo label="Año">
              <input className={inputCls} type="number" required value={form.anio}
                onChange={(ev) => setForm({ ...form, anio: ev.target.value })} />
            </Campo>
            <Campo label="Sigla">
              <select className={inputCls} value={form.sigla}
                onChange={(ev) => setForm({ ...form, sigla: ev.target.value })}>
                <option value="">— sin sigla —</option>
                {siglas.map((s) => (
                  <option key={s.id} value={s.sigla}>{s.sigla}{s.vigente ? ' (vigente)' : ''}</option>
                ))}
              </select>
            </Campo>
          </div>
          <p className="text-xs text-slate-500">El número lo asigna el Ministerio: cargalo tal cual figura en la carátula. La sigla vigente viene seleccionada por defecto; para un expediente viejo elegí la sigla histórica.</p>
          <Campo label="Tipo de trámite">
            <select className={inputCls} required value={form.tipo_tramite_id}
              onChange={(ev) => setForm({ ...form, tipo_tramite_id: ev.target.value })}>
              <option value="">Elegí…</option>
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </Campo>
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
          <div className="grid grid-cols-2 gap-4">
            <Campo label="N° de fichero (archivo físico)">
              <input className={inputCls} value={form.numero_fichero} placeholder="Ej: F-128"
                onChange={(ev) => setForm({ ...form, numero_fichero: ev.target.value })} />
            </Campo>
            <Campo label="Plazo de vencimiento (opcional)">
              <input className={inputCls} type="date" value={form.plazo_vencimiento}
                onChange={(ev) => setForm({ ...form, plazo_vencimiento: ev.target.value })} />
            </Campo>
          </div>
          <Campo label="Observaciones">
            <textarea className={inputCls} rows={2} value={form.observaciones}
              onChange={(ev) => setForm({ ...form, observaciones: ev.target.value })} />
          </Campo>
          <p className="text-xs text-slate-500">Se generan las etapas del flujo según el tipo de trámite.</p>
          {crear.isError && <p className="text-sm text-red-600">No se pudo crear. ¿Ya existe un expediente con ese número, año y sigla?</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Boton type="button" variante="secundario" onClick={() => setModal(false)}>Cancelar</Boton>
            <Boton type="submit" disabled={crear.isPending}>{crear.isPending ? 'Creando…' : 'Crear expediente'}</Boton>
          </div>
        </form>
      </Modal>

      {/* Modal: administrar siglas del Ministerio */}
      <Modal titulo="Siglas del Ministerio" abierto={modalSiglas} onCerrar={() => setModalSiglas(false)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Cargá las denominaciones que tuvo el Ministerio con su sigla. La marcada como <strong>vigente</strong> es la que aparece por defecto al crear un expediente.</p>

          <div className="space-y-2">
            {siglas.length === 0 && <p className="text-sm text-slate-400">Todavía no hay siglas cargadas.</p>}
            {siglas.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-sm border border-slate-100 rounded-lg px-3 py-2">
                <span className="font-semibold text-[var(--brand)] w-16">{s.sigla}</span>
                <span className="flex-1 text-slate-600">{s.nombre}</span>
                {s.vigente
                  ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Vigente</span>
                  : <button onClick={() => setVigente.mutate(s.id)} className="text-xs text-[var(--brand)] hover:underline">Marcar vigente</button>}
                <button onClick={() => { if (confirm(`¿Eliminar la sigla "${s.sigla}"?`)) delSigla.mutate(s.id); }}
                  className="text-slate-300 hover:text-red-600" title="Eliminar">✕</button>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (!nuevaSigla.nombre.trim() || !nuevaSigla.sigla.trim()) return;
              addSigla.mutate({ ...nuevaSigla, vigente: siglas.length === 0 });
              setNuevaSigla({ nombre: '', sigla: '' });
            }}
            className="grid grid-cols-[1fr,2fr,auto] gap-2 items-end border-t border-slate-100 pt-3"
          >
            <Campo label="Sigla">
              <input className={inputCls} placeholder="MP" value={nuevaSigla.sigla}
                onChange={(e) => setNuevaSigla({ ...nuevaSigla, sigla: e.target.value })} />
            </Campo>
            <Campo label="Denominación">
              <input className={inputCls} placeholder="Ministerio de Producción" value={nuevaSigla.nombre}
                onChange={(e) => setNuevaSigla({ ...nuevaSigla, nombre: e.target.value })} />
            </Campo>
            <Boton type="submit" disabled={addSigla.isPending}>Agregar</Boton>
          </form>
        </div>
      </Modal>
    </div>
  );
}
