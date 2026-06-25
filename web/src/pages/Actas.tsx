import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Modal, Boton, inputCls, EncabezadoPagina, Skeleton } from '../components/ui';
import { fmtFecha } from '../lib/fechas';
import { renderActaPdf } from '../lib/pdfActaOficial';

// Acta completa cargada desde la app de inspecciones del celular.
// Tabla `actas_inspeccion` (ver migración 0024). Vista de SOLO LECTURA.
interface Acta {
  id: string;
  numero: number | null;
  anio: number | null;
  razon_social: string | null;
  cuit: string | null;
  parque: string | null;
  ciudad: string | null;
  fecha: string | null;
  estado: string | null;
  datos: Record<string, unknown> | null;
  fotos: string[] | null;
  sig1: string | null;
  sig2: string | null;
  sig3: string | null;
  inspector_nombre: string | null;
  created_at: string;
}

const nro = (a: Acta) => `${String(a.numero ?? 0).padStart(3, '0')}/${a.anio ?? ''}`;
const txt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

export default function Actas() {
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<Acta | null>(null);

  const { data: actas = [], isLoading, error } = useQuery({
    queryKey: ['actas_inspeccion'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('actas_inspeccion')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Acta[];
    },
  });

  const q = busca.trim().toLowerCase();
  const visibles = q
    ? actas.filter((a) =>
        [a.razon_social, a.parque, a.ciudad, a.cuit, nro(a), a.inspector_nombre]
          .filter(Boolean).join(' ').toLowerCase().includes(q))
    : actas;

  return (
    <div>
      <EncabezadoPagina
        titulo="Inspecciones"
        descripcion={`${actas.length} acta${actas.length === 1 ? '' : 's'} recibida${actas.length === 1 ? '' : 's'} desde la app de inspectores`}
      />

      <p className="text-xs text-slate-400 mb-4">
        Vista informativa de solo lectura. Las actas se cargan desde la app móvil de inspecciones y se reflejan acá automáticamente.
      </p>

      <input
        className={`${inputCls} mb-4 max-w-sm`}
        placeholder="Buscar por empresa, parque, CUIT, N° o inspector…"
        value={busca} onChange={(e) => setBusca(e.target.value)}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm mb-4">
          No se pudieron cargar las actas. Verificá que la migración <code>0024_actas_inspeccion.sql</code> esté aplicada en Supabase.
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">N°</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Parque</th>
              <th className="px-4 py-3 font-medium">Ciudad</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Inspector</th>
              <th className="px-4 py-3 font-medium">Fotos</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-3"><Skeleton className="h-6 w-full" /></td></tr>
            )}
            {!isLoading && visibles.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                {q ? 'Sin resultados.' : 'Todavía no se recibieron actas desde la app.'}
              </td></tr>
            )}
            {visibles.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSel(a)}>
                <td className="px-4 py-3 font-semibold text-[var(--brand)]">{nro(a)}</td>
                <td className="px-4 py-3 text-slate-700">{txt(a.razon_social)}</td>
                <td className="px-4 py-3 text-slate-600">{txt(a.parque)}</td>
                <td className="px-4 py-3 text-slate-600">{txt(a.ciudad)}</td>
                <td className="px-4 py-3 text-slate-600">{fmtFecha(a.fecha)}</td>
                <td className="px-4 py-3 text-slate-600">{txt(a.inspector_nombre)}</td>
                <td className="px-4 py-3 text-slate-600">{a.fotos?.length ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[var(--brand)] hover:underline">Ver acta</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal titulo={sel ? `Acta de inspección N° ${nro(sel)}` : ''} abierto={!!sel} onCerrar={() => setSel(null)}>
        {sel && (
          <>
            <div className="flex justify-end mb-3">
              <Boton onClick={() => renderActaPdf({ actaNum: sel.numero, actaYear: sel.anio, ...(sel.datos ?? {}), photos: sel.fotos ?? [], sig1: sel.sig1, sig2: sel.sig2, sig3: sel.sig3 })}>Descargar PDF</Boton>
            </div>
            <DetalleActa a={sel} />
          </>
        )}
      </Modal>
    </div>
  );
}

// ─────────── Detalle de solo lectura ───────────
function Dato({ k, v }: { k: string; v: unknown }) {
  return (
    <div className="flex gap-2 py-1 text-sm">
      <span className="text-slate-500 min-w-[150px] shrink-0">{k}</span>
      <span className="text-slate-800 font-medium break-words">{txt(v)}</span>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
      <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--brand)] mb-2">{titulo}</h3>
      {children}
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-slate-400">Sin marcar.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 rounded-full px-2.5 py-1 text-xs">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><path d="M20 6 9 17l-5-5" /></svg>
          {t}
        </span>
      ))}
    </div>
  );
}

