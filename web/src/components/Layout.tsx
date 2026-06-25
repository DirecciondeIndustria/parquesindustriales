import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Icon } from './icons';
import { ThemeToggle } from './ThemeToggle';

export const MODULOS = [
  { to: '/', label: 'Tablero', icon: 'tablero' },
  { to: '/parques', label: 'Parques industriales', icon: 'parques' },
  { to: '/empresas', label: 'Empresas', icon: 'empresas' },
  { to: '/parcelas', label: 'Parcelas', icon: 'parcelas' },
  { to: '/expedientes', label: 'Expedientes', icon: 'expedientes' },
  { to: '/mis-expedientes', label: 'Mis expedientes', icon: 'archivo' },
  { to: '/flujos', label: 'Flujos de trámite', icon: 'flujos' },
  { to: '/documentos', label: 'Mesa de Entradas y Salidas', icon: 'documentos' },
  { to: '/inspecciones', label: 'Inspecciones', icon: 'inspecciones' },
  { to: '/escrituraciones', label: 'Escrituraciones', icon: 'escrituraciones' },
  { to: '/archivo', label: 'Archivo', icon: 'archivo' },
  { to: '/alertas', label: 'Alertas', icon: 'alertas' },
  { to: '/asistente', label: 'Asistente', icon: 'asistente' },
  { to: '/auditoria', label: 'Auditoría', icon: 'auditoria' },
  { to: '/usuarios', label: 'Usuarios y roles', icon: 'usuarios' },
];

export default function Layout() {
  const { perfil, salir } = useAuth();
  const [abierto, setAbierto] = useState(false);

  const iniciales = (perfil?.nombre ?? 'U').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-full flex">
      <aside
        className={`${abierto ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
          fixed md:sticky top-0 z-30 w-64 h-screen flex flex-col text-white transition-transform duration-300`}
        style={{ background: 'var(--sidebar-grad)' }}
      >
        {/* Encabezado con logo */}
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/95 grid place-items-center shadow-lg shrink-0 overflow-hidden">
            <img src="/logo-silueta.png" alt="Logo Dirección de Industria" className="w-9 h-9 object-contain" />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-wide">SIGPIP</div>
            <div className="text-[11px] text-white/60">Parques Industriales · Chubut</div>
          </div>
        </div>

        <nav className="stagger flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {MODULOS.map((m) => (
            <NavLink
              key={m.to} to={m.to} end={m.to === '/'}
              onClick={() => setAbierto(false)}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                 transition-[transform,background-color,color,box-shadow] duration-200 ease-[cubic-bezier(.23,1,.32,1)]
                 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:rounded-r-full before:bg-white
                 before:transition-[height] before:duration-200 ${
                  isActive
                    ? 'bg-white/15 font-semibold shadow-inner ring-1 ring-white/10 before:h-5'
                    : 'text-white/75 hover:text-white hover:bg-white/10 hover:translate-x-0.5 before:h-0'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-white/60 group-hover:text-white'}`}>
                    <Icon name={m.icon} size={19} />
                  </span>
                  {m.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-white/10 text-[11px] text-white/40">
          Dirección de Industria · Chubut
        </div>
      </aside>

      {abierto && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-20 md:hidden" onClick={() => setAbierto(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="glass sticky top-0 z-10 px-4 py-3 flex items-center justify-between border-b border-slate-200/70 shadow-sm relative">
          <button className="md:hidden text-slate-600 p-1" onClick={() => setAbierto(true)} aria-label="Abrir menú">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>

          {/* Logo institucional centrado (el wordmark se invierte a blanco en modo oscuro) */}
          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
            <img src="/logo.png" alt="Ministerio de Producción · Gobierno del Chubut" className="logo-header hidden sm:block h-7 object-contain" />
            <img src="/logo-silueta.png" alt="Gobierno del Chubut" className="sm:hidden h-7 w-7 object-contain" />
          </div>

          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NavLink to="/mi-cuenta" title="Mi cuenta" className="flex items-center gap-3 rounded-lg px-1.5 py-1 hover:bg-slate-100 transition-colors">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-slate-800 leading-tight">{perfil?.nombre ?? 'Usuario'}</div>
                <div className="text-xs text-slate-500 capitalize">{perfil?.rol?.replace('_', ' ')}</div>
              </div>
              <div className="w-9 h-9 rounded-full grid place-items-center text-white text-sm font-semibold shadow-md" style={{ background: 'var(--brand-grad)' }}>
                {iniciales}
              </div>
            </NavLink>
            <button
              onClick={salir}
              className="ml-1 text-slate-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50"
              title="Cerrar sesión" aria-label="Cerrar sesión"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          <div className="animate-in max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
