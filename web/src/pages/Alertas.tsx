import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Boton, EncabezadoPagina } from '../components/ui';

interface Alerta {
  id: string;
  tipo: string;
  severidad: string;
  mensaje: string;
  expediente_id: string | null;
  leida: boolean;
  fecha: string;
}

const SEV: Record<string, { label: string; color: string; bg: string }> = {
  alta:  { label: 'Alta',  color: '#dc2626', bg: '#fef2f2' },
  media: { label: 'Media', color: '#d97706', bg: '#fffbeb' },
  baja:  { label: 'Baja',  color: '#2563eb', bg: '#eff6ff' },
};

export default function Alertas() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ['alertas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('alertas').select('*')
        .order('leida').order('severidad').order('fecha', { ascending: false });
      if (error) throw error;
      return data as Alerta[];
    },
  });

  const recalcular = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc('fn_generar_alertas'); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertas'] }),
  });
  const marcar = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('alertas').update({ leida: true }).eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertas'] }),
  });

  const pendientes = alertas.filter((a) => !a.leida);

  return (
    <div>
      <EncabezadoPagina
        titulo="Alertas inteligentes"
        descripcion={`${pendientes.length} sin atender`}
        accion={<Boton variante="secundario" onClick={() => recalcular.mutate()} disabled={recalcular.isPending}>
          {recalcular.isPending ? 'Recalculando…' : '↻ Recalcular'}
        </Boton>}
      />

      {isLoading && <p className="text-slate-400">Cargando…</p>}
      {!isLoading && alertas.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-slate-400">
          Sin alertas. Tocá "Recalcular" para escanear el estado actual.
        </div>
      )}

      <div className="space-y-2">
        {alertas.map((a) => {
          const s = SEV[a.severidad] ?? SEV.baja;
          return (
            <div key={a.id} className={`rounded-xl border-l-4 shadow-sm p-4 flex items-start justify-between gap-4 ${a.leida ? 'bg-slate-50 opacity-60' : 'bg-white'}`}
              style={{ borderColor: s.color }}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>{s.label}</span>
                  <span className="text-xs text-slate-400">{new Date(a.fecha).toLocaleDateString('es-AR')}</span>
                </div>
                <p className="text-sm text-slate-700">{a.mensaje}</p>
                {a.expediente_id && (
                  <button onClick={() => navigate(`/expedientes/${a.expediente_id}`)} className="text-xs text-[var(--brand)] hover:underline mt-1">Ver expediente →</button>
                )}
              </div>
              {!a.leida && (
                <button onClick={() => marcar.mutate(a.id)} className="text-xs text-slate-500 hover:text-slate-800 whitespace-nowrap">Marcar leída</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
