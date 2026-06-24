import { useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { usePermisos } from '../lib/permisos';
import { Boton, Modal, Campo, inputCls } from '../components/ui';
import {
  semaforo, SEMAFORO_COLOR, ESTADO_LABEL, diasEnEtapa,
  type Expediente, type Etapa,
} from '../lib/expediente';
import { fmtFecha } from '../lib/fechas';
import { exportarHojaRuta } from '../lib/pdfHojaRuta';

interface SubTramite {
  id: string;
  expediente_etapa_id: string;
  orden: number;
  nombre: string;
  obligatorio: boolean;
  completado: boolean;
  foja_desde: number | null;
  foja_hasta: number | null;
}

/** "f. 30–48" / "f. 49" / "" según las fojas cargadas. */
function fmtFoja(d: number | null, h: number | null): string {
  if (d == null && h == null) return '';
  if (d != null && h != null && h !== d) return `f. ${d}–${h}`;
  return `f. ${d ?? h}`;
}

export default function ExpedienteDetalle() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { puedeEditar } = usePermisos();
  const [edit, setEdit] = useState<Etapa | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [altaReq, setAltaReq] = useState<{ etapaId: string; nombre: string; obligatorio: boolean; foja_desde: string; foja_hasta: string } | null>(null);
  const [repetir, setRepetir] = useState<{ sub: SubTramite; etapaDestino: string } | null>(null);
  const [fojaEdit, setFojaEdit] = useState<{ sub: SubTramite; desde: string; hasta: string } | null>(null);
  const [moverModal, setMoverModal] = useState<{ aUsuario: string; nota: string } | null>(null);

  const { data: exp, isLoading } = useQuery({
    queryKey: ['expediente', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('expedientes').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Expediente;
    },
  });
  const { data: etapas = [] } = useQuery({
    queryKey: ['etapas', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('expediente_etapas').select('*').eq('expediente_id', id).order('orden');
      if (error) throw error;
      return data as Etapa[];
    },
  });
  const { data: subtramites = [] } = useQuery({
    queryKey: ['subtramites', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expediente_subtramites')
        .select('*')
        .in('expediente_etapa_id', etapas.map((e) => e.id).length ? etapas.map((e) => e.id) : ['00000000-0000-0000-0000-000000000000'])
        .order('orden');
      if (error) throw error;
      return data as SubTramite[];
    },
    enabled: etapas.length > 0,
  });

  // Tras cualquier cambio de requisito puede dispararse el avance automático,
  // así que refrescamos también etapas y el expediente.
  const refrescaTodo = () => {
    qc.invalidateQueries({ queryKey: ['subtramites', id] });
    qc.invalidateQueries({ queryKey: ['etapas', id] });
    qc.invalidateQueries({ queryKey: ['expediente', id] });
    qc.invalidateQueries({ queryKey: ['expedientes'] });
  };
  const subsDe = (etapaId: string) => subtramites.filter((s) => s.expediente_etapa_id === etapaId);
  const obligPendientes = (etapaId: string) => subsDe(etapaId).filter((s) => s.obligatorio && !s.completado);

  const toggleSub = useMutation({
    mutationFn: async (s: SubTramite) => {
      const { error } = await supabase.from('expediente_subtramites')
        .update({ completado: !s.completado, completado_at: !s.completado ? new Date().toISOString() : null })
        .eq('id', s.id);
      if (error) throw error;
    },
    onSuccess: () => { setMensaje(''); refrescaTodo(); },
    onError: (e: unknown) => setMensaje(traducirError(e)),
  });
  const setObligatorio = useMutation({
    mutationFn: async ({ s, valor }: { s: SubTramite; valor: boolean }) => {
      const { error } = await supabase.from('expediente_subtramites').update({ obligatorio: valor }).eq('id', s.id);
      if (error) throw error;
    },
    onSuccess: refrescaTodo,
  });
  const addSub = useMutation({
    mutationFn: async (r: { etapaId: string; nombre: string; obligatorio: boolean; foja_desde: string; foja_hasta: string }) => {
      const orden = (subsDe(r.etapaId).at(-1)?.orden ?? 0) + 1;
      const { error } = await supabase.from('expediente_subtramites').insert({
        expediente_etapa_id: r.etapaId, nombre: r.nombre, orden, obligatorio: r.obligatorio,
        foja_desde: r.foja_desde ? Number(r.foja_desde) : null,
        foja_hasta: r.foja_hasta ? Number(r.foja_hasta) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setAltaReq(null); refrescaTodo(); },
  });
  const guardarFoja = useMutation({
    mutationFn: async ({ sub, desde, hasta }: { sub: SubTramite; desde: string; hasta: string }) => {
      const { error } = await supabase.from('expediente_subtramites').update({
        foja_desde: desde ? Number(desde) : null,
        foja_hasta: hasta ? Number(hasta) : null,
      }).eq('id', sub.id);
      if (error) throw error;
    },
    onSuccess: () => { setFojaEdit(null); refrescaTodo(); },
  });
  const repetirSub = useMutation({
    mutationFn: async ({ sub, etapaDestino }: { sub: SubTramite; etapaDestino: string }) => {
      const orden = (subsDe(etapaDestino).at(-1)?.orden ?? 0) + 1;
      const { error } = await supabase.from('expediente_subtramites')
        .insert({ expediente_etapa_id: etapaDestino, nombre: sub.nombre, orden, obligatorio: true });
      if (error) throw error;
    },
    onSuccess: () => { setRepetir(null); refrescaTodo(); },
  });
  const delSub = useMutation({
    mutationFn: async (sid: string) => {
      const { error } = await supabase.from('expediente_subtramites').delete().eq('id', sid);
      if (error) throw error;
    },
    onSuccess: refrescaTodo,
  });

  const { data: tipo } = useQuery({
    enabled: !!exp?.tipo_tramite_id,
    queryKey: ['tipo', exp?.tipo_tramite_id],
    queryFn: async () => {
      const { data } = await supabase.from('tipos_tramite').select('nombre').eq('id', exp!.tipo_tramite_id!).maybeSingle();
      return data?.nombre as string | undefined;
    },
  });
  const { data: empresa } = useQuery({
    enabled: !!exp?.empresa_id,
    queryKey: ['empresa', exp?.empresa_id],
    queryFn: async () => {
      const { data } = await supabase.from('empresas').select('razon_social').eq('id', exp!.empresa_id!).maybeSingle();
      return data?.razon_social as string | undefined;
    },
  });
  const { data: parcela } = useQuery({
    enabled: !!exp?.parcela_id,
    queryKey: ['parcela', exp?.parcela_id],
    queryFn: async () => {
      const { data } = await supabase.from('parcelas').select('identificacion').eq('id', exp!.parcela_id!).maybeSingle();
      return data?.identificacion as string | undefined;
    },
  });

  // ── Custodia física (ficheros / pasamano) ──
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-min'],
    queryFn: async () => {
      const { data, error } = await supabase.from('usuarios').select('id, nombre').eq('activo', true).order('nombre');
      if (error) throw error;
      return data as { id: string; nombre: string }[];
    },
  });
  const { data: custodia = [] } = useQuery({
    queryKey: ['custodia', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('custodia_movimientos').select('*').eq('expediente_id', id).order('fecha', { ascending: false });
      if (error) throw error;
      return data as { id: string; de_usuario: string | null; a_usuario: string | null; registrado_por: string | null; nota: string | null; fecha: string }[];
    },
  });
  const usrNom = (uid: string | null) => uid ? (usuarios.find((u) => u.id === uid)?.nombre ?? '—') : 'Archivo';

  const moverExp = useMutation({
    mutationFn: async ({ aUsuario, nota }: { aUsuario: string; nota: string }) => {
      const { error } = await supabase.rpc('mover_expediente', { p_exp: id, p_a_usuario: aUsuario || null, p_nota: nota || null });
      if (error) throw error;
    },
    onSuccess: () => {
      setMoverModal(null); setMensaje('');
      qc.invalidateQueries({ queryKey: ['custodia', id] });
      qc.invalidateQueries({ queryKey: ['expediente', id] });
    },
    onError: (e: unknown) => setMensaje(traducirError(e)),
  });

  const refrescaEtapas = () => {
    qc.invalidateQueries({ queryKey: ['etapas', id] });
    qc.invalidateQueries({ queryKey: ['expediente', id] });
    qc.invalidateQueries({ queryKey: ['expedientes'] });
  };

  const guardarEtapa = useMutation({
    mutationFn: async (e: Etapa) => {
      const { error } = await supabase.from('expediente_etapas')
        .update({ nombre: e.nombre, fecha_entrada: e.fecha_entrada, fecha_salida: e.fecha_salida })
        .eq('id', e.id);
      if (error) throw error;
    },
    onSuccess: () => { refrescaEtapas(); setEdit(null); },
  });
  const eliminarEtapa = useMutation({
    mutationFn: async (eid: string) => {
      const { error } = await supabase.from('expediente_etapas').delete().eq('id', eid);
      if (error) throw error;
    },
    onSuccess: refrescaEtapas,
  });
  const agregarEtapa = useMutation({
    mutationFn: async () => {
      const nombre = prompt('Nombre del nuevo movimiento / hito:');
      if (!nombre) return;
      const orden = (etapas.at(-1)?.orden ?? 0) + 1;
      const { error } = await supabase.from('expediente_etapas')
        .insert({ expediente_id: id, orden, nombre, estado: 'pendiente' });
      if (error) throw error;
    },
    onSuccess: refrescaEtapas,
  });

  const avanzar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('avanzar_expediente', { p_exp: id });
      if (error) throw error;
    },
    onSuccess: () => { setMensaje(''); refrescaTodo(); },
    onError: (e: unknown) => setMensaje(traducirError(e)),
  });
  const reabrir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('reabrir_etapa', { p_exp: id });
      if (error) throw error;
    },
    onSuccess: () => { setMensaje(''); refrescaTodo(); },
    onError: (e: unknown) => setMensaje(traducirError(e)),
  });

  if (isLoading || !exp) return <div className="text-slate-400">Cargando…</div>;

  const s = semaforo(exp);
  const actual = etapas.find((e) => e.estado === 'en_curso');
  const cerrado = exp.estado === 'finalizado' || exp.estado === 'archivado' || exp.estado === 'baja';
  const haySiguiente = !!etapas.find((e) => e.orden === (actual?.orden ?? 0) + 1);
  const faltanActual = actual ? obligPendientes(actual.id) : [];
  const listo = !!actual && faltanActual.length === 0;       // etapa lista para avanzar
  const hayCompletadas = etapas.some((e) => e.estado === 'completada');

  return (
    <div>
      <button onClick={() => navigate('/expedientes')} className="text-sm text-slate-500 hover:text-slate-800 mb-3">← Volver a expedientes</button>

      {/* Cabecera / Centro de control */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full" style={{ background: SEMAFORO_COLOR[s.color] }} />
              <h1 className="text-2xl font-bold text-slate-800">Expediente {exp.sigla ? `${exp.sigla} ` : ''}{exp.numero}/{exp.anio}</h1>
            </div>
            <p className="text-slate-500 mt-1">{tipo ?? 'Sin tipo'} · {empresa ?? 'Sin empresa'}</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-slate-700">{ESTADO_LABEL[exp.estado]}</div>
            <div className="text-xs" style={{ color: SEMAFORO_COLOR[s.color] }}>{s.motivo}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 text-sm">
          <Dato label="Etapa actual" valor={actual?.nombre ?? (cerrado ? 'Cerrado' : '—')} />
          <Dato label="Días en etapa" valor={actual && diasEnEtapa(actual) != null ? `${diasEnEtapa(actual)}` : '—'} />
          <Dato label="Inicio" valor={fmtFecha(exp.fecha_inicio)} />
          <Dato label="Vencimiento" valor={fmtFecha(exp.plazo_vencimiento)} />
        </div>

        {exp.observaciones && <p className="mt-4 text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{exp.observaciones}</p>}

        <div className="mt-5 flex flex-wrap gap-2">
          {/* El estado avanza automáticamente; el botón solo aparece cuando la
              etapa está lista (manual para hitos sin obligatorios o para cerrar). */}
          {puedeEditar && !cerrado && actual && listo && (
            <Boton onClick={() => avanzar.mutate()} disabled={avanzar.isPending}>
              {avanzar.isPending ? 'Avanzando…'
                : haySiguiente ? 'Avanzar al hito siguiente →' : 'Finalizar expediente ✓'}
            </Boton>
          )}
          {puedeEditar && (hayCompletadas || cerrado) && (
            <Boton variante="secundario" onClick={() => { if (confirm('¿Reabrir la etapa anterior para corregir?')) reabrir.mutate(); }} disabled={reabrir.isPending}>
              ↩ Reabrir etapa anterior
            </Boton>
          )}
          <Boton variante="secundario"
            onClick={() => exportarHojaRuta(exp, etapas, subtramites, { tipo, empresa, parcela })}>
            📄 Exportar hoja de ruta (PDF)
          </Boton>
        </div>

        {/* Estado de avance del hito en curso */}
        {puedeEditar && !cerrado && actual && !listo && (
          <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <strong>El trámite avanza solo</strong> al completar los requisitos obligatorios de «{actual.nombre}».
            Faltan: {faltanActual.map((r) => r.nombre).join(', ')}.
          </div>
        )}
        {mensaje && (
          <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{mensaje}</div>
        )}
      </div>

      {/* Custodia física / ubicación del expediente */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="font-semibold text-slate-800">Custodia / ubicación física</h2>
          <Boton variante="secundario" onClick={() => { setMensaje(''); setMoverModal({ aUsuario: '', nota: '' }); }}>Entregar / mover</Boton>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Dato label="N° de fichero" valor={exp.numero_fichero ?? '—'} />
          <Dato label="Ubicación actual" valor={exp.poseedor_actual ? `En poder de ${usrNom(exp.poseedor_actual)}` : 'En el archivo'} />
          <Dato label="Movimientos" valor={`${custodia.length}`} />
        </div>
        {custodia.length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-slate-400 mb-1">Ruta interna (quién lo tuvo)</div>
            <ol className="space-y-1 text-sm">
              {custodia.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-slate-600 flex-wrap">
                  <span className="text-slate-400 text-xs whitespace-nowrap">{new Date(m.fecha).toLocaleString('es-AR')}</span>
                  <span>{usrNom(m.de_usuario)} → <strong className="text-slate-800">{usrNom(m.a_usuario)}</strong></span>
                  {m.nota && <span className="text-slate-400">· {m.nota}</span>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Timeline del trámite</h2>
          {puedeEditar && (
            <button onClick={() => agregarEtapa.mutate()} className="text-sm text-[var(--brand)] hover:underline">+ Agregar movimiento</button>
          )}
        </div>
        {etapas.length === 0 ? (
          <p className="text-slate-400">Este expediente no tiene etapas (se crean según el tipo de trámite).</p>
        ) : (
          <ol className="relative border-l-2 border-slate-200 ml-2">
            {etapas.map((et) => {
              const color = et.estado === 'completada' ? '#16a34a' : et.estado === 'en_curso' ? '#2563eb' : '#cbd5e1';
              const reqs = subsDe(et.id);
              const pend = obligPendientes(et.id).length;
              const editable = et.estado === 'en_curso';   // solo la etapa en curso admite marcar requisitos
              const bloqueadaFutura = et.estado === 'pendiente';
              return (
                <li key={et.id} className="ml-6 pb-6 last:pb-0">
                  <span className="absolute -left-[9px] w-4 h-4 rounded-full border-2 border-white" style={{ background: color }} />
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className={`font-medium ${et.estado === 'en_curso' ? 'text-[var(--brand)]' : 'text-slate-700'}`}>
                      {et.orden}. {et.nombre}
                    </span>
                    <div className="flex items-center gap-2">
                      {reqs.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={pend > 0
                            ? { background: '#fef3c7', color: '#b45309' }
                            : { background: '#dcfce7', color: '#15803d' }}>
                          {reqs.filter((r) => r.completado).length}/{reqs.length} requisitos{pend > 0 ? ` · ${pend} oblig. pend.` : ''}
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: color + '22', color }}>
                        {et.estado === 'completada' ? 'Completada' : et.estado === 'en_curso' ? 'En curso' : 'Pendiente'}
                      </span>
                      {puedeEditar && (
                        <>
                          <button onClick={() => setEdit(et)} className="text-xs text-slate-400 hover:text-[var(--brand)]" title="Editar nombre/fechas">✎</button>
                          <button onClick={() => { if (confirm(`¿Eliminar el movimiento "${et.nombre}"?`)) eliminarEtapa.mutate(et.id); }} className="text-xs text-slate-400 hover:text-red-600" title="Eliminar">✕</button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {et.fecha_entrada && `Inicio: ${fmtFecha(et.fecha_entrada)}`}
                    {et.fecha_salida && ` · Fin: ${fmtFecha(et.fecha_salida)}`}
                  </div>

                  {/* Requisitos / trámites secundarios de esta etapa */}
                  <div className="mt-2 space-y-1">
                    {bloqueadaFutura && reqs.length > 0 && (
                      <p className="text-xs text-slate-400">🔒 Se habilitan al llegar a esta etapa.</p>
                    )}
                    {reqs.map((sub) => {
                      const foja = fmtFoja(sub.foja_desde, sub.foja_hasta);
                      return (
                        <div key={sub.id} className="flex items-center gap-2 text-sm group">
                          <input type="checkbox" checked={sub.completado} disabled={!puedeEditar || !editable}
                            onChange={() => toggleSub.mutate(sub)} className="accent-[var(--brand)] disabled:opacity-50" />
                          <span className={sub.completado ? 'line-through text-slate-400' : 'text-slate-600'}>
                            {sub.nombre}
                            {sub.obligatorio
                              ? <span className="text-red-400" title="Obligatorio"> *</span>
                              : <span className="text-slate-300 text-xs" title="No obligatorio"> (opcional)</span>}
                          </span>
                          {/* Foja: ubicación en el expediente físico */}
                          <button
                            onClick={() => puedeEditar && !cerrado && setFojaEdit({ sub, desde: sub.foja_desde?.toString() ?? '', hasta: sub.foja_hasta?.toString() ?? '' })}
                            className={`text-xs px-1.5 py-0.5 rounded ${foja ? 'bg-slate-100 text-slate-600' : 'text-slate-300'} ${puedeEditar && !cerrado ? 'hover:bg-slate-200' : 'cursor-default'}`}
                            title="Foja en el expediente físico">
                            {foja || (puedeEditar && !cerrado ? '+ foja' : '')}
                          </button>
                          {puedeEditar && !cerrado && (
                            <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                              <button onClick={() => setObligatorio.mutate({ s: sub, valor: !sub.obligatorio })}
                                className="text-slate-300 hover:text-[var(--brand)] text-xs"
                                title={sub.obligatorio ? 'Marcar como opcional' : 'Marcar como obligatorio'}>
                                {sub.obligatorio ? '↧' : '↥'}
                              </button>
                              <button onClick={() => setRepetir({ sub, etapaDestino: '' })}
                                className="text-slate-300 hover:text-[var(--brand)] text-xs" title="Repetir en otra etapa como obligatorio">↗</button>
                              <button onClick={() => delSub.mutate(sub.id)}
                                className="text-slate-300 hover:text-red-600 text-xs" title="Quitar">✕</button>
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {puedeEditar && !cerrado && (
                      <button onClick={() => setAltaReq({ etapaId: et.id, nombre: '', obligatorio: true, foja_desde: '', foja_hasta: '' })}
                        className="text-xs text-[var(--brand)] hover:underline">+ Agregar requisito</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Modal: editar movimiento (nombre y fechas; el estado avanza solo) */}
      <Modal titulo="Editar movimiento" abierto={!!edit} onCerrar={() => setEdit(null)}>
        {edit && (
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); guardarEtapa.mutate(edit); }} className="space-y-4">
            <Campo label="Nombre del movimiento">
              <input className={inputCls} value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} />
            </Campo>
            <p className="text-xs text-slate-500">El estado del hito no se edita a mano: avanza automáticamente cuando se completan los requisitos obligatorios.</p>
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Fecha de inicio">
                <input className={inputCls} type="date" value={(edit.fecha_entrada ?? '').slice(0, 10)}
                  onChange={(e) => setEdit({ ...edit, fecha_entrada: e.target.value || null })} />
              </Campo>
              <Campo label="Fecha de fin">
                <input className={inputCls} type="date" value={(edit.fecha_salida ?? '').slice(0, 10)}
                  onChange={(e) => setEdit({ ...edit, fecha_salida: e.target.value || null })} />
              </Campo>
            </div>
            {guardarEtapa.isError && <p className="text-sm text-red-600">No se pudo guardar.</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Boton type="button" variante="secundario" onClick={() => setEdit(null)}>Cancelar</Boton>
              <Boton type="submit" disabled={guardarEtapa.isPending}>{guardarEtapa.isPending ? 'Guardando…' : 'Guardar'}</Boton>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: nuevo requisito */}
      <Modal titulo="Nuevo requisito" abierto={!!altaReq} onCerrar={() => setAltaReq(null)}>
        {altaReq && (
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (altaReq.nombre.trim()) addSub.mutate(altaReq); }} className="space-y-4">
            <Campo label="Nombre del requisito">
              <input className={inputCls} autoFocus value={altaReq.nombre}
                onChange={(e) => setAltaReq({ ...altaReq, nombre: e.target.value })} />
            </Campo>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={altaReq.obligatorio} className="accent-[var(--brand)]"
                onChange={(e) => setAltaReq({ ...altaReq, obligatorio: e.target.checked })} />
              Obligatorio para avanzar la etapa
            </label>
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Foja desde (opcional)">
                <input className={inputCls} type="number" min={1} value={altaReq.foja_desde}
                  onChange={(e) => setAltaReq({ ...altaReq, foja_desde: e.target.value })} />
              </Campo>
              <Campo label="Foja hasta (si abarca varias)">
                <input className={inputCls} type="number" min={1} value={altaReq.foja_hasta}
                  onChange={(e) => setAltaReq({ ...altaReq, foja_hasta: e.target.value })} />
              </Campo>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Boton type="button" variante="secundario" onClick={() => setAltaReq(null)}>Cancelar</Boton>
              <Boton type="submit" disabled={addSub.isPending || !altaReq.nombre.trim()}>{addSub.isPending ? 'Agregando…' : 'Agregar'}</Boton>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: foja del requisito */}
      <Modal titulo="Foja en el expediente físico" abierto={!!fojaEdit} onCerrar={() => setFojaEdit(null)}>
        {fojaEdit && (
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); guardarFoja.mutate(fojaEdit); }} className="space-y-4">
            <p className="text-sm text-slate-600">«<strong>{fojaEdit.sub.nombre}</strong>». Indicá la foja inicial; si abarca varias hojas, también la final.</p>
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Foja desde">
                <input className={inputCls} type="number" min={1} autoFocus value={fojaEdit.desde}
                  onChange={(e) => setFojaEdit({ ...fojaEdit, desde: e.target.value })} />
              </Campo>
              <Campo label="Foja hasta (opcional)">
                <input className={inputCls} type="number" min={1} value={fojaEdit.hasta}
                  onChange={(e) => setFojaEdit({ ...fojaEdit, hasta: e.target.value })} />
              </Campo>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Boton type="button" variante="secundario" onClick={() => setFojaEdit(null)}>Cancelar</Boton>
              <Boton type="submit" disabled={guardarFoja.isPending}>{guardarFoja.isPending ? 'Guardando…' : 'Guardar'}</Boton>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: repetir requisito en otra etapa */}
      <Modal titulo="Repetir requisito en otra etapa" abierto={!!repetir} onCerrar={() => setRepetir(null)}>
        {repetir && (
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (repetir.etapaDestino) repetirSub.mutate(repetir); }} className="space-y-4">
            <p className="text-sm text-slate-600">
              Se agregará «<strong>{repetir.sub.nombre}</strong>» como requisito <strong>obligatorio</strong> en la etapa que elijas.
            </p>
            <Campo label="Etapa destino">
              <select className={inputCls} value={repetir.etapaDestino}
                onChange={(e) => setRepetir({ ...repetir, etapaDestino: e.target.value })}>
                <option value="">Elegí…</option>
                {etapas.filter((e) => e.id !== repetir.sub.expediente_etapa_id).map((e) => (
                  <option key={e.id} value={e.id}>{e.orden}. {e.nombre}</option>
                ))}
              </select>
            </Campo>
            <div className="flex justify-end gap-2 pt-2">
              <Boton type="button" variante="secundario" onClick={() => setRepetir(null)}>Cancelar</Boton>
              <Boton type="submit" disabled={repetirSub.isPending || !repetir.etapaDestino}>{repetirSub.isPending ? 'Agregando…' : 'Agregar'}</Boton>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: entregar / mover expediente (custodia) */}
      <Modal titulo="Entregar / mover expediente" abierto={!!moverModal} onCerrar={() => setMoverModal(null)}>
        {moverModal && (
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); moverExp.mutate(moverModal); }} className="space-y-4">
            <p className="text-sm text-slate-600">
              Ubicación actual: <strong>{exp.poseedor_actual ? `En poder de ${usrNom(exp.poseedor_actual)}` : 'En el archivo'}</strong>.
            </p>
            <Campo label="Entregar a">
              <select className={inputCls} value={moverModal.aUsuario}
                onChange={(e) => setMoverModal({ ...moverModal, aUsuario: e.target.value })}>
                <option value="">— Devolver al archivo —</option>
                {usuarios.filter((u) => u.id !== exp.poseedor_actual).map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            </Campo>
            <Campo label="Nota (opcional)">
              <input className={inputCls} value={moverModal.nota} onChange={(e) => setMoverModal({ ...moverModal, nota: e.target.value })} />
            </Campo>
            <p className="text-xs text-slate-500">Recordá: solo la mesa de entrada da salida del archivo; después, solo quien lo tiene en su poder puede pasarlo a otro agente.</p>
            {mensaje && <p className="text-sm text-red-600">{mensaje}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Boton type="button" variante="secundario" onClick={() => setMoverModal(null)}>Cancelar</Boton>
              <Boton type="submit" disabled={moverExp.isPending}>{moverExp.isPending ? 'Registrando…' : 'Registrar movimiento'}</Boton>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

/** Convierte el error de Postgres/Supabase en un mensaje legible. */
function traducirError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? '';
  return msg || 'No se pudo completar la acción.';
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="font-medium text-slate-800">{valor}</div>
    </div>
  );
}
