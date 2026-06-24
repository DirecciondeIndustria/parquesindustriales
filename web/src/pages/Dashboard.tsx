import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Donut, Barras } from '../components/charts';
import { Icon } from '../components/icons';
import { semaforo, type Expediente } from '../lib/expediente';

interface Alerta { id: string; severidad: string; mensaje: string; expediente_id: string | null; }

function KPI({ label, valor, color, icon }: { label: string; valor: number | string; color: string; icon: string }) {
  return (
    <div className="bg-white rounded-2xl card-elev hover-lift p-4 flex items-center gap-3 relative overflow-hidden">
      <span className="absolute left-0 top-0 h-full w-1" style={{ background: color }} />
      <div className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: color + '15', color }}>
        <Icon name={icon} size={22} />
      </div>
      <div>
        <div className="text-2xl font-bold leading-none tabular-nums" style={{ color }}>{valor}</div>
        <div className="text-xs text-slate-500 mt-1">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { perfil } = useAuth();

  const { data: derivPendientes = 0 } = useQuery({
    queryKey: ['mis-derivaciones-pendientes', perfil?.id],
    enabled: !!perfil?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('derivaciones')
        .select('id', { count: 'exact', head: true })
        .eq('a_usuario', perfil!.id).eq('estado', 'pendiente');
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Consultas de empresas cuyo último mensaje es de la empresa (sin responder).
  const { data: consultasPend = [] } = useQuery({
    queryKey: ['consultas-pendientes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('consultas')
        .select('id, expediente_id, emisor, autor_nombre, mensaje, created_at')
        .order('created_at', { ascending: false }).limit(300);
      if (error) throw error;
      const rows = (data ?? []) as { id: string; expediente_id: string | null; emisor: string; autor_nombre: string | null; mensaje: string; created_at: string }[];
      const vistos = new Set<string>();
      const pend: typeof rows = [];
      for (const r of rows) {
        const k = r.expediente_id ?? r.id;
        if (vistos.has(k)) continue;       // solo el último mensaje de cada expediente
        vistos.add(k);
        if (r.emisor === 'empresa') pend.push(r);
      }
      return pend;
    },
  });

  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const [exp, par, emp, insp, ale] = await Promise.all([
        supabase.from('expedientes').select('id, numero, anio, estado, plazo_vencimiento, updated_at'),
        supabase.from('parcelas').select('estado, escriturada'),
        supabase.from('empresas').select('estado'),
        supabase.from('inspecciones').select('estado'),
        supabase.from('alertas').select('id, severidad, mensaje, expediente_id').eq('leida', false).order('severidad'),
      ]);
      return {
        expedientes: (exp.data ?? []) as Expediente[],
        parcelas: (par.data ?? []) as { estado: string; escriturada: boolean }[],
        empresas: (emp.data ?? []) as { estado: string }[],
        inspecciones: (insp.data ?? []) as { estado: string }[],
        alertas: (ale.data ?? []) as Alerta[],
      };
    },
  });

  const exp = data?.expedientes ?? [];
  const par = data?.parcelas ?? [];
  const emp = data?.empresas ?? [];
  const insp = data?.inspecciones ?? [];
  const alertas = data?.alertas ?? [];

  const activos = exp.filter((e) => !['finalizado', 'archivado', 'baja'].includes(e.estado));
  const sem = activos.map((e) => semaforo(e).color);
  const demorados = sem.filter((c) => c === 'rojo').length;
  const finalizados = exp.filter((e) => e.estado === 'finalizado').length;

  const empActivas = emp.filter((e) => e.estado === 'activa').length;
  const parcLibres = par.filter((p) => p.estado === 'libre').length;
  const parcAdjud = par.length - parcLibres;
  const inspRealizadas = insp.filter((i) => i.estado === 'realizada').length;
  const escrituradas = par.filter((p) => p.escriturada).length;
  const pctEscr = par.length ? Math.round((escrituradas / par.length) * 100) : 0;

  const cuenta = (arr: string[], val: string) => arr.filter((x) => x === val).length;
  const sevColor = (s: string) => (s === 'alta' ? '#dc2626' : s === 'media' ? '#d97706' : '#21708c');

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tablero ejecutivo</h1>
          <p className="text-slate-500">Centro de Control Operativo · Parques Industriales del Chubut</p>
        </div>
        <div className="text-right text-sm text-slate-500">
          <div className="font-medium text-slate-700">Hola, {perfil?.nombre ?? 'Usuario'}</div>
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Documentación derivada pendiente para mí (aviso al iniciar sesión) */}
      {derivPendientes > 0 && (
        <button onClick={() => navigate('/documentos')}
          className="w-full text-left bg-white rounded-2xl card-elev border-l-4 border-[var(--brand)] p-4 mb-6 hover:bg-slate-50 transition-colors flex items-center gap-3">
          <span className="text-2xl">📥</span>
          <div>
            <div className="font-semibold text-slate-800">Tenés {derivPendientes} documentación(es) pendiente(s) de recepción</div>
            <div className="text-sm text-slate-500">Mesa de entrada te derivó documentación. Tocá para verla y marcarla recibida.</div>
          </div>
        </button>
      )}

      {/* Consultas de empresas sin responder */}
      {consultasPend.length > 0 && (
        <div className="bg-white rounded-2xl card-elev border-l-4 border-sky-500 p-4 mb-6">
          <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">💬 Consultas de empresas sin responder <span className="text-xs font-normal text-slate-400">({consultasPend.length})</span></h2>
          <div className="space-y-1">
            {consultasPend.slice(0, 6).map((c) => (
              <button key={c.id} onClick={() => c.expediente_id && navigate(`/expedientes/${c.expediente_id}`)}
                className="w-full text-left flex items-start gap-2.5 text-sm hover:bg-slate-50 rounded-lg px-2.5 py-2 transition-colors">
                <span className="text-sky-500 mt-0.5">💬</span>
                <span className="text-slate-700"><strong>{c.autor_nombre ?? 'Empresa'}:</strong> {c.mensaje.slice(0, 90)}{c.mensaje.length > 90 ? '…' : ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Franja de alertas críticas */}
      {alertas.length > 0 && (
        <div className="bg-white rounded-2xl card-elev border-l-4 border-red-500 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="text-red-500"><Icon name="alertas" size={20} /></span>
              Requieren atención <span className="text-xs font-normal text-slate-400">({alertas.length})</span>
            </h2>
            <button onClick={() => navigate('/alertas')} className="text-sm font-medium text-[var(--brand)] hover:underline">Ver todas →</button>
          </div>
          <div className="space-y-1">
            {alertas.slice(0, 5).map((a) => (
              <button key={a.id} onClick={() => a.expediente_id && navigate(`/expedientes/${a.expediente_id}`)}
                className="w-full text-left flex items-center gap-2.5 text-sm hover:bg-slate-50 rounded-lg px-2.5 py-2 transition-colors">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sevColor(a.severidad), boxShadow: `0 0 0 3px ${sevColor(a.severidad)}22` }} />
                <span className="text-slate-700">{a.mensaje}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KPI label="Expedientes activos" valor={activos.length} color="#21708c" icon="expedientes" />
        <KPI label="Demorados / en riesgo" valor={demorados} color="#dc2626" icon="alertas" />
        <KPI label="Finalizados" valor={finalizados} color="#16a34a" icon="auditoria" />
        <KPI label="Empresas activas" valor={empActivas} color="#21708c" icon="empresas" />
        <KPI label="Parcelas adjudicadas" valor={parcAdjud} color="#21708c" icon="parcelas" />
        <KPI label="Parcelas libres" valor={parcLibres} color="#64748b" icon="parques" />
        <KPI label="Inspecciones realizadas" valor={inspRealizadas} color="#16a34a" icon="inspecciones" />
        <KPI label="% Escrituradas" valor={`${pctEscr}%`} color="#21708c" icon="escrituraciones" />
      </div>

      {/* Gráficos */}
      <div className="grid md:grid-cols-2 gap-4">
        <Donut
          titulo="Expedientes activos por semáforo"
          datos={[
            { label: 'En término', valor: cuenta(sem, 'verde'), color: '#16a34a' },
            { label: 'Atención', valor: cuenta(sem, 'amarillo'), color: '#eab308' },
            { label: 'Crítico', valor: cuenta(sem, 'rojo'), color: '#dc2626' },
          ]}
        />
        <Barras
          titulo="Parcelas por estado"
          datos={[
            { label: 'Operativa', valor: cuenta(par.map((p) => p.estado), 'operativa'), color: '#16a34a' },
            { label: 'En desarrollo', valor: cuenta(par.map((p) => p.estado), 'desarrollo'), color: '#eab308' },
            { label: 'Incumplimiento', valor: cuenta(par.map((p) => p.estado), 'incumplimiento'), color: '#dc2626' },
            { label: 'Libre', valor: cuenta(par.map((p) => p.estado), 'libre'), color: '#94a3b8' },
            { label: 'Escriturada', valor: cuenta(par.map((p) => p.estado), 'escriturada'), color: '#21708c' },
          ]}
        />
      </div>
    </div>
  );
}
