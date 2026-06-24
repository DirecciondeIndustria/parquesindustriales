import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Boton, Modal, Campo, inputCls } from '../components/ui';
import { Consultas } from '../components/Consultas';
import { ESTADO_LABEL, fmtExp } from '../lib/expediente';

interface PExp { id: string; numero: number; anio: number; sigla: string | null; estado: keyof typeof ESTADO_LABEL; etapa_actual: string | null; total_etapas: number; etapas_completadas: number; }
interface PNota { id: string; expediente_id: string | null; numero_nota: string; asunto: string; fecha: string; storage_path: string | null; nombre_archivo: string | null; }
interface PMov { etapa_id: string; expediente_id: string; orden: number; nombre: string; estado: string; fecha_salida: string | null; }
interface PReq { id: string; expediente_etapa_id: string; nombre: string; obligatorio: boolean; completado: boolean; }

export default function Portal() {
  const { salir } = useAuth();
  const [verPass, setVerPass] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);

  const qc = useQueryClient();
  const { data: empresa } = useQuery({
    queryKey: ['portal-empresa'],
    queryFn: async () => {
      const { data, error } = await supabase.from('portal_empresa').select('*').maybeSingle();
      if (error) throw error;
      return data as { id: string; razon_social: string; email: string | null; notif_email: boolean } | null;
    },
  });

  const setNotif = useMutation({
    mutationFn: async (valor: boolean) => {
      const { error } = await supabase.rpc('portal_set_notif_email', { p_valor: valor });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-empresa'] }),
  });

  async function descargarNota(path: string) {
    const { data, error } = await supabase.storage.from('notas').createSignedUrl(path, 60);
    if (!error && data) window.open(data.signedUrl, '_blank');
  }
  const { data: expedientes = [], isLoading } = useQuery({
    queryKey: ['portal-expedientes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('portal_expedientes').select('*').order('anio', { ascending: false }).order('numero', { ascending: false });
      if (error) throw error;
      return data as PExp[];
    },
  });
  const { data: notas = [] } = useQuery({
    queryKey: ['portal-notas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('portal_notas').select('*').order('fecha', { ascending: false });
      if (error) throw error;
      return data as PNota[];
    },
  });
  const { data: movimientos = [] } = useQuery({
    queryKey: ['portal-movimientos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('portal_movimientos').select('*').order('orden');
      if (error) throw error;
      return data as PMov[];
    },
  });
  const { data: requisitos = [] } = useQuery({
    queryKey: ['portal-requisitos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('portal_requisitos').select('*').order('orden');
      if (error) throw error;
      return data as PReq[];
    },
  });

  const movsDe = (expId: string) => movimientos.filter((m) => m.expediente_id === expId);
  const reqsDe = (etapaId: string) => requisitos.filter((r) => r.expediente_etapa_id === etapaId);
  const notasDe = (expId: string) => notas.filter((n) => n.expediente_id === expId);

  return (
    <div className="min-h-full bg-slate-50">
      {/* Encabezado */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white grid place-items-center overflow-hidden ring-1 ring-slate-200">
              <img src="/logo-silueta.png" alt="" className="w-8 h-8 object-contain" />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-slate-800">Portal de seguimiento</div>
              <div className="text-xs text-slate-500">Dirección de Industria · Chubut</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Boton variante="secundario" onClick={() => setVerPass(true)}>Cambiar contraseña</Boton>
            <Boton variante="secundario" onClick={salir}>Salir</Boton>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-800">{empresa?.razon_social ?? 'Mi empresa'}</h1>
        <p className="text-slate-500 mb-4">Estado de sus expedientes en la Dirección de Industria. Información de referencia.</p>

        {/* Notificación digital: aceptación única e irrevocable desde el portal */}
        {empresa && (empresa.notif_email ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-sm text-emerald-900">
            <div className="font-semibold mb-1">✔ Notificación digital ACTIVA{empresa.email ? ` · ${empresa.email}` : ''}</div>
            <p>
              Mientras permanezca activa, las notificaciones cursadas por este medio son <strong>válidas</strong> y se
              considerará a la empresa <strong>notificada</strong> de los requerimientos y de los <strong>plazos otorgados</strong>.
              Para revocar esta modalidad deberá presentar <strong>nota firmada por Mesa de Entrada</strong> del Ministerio de
              Producción y aguardar a que la Dirección de Industria la dé de baja.
            </p>
          </div>
        ) : (
          <div className="bg-white ring-1 ring-slate-200 rounded-2xl p-4 mb-6 text-sm">
            <div className="font-semibold text-slate-800 mb-1">Notificación digital de notas</div>
            <p className="text-slate-600 mb-3">
              Puede optar por recibir las notas de la Dirección de Industria por este medio. <strong>La aceptación es por única vez</strong>:
              una vez aceptada, para revocarla deberá presentar <strong>nota firmada por Mesa de Entrada</strong> y aguardar a que la Dirección la dé de baja.
              Mientras esté activa, se considerará a la empresa <strong>notificada</strong> de los requerimientos y plazos cursados por esta vía.
            </p>
            <Boton
              disabled={setNotif.isPending}
              onClick={() => { if (confirm('¿Confirma que acepta recibir notificaciones por la vía digital? La aceptación es por única vez y solo se revoca por nota firmada en Mesa de Entrada.')) setNotif.mutate(true); }}>
              {setNotif.isPending ? 'Procesando…' : 'Acepto recibir notificaciones por esta vía'}
            </Boton>
          </div>
        ))}

        {/* Notas / solicitudes de documentación */}
        {notas.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
            <h2 className="font-semibold text-amber-800 mb-2">📬 Notas / solicitudes</h2>
            <div className="space-y-2">
              {notas.map((n) => (
                <div key={n.id} className="text-sm text-amber-900 flex items-center gap-2 flex-wrap">
                  <span><strong>Nota N° {n.numero_nota}</strong> — {n.asunto}
                    <span className="text-amber-700"> · {new Date(n.fecha).toLocaleDateString('es-AR')}</span></span>
                  {n.storage_path && (
                    <button onClick={() => descargarNota(n.storage_path!)} className="text-xs font-medium text-amber-800 underline hover:text-amber-900">
                      ⬇ Descargar nota{n.nombre_archivo ? ` (${n.nombre_archivo})` : ''}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-700 mt-2">Si se le solicitó documentación, recibirá la nota oficial en el domicilio declarado. Esté atento para responder a la brevedad.</p>
          </div>
        )}

        {/* Expedientes */}
        {isLoading ? (
          <p className="text-slate-400">Cargando…</p>
        ) : expedientes.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center text-slate-500">No hay expedientes asociados a su empresa.</div>
        ) : (
          <div className="space-y-3">
            {expedientes.map((e) => {
              const pct = e.total_etapas ? Math.round((e.etapas_completadas / e.total_etapas) * 100) : 0;
              const cerrado = e.estado === 'finalizado' || e.estado === 'archivado';
              const open = abierto === e.id;
              return (
                <div key={e.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <button onClick={() => setAbierto(open ? null : e.id)} className="w-full text-left p-5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="text-lg font-bold text-[var(--brand)] tabular-nums">Expediente {fmtExp(e)}</div>
                      <span className="text-xs px-2.5 py-1 rounded-full" style={cerrado ? { background: '#dcfce7', color: '#15803d' } : { background: '#dbeafe', color: '#1d4ed8' }}>
                        {ESTADO_LABEL[e.estado]}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      {cerrado ? 'Trámite finalizado.' : <>Etapa actual: <strong>{e.etapa_actual ?? '—'}</strong></>}
                    </div>
                    <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--brand-grad)' }} />
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{e.etapas_completadas} de {e.total_etapas} etapas · {open ? 'ocultar detalle ▲' : 'ver detalle ▼'}</div>
                  </button>
                  {open && (
                    <div className="px-5 pb-5 border-t border-slate-100">
                      {notasDe(e.id).length > 0 && (
                        <div className="mt-3 text-sm text-amber-800">
                          {notasDe(e.id).map((n) => <div key={n.id}>📬 Nota N° {n.numero_nota} — {n.asunto}</div>)}
                        </div>
                      )}
                      <ol className="relative border-l-2 border-slate-200 ml-2 mt-3">
                        {movsDe(e.id).map((m) => {
                          const color = m.estado === 'completada' ? '#16a34a' : m.estado === 'en_curso' ? '#2563eb' : '#cbd5e1';
                          return (
                            <li key={m.orden} className="ml-5 pb-4 last:pb-0">
                              <span className="absolute -left-[7px] w-3.5 h-3.5 rounded-full border-2 border-white" style={{ background: color }} />
                              <div className="text-sm font-medium text-slate-700">{m.nombre}</div>
                              <div className="text-xs text-slate-400">
                                {m.estado === 'completada' ? 'Completada' : m.estado === 'en_curso' ? 'En curso' : 'Pendiente'}
                                {m.fecha_salida && ` · ${new Date(m.fecha_salida).toLocaleDateString('es-AR')}`}
                              </div>
                              {/* Requisitos: solo de hitos completados o en curso (la base no expone los futuros) */}
                              {reqsDe(m.etapa_id).length > 0 && (
                                <ul className="mt-1.5 space-y-0.5">
                                  {reqsDe(m.etapa_id).map((r) => (
                                    <li key={r.id} className="flex items-center gap-1.5 text-xs">
                                      <span className={r.completado ? 'text-emerald-600' : 'text-slate-300'}>{r.completado ? '☑' : '☐'}</span>
                                      <span className={r.completado ? 'text-slate-500 line-through' : 'text-slate-600'}>
                                        {r.nombre}{r.obligatorio && <span className="text-red-400" title="Obligatorio"> *</span>}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          );
                        })}
                      </ol>

                      {empresa && (
                        <div className="mt-5 pt-4 border-t border-slate-100">
                          <h3 className="font-semibold text-slate-800 mb-2">Consultas sobre este expediente</h3>
                          <Consultas empresaId={empresa.id} expedienteId={e.id} emisor="empresa" autorNombre={empresa.razon_social} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-8">
          Este portal es informativo y a grandes rasgos. Ante cualquier duda, comuníquese con la Dirección de Industria.
        </p>
      </main>

      <CambiarPass abierto={verPass} onCerrar={() => setVerPass(false)} />
    </div>
  );
}

function CambiarPass({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [pass, setPass] = useState({ a: '', b: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(''); setErr(false);
    if (pass.a.length < 6) { setErr(true); setMsg('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (pass.a !== pass.b) { setErr(true); setMsg('Las contraseñas no coinciden.'); return; }
    const { error } = await supabase.auth.updateUser({ password: pass.a });
    if (error) { setErr(true); setMsg(error.message); return; }
    setMsg('Contraseña actualizada.'); setPass({ a: '', b: '' });
  }

  return (
    <Modal titulo="Cambiar mi contraseña" abierto={abierto} onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Campo label="Nueva contraseña (mín. 6)">
          <input className={inputCls} type="password" value={pass.a} onChange={(e) => setPass({ ...pass, a: e.target.value })} />
        </Campo>
        <Campo label="Repetir contraseña">
          <input className={inputCls} type="password" value={pass.b} onChange={(e) => setPass({ ...pass, b: e.target.value })} />
        </Campo>
        {msg && <p className={`text-sm ${err ? 'text-red-600' : 'text-emerald-600'}`}>{msg}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Boton type="button" variante="secundario" onClick={onCerrar}>Cerrar</Boton>
          <Boton type="submit">Actualizar</Boton>
        </div>
      </form>
    </Modal>
  );
}
