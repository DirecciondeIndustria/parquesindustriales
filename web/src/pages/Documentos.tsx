import { useState, useRef, useMemo, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { usePermisos } from '../lib/permisos';
import { Boton, Modal, Campo, inputCls, EncabezadoPagina } from '../components/ui';
import { TIPOS_DOCUMENTALES, TIPOS_ENTRADA, TIPOS_INSTRUMENTO, MOTIVOS_INGRESO_EXP } from '../lib/constantes';

interface Documento {
  id: string;
  tipo_documental: string;
  nombre: string;
  storage_path: string;
  tamano: number | null;
  empresa_id: string | null;
  expediente_id: string | null;
  created_at: string;
}
interface Empresa { id: string; razon_social: string; }
interface UsuarioMin { id: string; nombre: string; }
interface ExpedienteMin { id: string; numero: number; anio: number; sigla: string | null; }
interface Derivacion {
  id: string; tipo_documental: string | null; descripcion: string;
  empresa_id: string | null; expediente_id: string | null;
  de_usuario: string | null; a_usuario: string; estado: string; nota: string | null; fecha: string;
}
interface Movimiento {
  id: string; sentido: string; tipo: string;
  empresa_id: string | null; expediente_id: string | null;
  datos: Record<string, any>; observaciones: string | null;
  created_by: string | null; created_at: string;
}

// Tipos de entrada que admiten adjuntar un PDF en el registro.
const TIPOS_CON_PDF = ['Nota', 'Proyecto Industrial', 'Notificación de Personal'];

function tamañoLegible(b: number | null) {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

const fmtExpStr = (n: number, a: number, s: string | null) => `${n}/${a}${s ? ` ${s}` : ''}`;

async function abrirArchivo(path: string): Promise<boolean> {
  const { data, error } = await supabase.storage.from('documentos').createSignedUrl(path, 60);
  if (error || !data) return false;
  window.open(data.signedUrl, '_blank');
  return true;
}

export default function Documentos() {
  const qc = useQueryClient();
  const { perfil } = useAuth();
  const { puedeEditar, esAdmin } = usePermisos();
  const fileRef = useRef<HTMLInputElement>(null);
  const [solapa, setSolapa] = useState<'entrada' | 'salida'>('entrada');
  const [tipo, setTipo] = useState(TIPOS_DOCUMENTALES[0]);
  const [empresaId, setEmpresaId] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEmp, setFiltroEmp] = useState('');
  const [error, setError] = useState('');
  const [modalEntrada, setModalEntrada] = useState(false);
  const [derivarMov, setDerivarMov] = useState<Movimiento | null>(null);

  const { data: esMesaEntrada = false } = useQuery({
    queryKey: ['es-mesa-entrada'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('es_mesa_entrada');
      if (error) throw error;
      return data as boolean;
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
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-min'],
    queryFn: async () => {
      const { data, error } = await supabase.from('usuarios').select('id, nombre').eq('activo', true).order('nombre');
      if (error) throw error;
      return data as UsuarioMin[];
    },
  });
  const { data: expedientes = [] } = useQuery({
    queryKey: ['expedientes-min'],
    queryFn: async () => {
      const { data, error } = await supabase.from('expedientes').select('id, numero, anio, sigla').order('anio', { ascending: false }).order('numero', { ascending: false });
      if (error) throw error;
      return data as ExpedienteMin[];
    },
  });
  const { data: derivaciones = [] } = useQuery({
    queryKey: ['derivaciones'],
    queryFn: async () => {
      const { data, error } = await supabase.from('derivaciones').select('*').order('fecha', { ascending: false }).limit(100);
      if (error) throw error;
      return data as Derivacion[];
    },
  });
  const { data: movimientos = [] } = useQuery({
    queryKey: ['movimientos-mesa'],
    queryFn: async () => {
      const { data, error } = await supabase.from('movimientos_mesa').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data as Movimiento[];
    },
  });
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documentos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('documentos').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Documento[];
    },
  });

  const empNom = (id: string | null) => empresas.find((e) => e.id === id)?.razon_social ?? '—';
  const usrNom = (id: string | null) => usuarios.find((u) => u.id === id)?.nombre ?? '—';
  const expNom = (id: string | null) => {
    const e = expedientes.find((x) => x.id === id);
    return e ? fmtExpStr(e.numero, e.anio, e.sigla) : '—';
  };

  const misPendientes = derivaciones.filter((d) => d.a_usuario === perfil?.id && d.estado === 'pendiente');
  const entradas = movimientos.filter((m) => m.sentido === 'entrada');
  // La mesa de entrada (rol archivo) o admin/director registran y derivan
  // — coincide con la RLS de movimientos_mesa y derivaciones.
  const puedeRegistrar = esMesaEntrada || esAdmin;

  const recibir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('derivaciones').update({ estado: 'recibida', recibida_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['derivaciones'] }),
  });

  const subir = useMutation({
    mutationFn: async (file: File) => {
      const path = `${empresaId || 'general'}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from('documentos').upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase.from('documentos').insert({
        tipo_documental: tipo, nombre: file.name, storage_path: path, mime: file.type,
        tamano: file.size, empresa_id: empresaId || null, subido_por: perfil?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documentos'] }); if (fileRef.current) fileRef.current.value = ''; },
    onError: () => setError('No se pudo subir el archivo.'),
  });

  const eliminar = useMutation({
    mutationFn: async (d: Documento) => {
      await supabase.storage.from('documentos').remove([d.storage_path]);
      const { error } = await supabase.from('documentos').delete().eq('id', d.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documentos'] }),
  });

  const eliminarEntrada = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('movimientos_mesa').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['movimientos-mesa'] }),
  });

  async function descargar(d: Documento) {
    if (!(await abrirArchivo(d.storage_path))) setError('No se pudo generar el enlace.');
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError('');
    const f = e.target.files?.[0];
    if (f) subir.mutate(f);
  }

  const visibles = docs.filter((d) =>
    (!filtroTipo || d.tipo_documental === filtroTipo) &&
    (!filtroEmp || d.empresa_id === filtroEmp));

  const tabCls = (activa: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-all ${
      activa ? 'bg-[var(--brand)] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div>
      <EncabezadoPagina
        titulo="Mesa de Entradas y Salidas"
        descripcion="Registro de ingresos y egresos de la oficina"
        accion={puedeRegistrar && solapa === 'entrada' && <Boton onClick={() => setModalEntrada(true)}>+ Registrar entrada</Boton>}
      />

      {/* Solapas Entrada / Salida */}
      <div className="inline-flex gap-1 bg-slate-100/70 p-1 rounded-xl mb-6">
        <button className={tabCls(solapa === 'entrada')} onClick={() => setSolapa('entrada')}>📥 Entrada</button>
        <button className={tabCls(solapa === 'salida')} onClick={() => setSolapa('salida')}>📤 Salida</button>
      </div>

      {/* Mis derivaciones pendientes (alerta al iniciar sesión) */}
      {misPendientes.length > 0 && (
        <div className="bg-white rounded-2xl card-elev border-l-4 border-[var(--brand)] p-4 mb-6">
          <h2 className="font-semibold text-slate-800 mb-3">📥 Tenés {misPendientes.length} documentación(es) pendiente(s) de recepción</h2>
          <div className="space-y-2">
            {misPendientes.map((d) => (
              <div key={d.id} className="flex items-center gap-3 text-sm bg-slate-50 rounded-lg px-3 py-2">
                <div className="flex-1">
                  <span className="font-medium text-slate-800">{d.descripcion}</span>
                  {d.tipo_documental && <span className="text-slate-500"> · {d.tipo_documental}</span>}
                  <div className="text-xs text-slate-500">
                    Derivó {usrNom(d.de_usuario)} · {new Date(d.fecha).toLocaleString('es-AR')}
                    {d.expediente_id && ` · Exp. ${expNom(d.expediente_id)}`}
                    {d.empresa_id && ` · ${empNom(d.empresa_id)}`}
                    {d.nota && ` · "${d.nota}"`}
                  </div>
                </div>
                <Boton variante="secundario" onClick={() => recibir.mutate(d.id)} disabled={recibir.isPending}>Marcar recibida</Boton>
              </div>
            ))}
          </div>
        </div>
      )}

      {solapa === 'salida' ? (
        <div className="bg-white rounded-2xl card-elev p-10 text-center text-slate-500">
          <div className="text-4xl mb-3">📤</div>
          <h2 className="font-semibold text-slate-700 mb-1">Salidas — en construcción</h2>
          <p className="text-sm">El registro de salidas se habilita en la próxima etapa.</p>
        </div>
      ) : (
        <>
          {/* ── Entradas registradas ── */}
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto mb-8">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="font-medium text-slate-700">Entradas registradas <span className="text-slate-400 font-normal">· {entradas.length}</span></h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Detalle</th>
                  <th className="px-4 py-3 font-medium">Empresa / Expediente</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entradas.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Sin entradas registradas.</td></tr>
                )}
                {entradas.map((m) => {
                  const derivada = derivaciones.find((d) => d.descripcion.includes(m.id));
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 align-top">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(m.created_at).toLocaleDateString('es-AR')}</td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 whitespace-nowrap">{m.tipo}</span></td>
                      <td className="px-4 py-3 text-slate-700">
                        {resumenEntrada(m)}
                        {m.datos?.storage_path && (
                          <button onClick={() => abrirArchivo(m.datos.storage_path)} className="ml-2 text-[var(--brand)] hover:underline text-xs">📎 Ver PDF</button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {m.expediente_id ? `Exp. ${expNom(m.expediente_id)}` : (m.empresa_id ? empNom(m.empresa_id) : (m.datos?.razon_social ?? '—'))}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {puedeRegistrar && (
                          <>
                            <button onClick={() => setDerivarMov(m)} className="text-[var(--brand)] hover:underline mr-3">Derivar</button>
                            <button onClick={() => { if (confirm('¿Eliminar esta entrada?')) eliminarEntrada.mutate(m.id); }} className="text-red-600 hover:underline">Eliminar</button>
                          </>
                        )}
                        {derivada && <div className="text-[11px] text-emerald-600 mt-1">→ {usrNom(derivada.a_usuario)}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Movimientos derivados (todos los ven) ── */}
          {derivaciones.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
              <h2 className="font-medium text-slate-700 mb-3">Documentación derivada</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Fecha</th>
                      <th className="px-3 py-2 font-medium">Documentación</th>
                      <th className="px-3 py-2 font-medium">Derivó</th>
                      <th className="px-3 py-2 font-medium">Para</th>
                      <th className="px-3 py-2 font-medium">Expediente / Empresa</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {derivaciones.slice(0, 15).map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{new Date(d.fecha).toLocaleDateString('es-AR')}</td>
                        <td className="px-3 py-2 text-slate-800">{d.descripcion}{d.tipo_documental && <span className="text-slate-400"> · {d.tipo_documental}</span>}</td>
                        <td className="px-3 py-2 text-slate-600">{usrNom(d.de_usuario)}</td>
                        <td className="px-3 py-2 text-slate-600">{usrNom(d.a_usuario)}</td>
                        <td className="px-3 py-2 text-slate-600">{d.expediente_id ? `Exp. ${expNom(d.expediente_id)}` : empNom(d.empresa_id)}</td>
                        <td className="px-3 py-2">
                          {d.estado === 'pendiente'
                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pendiente</span>
                            : <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Recibida</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {puedeEditar && (
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
              <h2 className="font-medium text-slate-700 mb-3">Subir archivo digital (general)</h2>
              <div className="grid md:grid-cols-3 gap-3">
                <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  {TIPOS_DOCUMENTALES.map((t) => <option key={t}>{t}</option>)}
                </select>
                <select className={inputCls} value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
                  <option value="">Sin empresa asociada</option>
                  {empresas.map((e) => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
                </select>
                <input ref={fileRef} type="file" onChange={onFile} disabled={subir.isPending}
                  className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--brand)] file:text-white file:px-4 file:py-2" />
              </div>
              {subir.isPending && <p className="text-sm text-slate-500 mt-2">Subiendo…</p>}
              {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-3 mb-4">
            <select className={`${inputCls} max-w-xs`} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              {TIPOS_DOCUMENTALES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <select className={`${inputCls} max-w-xs`} value={filtroEmp} onChange={(e) => setFiltroEmp(e.target.value)}>
              <option value="">Todas las empresas</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Tamaño</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Cargando…</td></tr>}
                {!isLoading && visibles.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Sin archivos digitales.</td></tr>
                )}
                {visibles.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{d.nombre}</td>
                    <td className="px-4 py-3 text-slate-600">{d.tipo_documental}</td>
                    <td className="px-4 py-3 text-slate-600">{empNom(d.empresa_id)}</td>
                    <td className="px-4 py-3 text-slate-600">{tamañoLegible(d.tamano)}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(d.created_at).toLocaleDateString('es-AR')}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => descargar(d)} className="text-[var(--brand)] hover:underline mr-3">Ver</button>
                      {puedeEditar && (
                        <button onClick={() => { if (confirm(`¿Eliminar "${d.nombre}"?`)) eliminar.mutate(d); }} className="text-red-600 hover:underline">Eliminar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal: registrar entrada (Mesa de Entradas) */}
      <ModalEntrada
        abierto={modalEntrada} onCerrar={() => setModalEntrada(false)}
        empresas={empresas} expedientes={expedientes} miId={perfil?.id ?? ''}
        onListo={() => {
          setModalEntrada(false);
          qc.invalidateQueries({ queryKey: ['movimientos-mesa'] });
          qc.invalidateQueries({ queryKey: ['expedientes-min'] });
          qc.invalidateQueries({ queryKey: ['expedientes'] });
          qc.invalidateQueries({ queryKey: ['documentos'] });
        }}
      />

      {/* Modal: derivar una entrada registrada a un agente */}
      <ModalDerivarEntrada
        mov={derivarMov} onCerrar={() => setDerivarMov(null)}
        usuarios={usuarios.filter((u) => u.id !== perfil?.id)} miId={perfil?.id ?? ''}
        resumen={derivarMov ? resumenEntrada(derivarMov) : ''}
        onListo={() => { setDerivarMov(null); qc.invalidateQueries({ queryKey: ['derivaciones'] }); }}
      />
    </div>
  );
}

/** Texto-resumen de una entrada según su tipo, para la tabla y la derivación. */
function resumenEntrada(m: Movimiento): string {
  const d = m.datos ?? {};
  switch (m.tipo) {
    case 'Nota':
      return [d.remitente && `Remitente: ${d.remitente}`, d.motivo && `Motivo: ${d.motivo}`].filter(Boolean).join(' · ') || 'Nota';
    case 'Plano':
      return `Plano de ${d.subtipo === 'obra' ? 'obra' : 'mensura'}`;
    case 'Expediente': {
      const motivo = d.motivo === 'recaratulacion' ? 'Recaratulación' : 'Formación de otro cuerpo';
      if (d.motivo === 'recaratulacion' && d.numero_anterior) {
        return `${motivo}: ${d.numero_anterior} → ${d.numero_nuevo}`;
      }
      return motivo;
    }
    case 'Notificación de Personal':
      return `${d.instrumento ?? ''} N° ${d.numero ?? ''}/${d.anio ?? ''}${d.sigla ? ` ${d.sigla}` : ''}`.trim();
    case 'Correspondencia': {
      const base = `Para ${d.destinatario ?? '—'}`;
      if (d.recibido) return `${base} · Recibido por ${d.receptor ?? '—'}${d.fecha_recepcion ? ` (${d.fecha_recepcion})` : ''}`;
      return `${base} · No recibido`;
    }
    case 'Proyecto Industrial':
      return d.razon_social ? `Proyecto de ${d.razon_social}` : 'Proyecto industrial';
    default:
      return m.observaciones ?? '—';
  }
}

// ════════════════════════════════════════════════════════════════
//  Modal: Registrar ENTRADA — formulario que cambia según el tipo
// ════════════════════════════════════════════════════════════════
function ModalEntrada({
  abierto, onCerrar, empresas, expedientes, miId, onListo,
}: {
  abierto: boolean; onCerrar: () => void;
  empresas: Empresa[]; expedientes: ExpedienteMin[]; miId: string; onListo: () => void;
}) {
  const [tipo, setTipo] = useState<typeof TIPOS_ENTRADA[number]>('Nota');
  const [observaciones, setObservaciones] = useState('');
  const archivoRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);

  // Nota
  const [remitente, setRemitente] = useState('');
  const [motivoNota, setMotivoNota] = useState('');
  // Plano
  const [subtipoPlano, setSubtipoPlano] = useState<'obra' | 'mensura'>('obra');
  // Expediente
  const [expBusqueda, setExpBusqueda] = useState('');
  const [expId, setExpId] = useState('');
  const [expEmpresaId, setExpEmpresaId] = useState('');
  const [motivoExp, setMotivoExp] = useState<'recaratulacion' | 'nuevo_cuerpo'>('recaratulacion');
  const [nuevoNumero, setNuevoNumero] = useState('');
  const [nuevoAnio, setNuevoAnio] = useState('');
  const [nuevaSigla, setNuevaSigla] = useState('');
  // Notificación de Personal
  const [instrumento, setInstrumento] = useState(TIPOS_INSTRUMENTO[0]);
  const [instrNumero, setInstrNumero] = useState('');
  const [instrAnio, setInstrAnio] = useState('');
  const [instrSigla, setInstrSigla] = useState('');
  // Correspondencia
  const [destinatario, setDestinatario] = useState('');
  const [fechaEmision, setFechaEmision] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [recibido, setRecibido] = useState(false);
  const [receptor, setReceptor] = useState('');
  const [fechaRecepcion, setFechaRecepcion] = useState('');
  // Proyecto Industrial
  const [proyEmpresaId, setProyEmpresaId] = useState('');
  const [proyRazon, setProyRazon] = useState('');

  const expFiltrados = useMemo(() => {
    const q = expBusqueda.trim().toLowerCase();
    if (!q) return expedientes.slice(0, 50);
    return expedientes.filter((e) => fmtExpStr(e.numero, e.anio, e.sigla).toLowerCase().includes(q)).slice(0, 50);
  }, [expBusqueda, expedientes]);
  const expSel = expedientes.find((e) => e.id === expId) ?? null;
  const permitePdf = TIPOS_CON_PDF.includes(tipo);

  function reset() {
    setTipo('Nota'); setObservaciones(''); setArchivo(null);
    if (archivoRef.current) archivoRef.current.value = '';
    setRemitente(''); setMotivoNota('');
    setSubtipoPlano('obra');
    setExpBusqueda(''); setExpId(''); setExpEmpresaId(''); setMotivoExp('recaratulacion');
    setNuevoNumero(''); setNuevoAnio(''); setNuevaSigla('');
    setInstrumento(TIPOS_INSTRUMENTO[0]); setInstrNumero(''); setInstrAnio(''); setInstrSigla('');
    setDestinatario(''); setFechaEmision(''); setDomicilio(''); setRecibido(false); setReceptor(''); setFechaRecepcion('');
    setProyEmpresaId(''); setProyRazon('');
  }

  const crear = useMutation({
    mutationFn: async () => {
      let datos: Record<string, any> = {};
      let empresa_id: string | null = null;
      let expediente_id: string | null = null;

      switch (tipo) {
        case 'Nota':
          datos = { remitente: remitente.trim(), motivo: motivoNota.trim() };
          break;
        case 'Plano':
          datos = { subtipo: subtipoPlano };
          break;
        case 'Expediente': {
          if (!expSel) throw new Error('Seleccioná el expediente que ingresa.');
          expediente_id = expSel.id;
          empresa_id = expEmpresaId || null;
          datos = { motivo: motivoExp, numero_anterior: fmtExpStr(expSel.numero, expSel.anio, expSel.sigla) };
          if (motivoExp === 'recaratulacion') {
            const nNum = parseInt(nuevoNumero, 10);
            const nAnio = parseInt(nuevoAnio, 10);
            if (!nNum || !nAnio) throw new Error('Ingresá número y año del expediente recaratulado.');
            const { error: rpcErr } = await supabase.rpc('recaratular_expediente', {
              p_exp_id: expSel.id, p_numero: nNum, p_anio: nAnio, p_sigla: nuevaSigla.trim() || null,
            });
            if (rpcErr) throw rpcErr;
            datos.numero_nuevo = fmtExpStr(nNum, nAnio, nuevaSigla.trim() || null);
          }
          break;
        }
        case 'Notificación de Personal':
          datos = { instrumento, numero: instrNumero.trim(), anio: instrAnio.trim(), sigla: instrSigla.trim() || null };
          break;
        case 'Correspondencia':
          datos = {
            destinatario: destinatario.trim(), fecha_emision: fechaEmision || null, domicilio: domicilio.trim(),
            recibido,
            receptor: recibido ? receptor.trim() : null,
            fecha_recepcion: recibido ? (fechaRecepcion || null) : null,
          };
          break;
        case 'Proyecto Industrial':
          empresa_id = proyEmpresaId || null;
          datos = { razon_social: proyEmpresaId ? (empresas.find((e) => e.id === proyEmpresaId)?.razon_social ?? '') : proyRazon.trim() };
          break;
      }

      // Adjuntar PDF (solo Nota, Proyecto Industrial y Notificación de Personal).
      if (permitePdf && archivo) {
        const path = `mesa/${Date.now()}-${archivo.name}`;
        const up = await supabase.storage.from('documentos').upload(path, archivo);
        if (up.error) throw up.error;
        const docTipo = tipo === 'Nota' ? 'Nota'
          : tipo === 'Proyecto Industrial' ? 'Proyecto industrial'
          : (TIPOS_DOCUMENTALES.includes(instrumento) ? instrumento : 'Otro');
        const { data: docRow, error: docErr } = await supabase.from('documentos').insert({
          tipo_documental: docTipo, nombre: archivo.name, storage_path: path, mime: archivo.type,
          tamano: archivo.size, empresa_id, subido_por: miId,
        }).select('id').single();
        if (docErr) throw docErr;
        datos.documento_id = docRow?.id ?? null;
        datos.storage_path = path;
        datos.archivo_nombre = archivo.name;
      }

      const { error } = await supabase.from('movimientos_mesa').insert({
        sentido: 'entrada', tipo, empresa_id, expediente_id, datos,
        observaciones: observaciones.trim() || null, created_by: miId,
      });
      if (error) throw error;
    },
    onSuccess: () => { reset(); onListo(); },
  });

  const valido = (() => {
    switch (tipo) {
      case 'Nota': return remitente.trim() !== '';
      case 'Plano': return true;
      case 'Expediente':
        if (!expId) return false;
        if (motivoExp === 'recaratulacion') return nuevoNumero.trim() !== '' && nuevoAnio.trim() !== '';
        return true;
      case 'Notificación de Personal': return instrNumero.trim() !== '' && instrAnio.trim() !== '';
      case 'Correspondencia':
        if (destinatario.trim() === '') return false;
        if (recibido) return receptor.trim() !== '';
        return true;
      case 'Proyecto Industrial': return proyEmpresaId !== '' || proyRazon.trim() !== '';
      default: return false;
    }
  })();

  return (
    <Modal titulo="Registrar entrada" abierto={abierto} onCerrar={onCerrar}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (valido) crear.mutate(); }} className="space-y-4">
        <Campo label="Tipo de entrada">
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
            {TIPOS_ENTRADA.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Campo>

        {/* ── NOTA ── */}
        {tipo === 'Nota' && (
          <>
            <Campo label="Remitente">
              <input className={inputCls} value={remitente} onChange={(e) => setRemitente(e.target.value)} placeholder="Quién envía la nota" />
            </Campo>
            <Campo label="Motivo">
              <textarea className={inputCls} rows={2} value={motivoNota} onChange={(e) => setMotivoNota(e.target.value)} placeholder="Motivo de la nota" />
            </Campo>
          </>
        )}

        {/* ── PLANO ── */}
        {tipo === 'Plano' && (
          <Campo label="Tipo de plano">
            <div className="flex gap-2">
              {(['obra', 'mensura'] as const).map((s) => (
                <button key={s} type="button" onClick={() => setSubtipoPlano(s)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-all ${subtipoPlano === s ? 'bg-[var(--brand)] text-white border-transparent' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
                  Plano de {s}
                </button>
              ))}
            </div>
          </Campo>
        )}

        {/* ── EXPEDIENTE ── */}
        {tipo === 'Expediente' && (
          <>
            <Campo label="Buscar expediente (por número/año/sigla)">
              <input className={inputCls} value={expBusqueda} onChange={(e) => setExpBusqueda(e.target.value)} placeholder="Ej: 123/2026 MP" />
            </Campo>
            <Campo label="Expediente que ingresa">
              <select className={inputCls} value={expId} onChange={(e) => setExpId(e.target.value)}>
                <option value="">Elegí un expediente…</option>
                {expFiltrados.map((e) => <option key={e.id} value={e.id}>{fmtExpStr(e.numero, e.anio, e.sigla)}</option>)}
              </select>
            </Campo>
            <Campo label="Empresa asociada (opcional)">
              <select className={inputCls} value={expEmpresaId} onChange={(e) => setExpEmpresaId(e.target.value)}>
                <option value="">Sin asociar</option>
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
              </select>
            </Campo>
            <Campo label="Motivo del reingreso">
              <div className="space-y-2">
                {MOTIVOS_INGRESO_EXP.map((m) => (
                  <label key={m.valor} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="radio" name="motivoExp" checked={motivoExp === m.valor} onChange={() => setMotivoExp(m.valor)} />
                    {m.label}
                  </label>
                ))}
              </div>
            </Campo>
            {motivoExp === 'recaratulacion' && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-3">
                <p className="text-xs text-amber-800">
                  Se actualizará el expediente {expSel ? <b>{fmtExpStr(expSel.numero, expSel.anio, expSel.sigla)}</b> : 'seleccionado'} con la nueva carátula en la base de datos.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Campo label="Nuevo número">
                    <input className={inputCls} inputMode="numeric" value={nuevoNumero} onChange={(e) => setNuevoNumero(e.target.value)} placeholder="123" />
                  </Campo>
                  <Campo label="Nuevo año">
                    <input className={inputCls} inputMode="numeric" value={nuevoAnio} onChange={(e) => setNuevoAnio(e.target.value)} placeholder="2026" />
                  </Campo>
                  <Campo label="Nueva sigla">
                    <input className={inputCls} value={nuevaSigla} onChange={(e) => setNuevaSigla(e.target.value)} placeholder="MP" />
                  </Campo>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── NOTIFICACIÓN DE PERSONAL ── */}
        {tipo === 'Notificación de Personal' && (
          <>
            <Campo label="Tipo de instrumento">
              <select className={inputCls} value={instrumento} onChange={(e) => setInstrumento(e.target.value)}>
                {TIPOS_INSTRUMENTO.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Campo>
            <div className="grid grid-cols-3 gap-2">
              <Campo label="Número">
                <input className={inputCls} inputMode="numeric" value={instrNumero} onChange={(e) => setInstrNumero(e.target.value)} placeholder="N°" />
              </Campo>
              <Campo label="Año">
                <input className={inputCls} inputMode="numeric" value={instrAnio} onChange={(e) => setInstrAnio(e.target.value)} placeholder="2026" />
              </Campo>
              <Campo label="Sigla (opcional)">
                <input className={inputCls} value={instrSigla} onChange={(e) => setInstrSigla(e.target.value)} placeholder="MP" />
              </Campo>
            </div>
          </>
        )}

        {/* ── CORRESPONDENCIA ── */}
        {tipo === 'Correspondencia' && (
          <>
            <Campo label="Destinatario del sobre">
              <input className={inputCls} value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder="A quién se envió" />
            </Campo>
            <div className="grid grid-cols-2 gap-2">
              <Campo label="Fecha de emisión">
                <input type="date" className={inputCls} value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} />
              </Campo>
              <Campo label="Domicilio">
                <input className={inputCls} value={domicilio} onChange={(e) => setDomicilio(e.target.value)} placeholder="Domicilio de envío" />
              </Campo>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={recibido} onChange={(e) => setRecibido(e.target.checked)} />
              ¿Se recibió el sobre?
            </label>
            {recibido && (
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                <Campo label="Nombre y apellido (receptor)">
                  <input className={inputCls} value={receptor} onChange={(e) => setReceptor(e.target.value)} placeholder="Quién lo recibió" />
                </Campo>
                <Campo label="Fecha de recepción">
                  <input type="date" className={inputCls} value={fechaRecepcion} onChange={(e) => setFechaRecepcion(e.target.value)} />
                </Campo>
              </div>
            )}
          </>
        )}

        {/* ── PROYECTO INDUSTRIAL ── */}
        {tipo === 'Proyecto Industrial' && (
          <>
            <Campo label="Empresa / Razón social (registrada)">
              <select className={inputCls} value={proyEmpresaId} onChange={(e) => { setProyEmpresaId(e.target.value); if (e.target.value) setProyRazon(''); }}>
                <option value="">No registrada — la cargo abajo</option>
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
              </select>
            </Campo>
            {!proyEmpresaId && (
              <Campo label="Razón social del proyecto">
                <input className={inputCls} value={proyRazon} onChange={(e) => setProyRazon(e.target.value)} placeholder="Empresa o razón social" />
              </Campo>
            )}
          </>
        )}

        {/* ── Adjuntar PDF (Nota, Proyecto Industrial, Notificación de Personal) ── */}
        {permitePdf && (
          <Campo label="Archivo digital PDF (opcional)">
            <input ref={archivoRef} type="file" accept="application/pdf"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--brand)] file:text-white file:px-4 file:py-2" />
          </Campo>
        )}

        <Campo label="Observaciones (opcional)">
          <textarea className={inputCls} rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </Campo>

        {crear.isError && <p className="text-sm text-red-600">{(crear.error as Error)?.message ?? 'No se pudo registrar la entrada.'}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Boton type="button" variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" disabled={crear.isPending || !valido}>{crear.isPending ? 'Registrando…' : 'Registrar entrada'}</Boton>
        </div>
      </form>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════
//  Modal: Derivar una entrada registrada a un agente
// ════════════════════════════════════════════════════════════════
function ModalDerivarEntrada({
  mov, onCerrar, usuarios, miId, resumen, onListo,
}: {
  mov: Movimiento | null; onCerrar: () => void;
  usuarios: UsuarioMin[]; miId: string; resumen: string; onListo: () => void;
}) {
  const [aUsuario, setAUsuario] = useState('');
  const [nota, setNota] = useState('');

  const crear = useMutation({
    mutationFn: async () => {
      if (!mov) return;
      // La descripción incluye el id de la entrada para enlazarla con la derivación.
      const { error } = await supabase.from('derivaciones').insert({
        tipo_documental: mov.tipo,
        descripcion: `${resumen} [${mov.id}]`,
        a_usuario: aUsuario, de_usuario: miId,
        empresa_id: mov.empresa_id, expediente_id: mov.expediente_id,
        documento_id: mov.datos?.documento_id ?? null,
        nota: nota.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setAUsuario(''); setNota(''); onListo(); },
  });

  return (
    <Modal titulo="Derivar entrada" abierto={!!mov} onCerrar={onCerrar}>
      {mov && (
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (aUsuario) crear.mutate(); }} className="space-y-4">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm">
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 mr-2">{mov.tipo}</span>
            <span className="text-slate-700">{resumen}</span>
          </div>
          <Campo label="Derivar a">
            <select className={inputCls} required value={aUsuario} onChange={(e) => setAUsuario(e.target.value)}>
              <option value="">Elegí un agente…</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Nota (opcional)">
            <textarea className={inputCls} rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Indicación para el agente" />
          </Campo>
          {crear.isError && <p className="text-sm text-red-600">No se pudo derivar la entrada.</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Boton type="button" variante="secundario" onClick={onCerrar}>Cancelar</Boton>
            <Boton type="submit" disabled={crear.isPending || !aUsuario}>{crear.isPending ? 'Derivando…' : 'Derivar'}</Boton>
          </div>
        </form>
      )}
    </Modal>
  );
}
