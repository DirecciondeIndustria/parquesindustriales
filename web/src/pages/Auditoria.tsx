import { useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { usePermisos } from '../lib/permisos';
import { inputCls, EncabezadoPagina } from '../components/ui';

interface Registro {
  id: number;
  usuario_email: string | null;
  accion: string;
  tabla: string;
  registro_id: string | null;
  datos_antes: Record<string, unknown> | null;
  datos_despues: Record<string, unknown> | null;
  fecha: string;
}

const ACCION: Record<string, { label: string; color: string }> = {
  INSERT: { label: 'Alta', color: '#16a34a' },
  UPDATE: { label: 'Modificación', color: '#2563eb' },
  DELETE: { label: 'Baja', color: '#dc2626' },
};

const TABLA: Record<string, string> = {
  expedientes: 'Expediente', empresas: 'Empresa', parcelas: 'Parcela',
  parques_industriales: 'Parque', expediente_etapas: 'Hito de expediente',
  expediente_subtramites: 'Requisito de expediente', etapas_definicion: 'Hito de plantilla',
  subtramites_definicion: 'Requisito de plantilla', documentos: 'Documento',
  inspecciones: 'Inspección', archivo_fisico: 'Archivo físico', usuarios: 'Usuario',
  siglas_ministerio: 'Sigla del Ministerio', delegaciones_mesa: 'Delegación mesa de entrada',
};

const OCULTAR = new Set(['id', 'created_at', 'updated_at']);

/** Campos que cambiaron entre antes y después. */
function cambios(antes: Record<string, unknown> | null, despues: Record<string, unknown> | null) {
  const out: { campo: string; antes: unknown; despues: unknown }[] = [];
  const keys = new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})]);
  for (const k of keys) {
    if (OCULTAR.has(k)) continue;
    const a = antes?.[k]; const d = despues?.[k];
    if (JSON.stringify(a) !== JSON.stringify(d)) out.push({ campo: k, antes: a, despues: d });
  }
  return out;
}
const val = (v: unknown) => v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);

export default function Auditoria() {
  const { esAdmin } = usePermisos();
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [abierto, setAbierto] = useState<number | null>(null);

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ['auditoria'],
    queryFn: async () => {
      const { data, error } = await supabase.from('auditoria').select('*').order('fecha', { ascending: false }).limit(300);
      if (error) throw error;
      return data as Registro[];
    },
  });

  // Lista de usuarios (emails) para el filtro — solo admin.
  const emails = Array.from(new Set(registros.map((r) => r.usuario_email).filter(Boolean))) as string[];
  const visibles = filtroUsuario ? registros.filter((r) => r.usuario_email === filtroUsuario) : registros;

  return (
    <div>
      <EncabezadoPagina titulo="Auditoría y trazabilidad" descripcion="Últimas 300 acciones · no se pueden modificar ni borrar" />

      {esAdmin && (
        <div className="flex flex-wrap gap-3 mb-4">
          <select className={`${inputCls} max-w-xs`} value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)}>
            <option value="">Todos los usuarios</option>
            {emails.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha y hora</th>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Acción</th>
              <th className="px-4 py-3 font-medium">Registro</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Cargando…</td></tr>}
            {!isLoading && visibles.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Sin registros.</td></tr>}
            {visibles.map((r) => {
              const a = ACCION[r.accion] ?? { label: r.accion, color: '#64748b' };
              const cambs = r.accion === 'UPDATE' ? cambios(r.datos_antes, r.datos_despues) : [];
              const abrible = r.accion === 'UPDATE' ? cambs.length > 0 : !!(r.datos_antes || r.datos_despues);
              const open = abierto === r.id;
              return (
                <Fragment key={r.id}>
                  <tr className={`hover:bg-slate-50 ${abrible ? 'cursor-pointer' : ''}`} onClick={() => abrible && setAbierto(open ? null : r.id)}>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{new Date(r.fecha).toLocaleString('es-AR')}</td>
                    <td className="px-4 py-3 text-slate-700">{r.usuario_email ?? '—'}</td>
                    <td className="px-4 py-3"><span className="font-medium" style={{ color: a.color }}>{a.label}</span></td>
                    <td className="px-4 py-3 text-slate-600">{TABLA[r.tabla] ?? r.tabla}</td>
                    <td className="px-4 py-3 text-slate-400 text-right">{abrible ? (open ? '▲' : '▼ ver') : ''}</td>
                  </tr>
                  {open && abrible && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={5} className="px-4 py-3">
                        {r.accion === 'UPDATE' ? (
                          <table className="text-xs w-full max-w-2xl">
                            <thead className="text-slate-400 text-left"><tr><th className="py-1 pr-4">Campo</th><th className="py-1 pr-4">Antes</th><th className="py-1">Después</th></tr></thead>
                            <tbody>
                              {cambs.map((c) => (
                                <tr key={c.campo}>
                                  <td className="py-1 pr-4 font-medium text-slate-600">{c.campo}</td>
                                  <td className="py-1 pr-4 text-red-600">{val(c.antes)}</td>
                                  <td className="py-1 text-emerald-700">{val(c.despues)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <pre className="text-xs text-slate-600 whitespace-pre-wrap max-w-2xl">
                            {JSON.stringify(r.accion === 'DELETE' ? r.datos_antes : r.datos_despues, null, 2)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
