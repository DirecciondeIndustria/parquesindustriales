import { useState, useRef, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { usePermisos } from '../lib/permisos';
import { Boton, Modal, Campo, inputCls, EncabezadoPagina } from '../components/ui';
import { TIPOS_DOCUMENTALES } from '../lib/constantes';

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

function tamañoLegible(b: number | null) {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export default function Documentos() {
  const qc = useQueryClient();
  const { perfil } = useAuth();
  const { puedeEditar } = usePermisos();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState(TIPOS_DOCUMENTALES[0]);
  const [empresaId, setEmpresaId] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEmp, setFiltroEmp] = useState('');
  const [error, setError] = useState('');
  const [modalDeriv, setModalDeriv] = useState(false);

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
    return e ? `${e.numero}/${e.anio}${e.sigla ? ' ' + e.sigla : ''}` : '—';
  };

  const misPendientes = derivaciones.filter((d) => d.a_usuario === perfil?.id && d.estado === 'pendiente');

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

  async function descargar(d: Documento) {
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(d.storage_path, 60);
    if (error || !data) { setError('No se pudo generar el enlace.'); return; }
    window.open(data.signedUrl, '_blank');
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError('');
    const f = e.target.files?.[0];
    if (f) subir.mutate(f);
  }

  const visibles = docs.filter((d) =>
    (!filtroTipo || d.tipo_documental === filtroTipo) &&
    (!filtroEmp || d.empresa_id === filtroEmp));

  return (
    <div>
      <EncabezadoPagina
        titulo="Gestión documental"
        descripcion={`${docs.length} archivos`}
        accion={esMesaEntrada && <Boton onClick={() => setModalDeriv(true)}>+ Registrar y derivar</Boton>}
      />

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

      {/* Movimientos de mesa de entrada (todos los ven) */}
      {derivaciones.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <h2 className="font-medium text-slate-700 mb-3">Documentación derivada (mesa de entrada)</h2>
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
          <h2 className="font-medium text-slate-700 mb-3">Subir documento</h2>
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
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Sin documentos.</td></tr>
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

      {/* Modal: registrar ingreso y derivar */}
      <ModalDerivar
        abierto={modalDeriv} onCerrar={() => setModalDeriv(false)}
        empresas={empresas} usuarios={usuarios.filter((u) => u.id !== perfil?.id)} expedientes={expedientes}
        miId={perfil?.id ?? ''} onListo={() => { setModalDeriv(false); qc.invalidateQueries({ queryKey: ['derivaciones'] }); }}
      />
    </div>
  );
}

function ModalDerivar({
  abierto, onCerrar, empresas, usuarios, expedientes, miId, onListo,
}: {
  abierto: boolean; onCerrar: () => void;
  empresas: Empresa[]; usuarios: UsuarioMin[]; expedientes: ExpedienteMin[]; miId: string; onListo: () => void;
}) {
  const [form, setForm] = useState({ tipo_documental: TIPOS_DOCUMENTALES[0], descripcion: '', a_usuario: '', empresa_id: '', expediente_id: '', nota: '' });

  const crear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('derivaciones').insert({
        tipo_documental: form.tipo_documental, descripcion: form.descripcion, a_usuario: form.a_usuario,
        de_usuario: miId, empresa_id: form.empresa_id || null, expediente_id: form.expediente_id || null,
        nota: form.nota || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setForm({ tipo_documental: TIPOS_DOCUMENTALES[0], descripcion: '', a_usuario: '', empresa_id: '', expediente_id: '', nota: '' }); onListo(); },
  });

  return (
    <Modal titulo="Registrar y derivar documentación" abierto={abierto} onCerrar={onCerrar}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (form.descripcion.trim() && form.a_usuario) crear.mutate(); }} className="space-y-4">
        <Campo label="Descripción de la documentación">
          <input className={inputCls} required placeholder="Ej: Planos de obra, Nota de pronto despacho…" value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Tipo documental">
            <select className={inputCls} value={form.tipo_documental} onChange={(e) => setForm({ ...form, tipo_documental: e.target.value })}>
              {TIPOS_DOCUMENTALES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Campo>
          <Campo label="Derivar a">
            <select className={inputCls} required value={form.a_usuario} onChange={(e) => setForm({ ...form, a_usuario: e.target.value })}>
              <option value="">Elegí un agente…</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Empresa (opcional)">
            <select className={inputCls} value={form.empresa_id} onChange={(e) => setForm({ ...form, empresa_id: e.target.value })}>
              <option value="">Sin asociar</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
            </select>
          </Campo>
          <Campo label="Expediente (opcional)">
            <select className={inputCls} value={form.expediente_id} onChange={(e) => setForm({ ...form, expediente_id: e.target.value })}>
              <option value="">Sin asociar</option>
              {expedientes.map((x) => <option key={x.id} value={x.id}>{x.numero}/{x.anio}{x.sigla ? ' ' + x.sigla : ''}</option>)}
            </select>
          </Campo>
        </div>
        <Campo label="Nota (opcional)">
          <textarea className={inputCls} rows={2} value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} />
        </Campo>
        {crear.isError && <p className="text-sm text-red-600">No se pudo registrar la derivación.</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Boton type="button" variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" disabled={crear.isPending || !form.descripcion.trim() || !form.a_usuario}>{crear.isPending ? 'Registrando…' : 'Registrar y derivar'}</Boton>
        </div>
      </form>
    </Modal>
  );
}
