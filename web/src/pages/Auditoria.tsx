import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { usePermisos } from '../lib/permisos';
import { EncabezadoPagina } from '../components/ui';

interface Registro {
  id: number;
  usuario_email: string | null;
  accion: string;
  tabla: string;
  registro_id: string | null;
  fecha: string;
}

const ACCION: Record<string, { label: string; color: string }> = {
  INSERT: { label: 'Alta', color: '#16a34a' },
  UPDATE: { label: 'Modificación', color: '#2563eb' },
  DELETE: { label: 'Baja', color: '#dc2626' },
};

export default function Auditoria() {
  const { esAdmin } = usePermisos();

  const { data: registros = [], isLoading } = useQuery({
    enabled: esAdmin,
    queryKey: ['auditoria'],
    queryFn: async () => {
      const { data, error } = await supabase.from('auditoria').select('*').order('fecha', { ascending: false }).limit(300);
      if (error) throw error;
      return data as Registro[];
    },
  });

  if (!esAdmin) {
    return (
      <div>
        <EncabezadoPagina titulo="Auditoría" />
        <p className="text-amber-600">Solo Administración y Dirección pueden ver la auditoría.</p>
      </div>
    );
  }

  return (
    <div>
      <EncabezadoPagina titulo="Auditoría y trazabilidad" descripcion="Últimas 300 acciones registradas" />

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha y hora</th>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Acción</th>
              <th className="px-4 py-3 font-medium">Tabla</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Cargando…</td></tr>}
            {!isLoading && registros.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Sin registros.</td></tr>}
            {registros.map((r) => {
              const a = ACCION[r.accion] ?? { label: r.accion, color: '#64748b' };
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{new Date(r.fecha).toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3 text-slate-700">{r.usuario_email ?? '—'}</td>
                  <td className="px-4 py-3"><span className="font-medium" style={{ color: a.color }}>{a.label}</span></td>
                  <td className="px-4 py-3 text-slate-600">{r.tabla}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