function DetalleActa({ a }: { a: Acta }) {
  const d = (a.datos ?? {}) as Record<string, any>;
  const marc = (pairs: [boolean, string][]) => pairs.filter(([c]) => !!c).map(([, l]) => l);

  const acceso = marc([
    [d.accesoPredi, 'Acceso al predio'],
    [d.accesoInterior, 'Acceso al interior'],
    [d.noPudoAcceder, 'No se pudo acceder'],
    [d.seNegoAcceso, 'Se negó el acceso'],
    [d.otrosMotivos, 'Otros motivos'],
  ]);
  const estado = marc([
    [d.cercado, 'Cercado total/parcial'],
    [d.movSuelos, 'Movimiento de suelos'],
    [d.sinModif, 'Sin modificaciones'],
    [d.sinConstruccion, 'Sin construcción'],
    [d.enConstruccion, 'En construcción'],
    [d.construcActual, '· Actualmente'],
    [d.construcDetenida, '· Detenida/abandonada'],
    [d.conConstruccion, 'Construcción finalizada'],
  ]);
  const servicios = marc([
    [d.srvEnergia, 'Energía'],
    [d.srvGasRed, 'Gas de red'],
    [d.srvGasEnvasado, 'Gas envasado'],
    [d.srvAguaPot, 'Agua potable'],
    [d.srvAguaInd, 'Agua industrial'],
    [d.srvCloacas, 'Cloacas'],
    [d.srvOtros, d.srvOtrosTexto ? `Otros: ${d.srvOtrosTexto}` : 'Otros'],
  ]);
  const agentes = Array.isArray(d.agents) ? d.agents : [];
  const firmas = [
    { img: a.sig1, nom: d.agente1Nombre || agentes[0] || 'Agente 1', rol: 'Agente inspector' },
    { img: a.sig2, nom: d.agente2Nombre || agentes[1] || 'Agente 2', rol: 'Agente inspector' },
    { img: a.sig3, nom: `${d.respNombre || ''} ${d.respApellido || ''}`.trim() || 'Responsable', rol: d.respCargo || 'Responsable' },
  ].filter((f) => f.img);

  return (
    <div className="space-y-1">
      <Seccion titulo="General">
        <Dato k="Fecha / hora" v={`${fmtFecha(a.fecha)}${d.hora ? ' · ' + d.hora : ''}`} />
        <Dato k="Ciudad" v={a.ciudad} />
        <Dato k="Inspector que cargó" v={a.inspector_nombre} />
        <Dato k="Agentes" v={agentes.join(', ')} />
        <Dato k="Recibido" v={new Date(a.created_at).toLocaleString('es-AR')} />
      </Seccion>

      <Seccion titulo="Empresa">
        <Dato k="Razón social" v={a.razon_social} />
        <Dato k="CUIT" v={a.cuit} />
        <Dato k="Domicilio legal" v={d.domicilioEmpresa} />
        <Dato k="Email" v={d.emailEmpresa} />
      </Seccion>

      <Seccion titulo="Responsable que recibe">
        <Dato k="Nombre" v={`${d.respNombre || ''} ${d.respApellido || ''}`.trim()} />
        <Dato k="DNI" v={d.respDni} />
        <Dato k="Cargo" v={d.respCargo} />
      </Seccion>

      <Seccion titulo="Establecimiento">
        <Dato k="Predio" v={d.establecimiento} />
        <Dato k="Dirección" v={d.domicilioEstablec} />
        <Dato k="Parque industrial" v={a.parque} />
        <Dato k="Nomenclatura" v={`Ejido ${d.ejido || '—'} · Circ ${d.circ || '—'} · Sec ${d.sector || '—'} · Div ${d.division || '—'} · Parc ${d.parcela || '—'}${d.macizo ? ' · Mac ' + d.macizo : ''}`} />
      </Seccion>

      <Seccion titulo="Acceso al predio">
        <Chips items={acceso} />
        {d.otrosMotivosTexto && <Dato k="Motivos" v={d.otrosMotivosTexto} />}
        {d.obsAcceso && <Dato k="Observaciones" v={d.obsAcceso} />}
      </Seccion>

      <Seccion titulo="Estado del predio">
        <Chips items={estado} />
        {d.estadoConstruccion && <Dato k="Características" v={d.estadoConstruccion} />}
        {d.obsEstadoPredi && <Dato k="Observaciones" v={d.obsEstadoPredi} />}
      </Seccion>

      <Seccion titulo="Actividad industrial">
        <Chips items={marc([[d.sinActividad, 'Sin actividad'], [d.enActividad, 'En actividad']])} />
        {d.detalleActividad && <Dato k="Detalle" v={d.detalleActividad} />}
        {d.productos && <Dato k="Productos/servicios" v={d.productos} />}
        {d.personal && <Dato k="Personal" v={d.personal} />}
        {d.capacidad && <Dato k="Capacidad" v={d.capacidad} />}
        {d.obsActividad && <Dato k="Observaciones" v={d.obsActividad} />}
      </Seccion>

      <Seccion titulo="Servicios del predio">
        <Chips items={servicios} />
        {d.obsServicios && <Dato k="Observaciones" v={d.obsServicios} />}
      </Seccion>

      {d.otrasObs && (
        <Seccion titulo="Otras observaciones">
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{d.otrasObs}</p>
        </Seccion>
      )}

      {(a.fotos?.length ?? 0) > 0 && (
        <Seccion titulo={`Fotografías (${a.fotos!.length})`}>
          <div className="grid grid-cols-3 gap-2">
            {a.fotos!.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden ring-1 ring-slate-200">
                <img src={src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform" />
              </a>
            ))}
          </div>
        </Seccion>
      )}

      {firmas.length > 0 && (
        <Seccion titulo="Firmas">
          <div className="grid grid-cols-2 gap-3">
            {firmas.map((f, i) => (
              <div key={i} className="text-center">
                <div className="bg-slate-50 rounded-lg ring-1 ring-slate-200 p-2 h-24 flex items-center justify-center">
                  <img src={f.img!} alt={`Firma ${i + 1}`} className="max-h-full max-w-full object-contain" />
                </div>
                <div className="text-xs font-medium text-slate-700 mt-1">{f.nom}</div>
                <div className="text-[11px] text-slate-400 capitalize">{f.rol}</div>
              </div>
            ))}
          </div>
        </Seccion>
      )}
    </div>
  );
}
