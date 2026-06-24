import type { ReactNode, ButtonHTMLAttributes } from 'react';

export function Boton({
  variante = 'primario',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' | 'peligro' }) {
  const estilos = {
    primario: 'text-white shadow-md hover:shadow-lg hover:brightness-110 active:scale-[.97]',
    secundario: 'bg-white text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50 hover:border-slate-400 active:scale-[.97]',
    peligro: 'bg-red-600 text-white shadow-md hover:bg-red-700 hover:shadow-lg active:scale-[.97]',
  }[variante];
  const fondo = variante === 'primario' ? { background: 'var(--brand-grad)' } : undefined;
  return (
    <button
      {...props}
      style={{ ...fondo, ...props.style }}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium
        transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none ${estilos} ${className}`}
    />
  );
}

export function Modal({
  titulo, abierto, onCerrar, children,
}: { titulo: string; abierto: boolean; onCerrar: () => void; children: ReactNode }) {
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-40 backdrop-blur-md overflow-y-auto p-4 animate-fade" onClick={onCerrar}>
      <div
        className="w-full max-w-lg mx-auto my-4 sm:my-8 bg-white rounded-2xl shadow-2xl animate-scale ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="font-semibold text-slate-800">{titulo}</h2>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg w-8 h-8 grid place-items-center transition-colors" aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-all ' +
  'placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:border-[var(--brand-light)] focus:ring-2 focus:ring-[var(--brand-light)]/25';

export function EncabezadoPagina({
  titulo, descripcion, accion,
}: { titulo: string; descripcion?: string; accion?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gradient">{titulo}</h1>
        {descripcion && <p className="text-slate-500 mt-0.5">{descripcion}</p>}
      </div>
      {accion}
    </div>
  );
}
