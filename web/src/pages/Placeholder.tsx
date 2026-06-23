import { EncabezadoPagina } from '../components/ui';

export default function Placeholder({ titulo, fase }: { titulo: string; fase: string }) {
  return (
    <div>
      <EncabezadoPagina titulo={titulo} descripcion="Módulo del SIGPIP" />
      <div className="bg-white rounded-2xl p-12 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl grid place-items-center mb-4 text-white shadow-lg" style={{ background: 'var(--brand-grad)' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" /></svg>
        </div>
        <p className="text-slate-600">Este módulo se construye en la <strong className="text-[var(--brand)]">{fase}</strong>.</p>
      </div>
    </div>
  );
}
