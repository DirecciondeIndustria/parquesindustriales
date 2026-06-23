import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { usePermisos } from '../lib/permisos';
import { inputCls, EncabezadoPagina } from '../components/ui';
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

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-min'],
    queryFn: async () => {
      const { data, error } = await supabase.from('empresas').select('id, razon_social').order('razon_social');
      if (error) throw error;
      return data as Empresa[];
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

  const subir = useMutation({
    mutationFn: async (file: File) => {
      const path = `${empresaId || 'general'}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from('documentos').upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase.from('documentos').insert({
        tipo_documental: tipo,
        nombre: file.name,
        storage_path: path,
        mime: file.type,
        tamano: file.size,
        empresa_id: empresaId || null,
        subido_por: perfil?.id ?? null,
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
      <EncabezadoPagina titulo="Gestión documental" descripcion={`${docs.length} archivos`} />

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
    </div>
  );
}
