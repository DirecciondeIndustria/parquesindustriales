import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { EncabezadoPagina } from '../components/ui';
import { semaforo, SEMAFORO_COLOR, ESTADO_LABEL, type Expediente } from '../lib/expediente';

interface Empresa { id: string; razon_social: string; }
interface Parcela { id: string; parque_id: string; }
interface Parque { id: string; nombre: string; localidad: string; }

export default function MisExpedientes() {
  const navigate = useNavigate();
  const { perfil } = useAuth();

  const { data: expedientes = [], isLoading } = useQuery({
    enabled: !!perfil?.id,
    queryKey: ['mis-expedientes', perfil?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('expedientes').select('*')
        .eq('poseedor_actual', perfil!.id)
        .order('anio', { ascending: false }).order('numero', { ascending: false });
      if (error) throw error;
      return data as Expediente[];
    },
  });
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-min'],
    queryFn: async () => {
      const { data, error } = await supabase.from('empresas').select('id, razon_social');
      if (error) throw error; return data as Empresa[];
    },
  });
  const { data: parcelas = [] } = useQuery({
    queryKey: ['parcelas-parque'],
    queryFn: async () => {
      const { data, error } = await supabase.from('parcelas').select('id, parque_id');
      if (error) throw error; return data as Parcela[];
    },
  });
  const { data: parques = [] } = useQuery({
    queryKey: ['parques'],
    queryFn: async () => {
      const { data, error } = await supabase.from('parques_industriales').select('id, nombre, localidad');
      if (error) throw error; return data as Parque[];
    },
  });

  const empNom = (id: string | null) => empresas.find((e) => e.id === id)?.razon_social ?? 'Sin empresa';
  const parqueDe = (parcelaId: string | null) => {
    const pc = parcelas.find((p) => p.id === parcelaId);
    const pq = pc && parques.find((x) => x.id === pc.parque_id);
    return pq ? `${pq.nombre} · ${pq.localidad}` : '—';
  };

  return (
    <div>
      <EncabezadoPagina titulo="Mis expedientes" descripcion={`${expedientes.length} en tu poder`} />

      {isLoading ? (
        <p className="text-slate-400">Cargando…</p>
      ) : expedientes.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-slate-500">
          <div className="text-3xl mb-2">📂</div>
          No tenés expedientes en tu poder. Cuando la mesa de entrada o un compañero te derive uno, aparecerá acá.
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {expedientes.map((e) => {
            const s = semaforo(e);
            return (
              <button key={e.id} onClick={() => navigate(`/expedientes/${e.id}`)}
                className="text-left bg-white rounded-2xl card-elev hover-lift p-5 relative overflow-hidden">
                <span className="absolute left-0 top-0 h-full w-1.5" style={{ background: SEMAFORO_COLOR[s.color] }} />
                <div className="text-xl font-bold text-[var(--brand)] tabular-nums">
                  {e.sigla ? `${e.sigla} ` : ''}{e.numero}/{e.anio}
                </div>
                <div className="mt-3 space-y-1.5 text-sm">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">Empresa</div>
                    <div className="font-medium text-slate-800">{empNom(e.empresa_id)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">Parque industrial</div>
                    <div className="text-slate-700">{parqueDe(e.parcela_id)}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: SEMAFORO_COLOR[s.color] + '22', color: SEMAFORO_COLOR[s.color] }}>
                    {ESTADO_LABEL[e.estado]}
                  </span>
                  <span className="text-xs text-[var(--brand)]">Ver hoja de ruta →</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
