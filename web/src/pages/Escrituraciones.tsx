import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { usePermisos } from '../lib/permisos';
import { inputCls, EncabezadoPagina } from '../components/ui';

interface Parcela {
  id: string;
  identificacion: string;
  escriturada: boolean;
  hipoteca_vigente: boolean;
  escritura_fecha: string | null;
  dominio: string | null;
}

export default function Escrituraciones() {
  const qc = useQueryClient();
  const { puedeEditar } = usePermisos();

  const { data: parcelas = [], isLoading } = useQuery({
    queryKey: ['parcelas-escri'],
    queryFn: async () => {
      const { data, error } = await supabase.from('parcelas')
        .select('id, identificacion, escriturada, hipoteca_vigente, escritura_fecha, dominio').order('identificacion');
      if (error) throw error; return data as Parcela[];
    },
  });

  const actualizar = useMutation({
    mutationFn: async (p: { id: string } & Partial<Parcela>) => {
      const { id, ...campos } = p;
      const { error } = await supabase.from('parcelas').update(campos).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parcelas-escri'] }),
  });

  const total = parcelas.length;
  const escrituradas = parcelas.filter((p) => p.escriturada).length;
  const pct = total ? Math.round((escrituradas / total) * 100) : 0;
  const conHipoteca = parcelas.filter((p) => p.hipoteca_vigente).length;

  return (
    <div>
      <EncabezadoPagina titulo="Control de escrituraciones" descripcion="Seguimiento dominial de las parcelas" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Tarjeta label="Parcelas totales" valor={total} />
        <Tarjeta label="Escrituradas" valor={escrituradas} />
        <Tarjeta label="% Escrituradas" valor={`${pct}%`} destacado />
        <Tarjeta label="Con hipoteca" valor={conHipoteca} />
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-slate-500">Avance de escrituración</span>
          <span className="font-medium text-[var(--brand)]">{pct}%</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-[var(--brand)] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Parcela</th>
              <th className="px-4 py-3 font-medium">Escriturada</th>
              <th className="px-4 py-3 font-medium">Fecha escritura</th>
              <th className="px-4 py-3 font-medium">Dominio</th>
              <th className="px-4 py-3 font-medium">Hipoteca</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Cargando…</td></tr>}
            {!isLoading && parcelas.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Sin parcelas.</td></tr>}
            {parcelas.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{p.identificacion}</td>
                <td className="px-4 py-3">
                  <input type="checkbox" checked={p.escriturada} disabled={!puedeEditar} className="accent-[var(--brand)]"
                    onChange={(e) => actualizar.mutate({ id: p.id, escriturada: e.target.checked })} />
                </td>
                <td className="px-4 py-3">
                  <input type="date" className={`${inputCls} max-w-[150px]`} defaultValue={p.escritura_fecha ?? ''} disabled={!puedeEditar}
                    onBlur={(e) => actualizar.mutate({ id: p.id, escritura_fecha: e.target.value || null })} />
                </td>
                <td className="px-4 py-3">
                  <input className={`${inputCls} max-w-[180px]`} defaultValue={p.dominio ?? ''} placeholder="Tomo/Folio…" disabled={!puedeEditar}
                    onBlur={(e) => e.target.value !== (p.dominio ?? '') && actualizar.mutate({ id: p.id, dominio: e.target.value || null })} />
                </td>
                <td className="px-4 py-3">
                  <input type="checkbox" checked={p.hipoteca_vigente} disabled={!puedeEditar} className="accent-[var(--brand)]"
                    onChange={(e) => actualizar.mutate({ id: p.id, hipoteca_vigente: e.target.checked })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tarjeta({ label, valor, destacado }: { label: string; valor: number | string; destacado?: boolean }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className={`text-3xl font-bold ${destacado ? 'text-green-600' : 'text-[var(--brand)]'}`}>{valor}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
    </div>
  );
}
