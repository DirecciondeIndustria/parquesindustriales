import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { inputCls, Boton } from '../components/ui';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError('No se pudo iniciar sesión. Revisá email y contraseña.');
    setCargando(false);
  }

  return (
    <div className="min-h-full grid place-items-center p-4 relative overflow-hidden"
      style={{ background: 'var(--sidebar-grad)' }}>
      {/* Adornos de fondo */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-emerald-400/10 blur-3xl" />

      <form onSubmit={onSubmit}
        className="relative w-full max-w-sm glass rounded-3xl shadow-2xl p-8 space-y-5 ring-1 ring-white/40 animate-scale">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto rounded-2xl grid place-items-center shadow-lg mb-4 overflow-hidden" style={{ background: '#fff' }}>
            <img src="/logo.png" alt="Logo Dirección de Industria" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-gradient">SIGPIP</h1>
          <p className="text-sm text-slate-500 mt-1">Sistema Integral de Gestión de<br />Parques Industriales · Chubut</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Email</label>
          <input type="email" required value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Contraseña</label>
          <input type="password" required value={password} autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <Boton type="submit" disabled={cargando} className="w-full py-2.5">
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </Boton>

        <p className="text-center text-[11px] text-slate-400 pt-1">
          Dirección de Industria · Ministerio de Producción del Chubut
        </p>
      </form>
    </div>
  );
}
