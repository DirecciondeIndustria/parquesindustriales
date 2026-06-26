import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { authCSS } from '../lib/authCss';

// Login unificado con la app de inspecciones (mismo formato; solo cambia el
// nombre del sistema). Paleta Marca Chubut, tipografía Public Sans.
export default function Login({ variant = 'sigpip' }: { variant?: 'sigpip' | 'empresas' }) {
  const esEmpresas = variant === 'empresas';
  const titulo = esEmpresas ? 'Portal de Empresas' : 'SIGPIP';
  const subtitulo = esEmpresas
    ? 'Acceso para empresas de Parques Industriales · Chubut'
    : 'Dirección de Industria · Ministerio de Producción del Chubut';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [modo, setModo] = useState<'login' | 'recuperar'>('login');
  const [info, setInfo] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError('No se pudo iniciar sesión. Revisá email y contraseña.');
    setCargando(false);
  }

  async function recuperar(e: FormEvent) {
    e.preventDefault();
    setError(''); setInfo(''); setCargando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + '/restablecer',
    });
    setCargando(false);
    if (error) { setError('No se pudo enviar el correo. Revisá el email e intentá de nuevo.'); return; }
    setInfo('Te enviamos un correo con el enlace para restablecer tu contraseña. Revisá tu bandeja (y el spam).');
  }

  return (
    <div className="au-screen">
      <style>{authCSS}</style>
      <div className="au-card">
        <img className="au-logo" src="/logo.png" alt="Ministerio de Producción del Chubut" />
        <h1 className="au-title">{titulo}</h1>
        <p className="au-sub">{subtitulo}</p>

        {modo === 'login' ? (
          <>
            <form onSubmit={onSubmit}>
              <div className="au-field">
                <label>Email</label>
                <input type="email" required value={email} autoComplete="username"
                  placeholder={esEmpresas ? 'tu.empresa@empresa.com' : 'tu.usuario@chubut.gov.ar'}
                  onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="au-field">
                <label>Contraseña</label>
                <input type="password" required value={password} autoComplete="current-password"
                  placeholder="••••••••"
                  onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <div className="au-error">{error}</div>}
              <button className="au-btn" type="submit" disabled={cargando}>
                {cargando ? 'Ingresando…' : 'Ingresar'}
              </button>
            </form>
            <button className="au-link" onClick={() => { setModo('recuperar'); setError(''); setInfo(''); }}>
              ¿Olvidaste tu contraseña?
            </button>
          </>
        ) : (
          <>
            <form onSubmit={recuperar}>
              <div className="au-field">
                <label>Email de tu cuenta</label>
                <input type="email" required value={email} autoComplete="username"
                  placeholder={esEmpresas ? 'tu.empresa@empresa.com' : 'tu.usuario@chubut.gov.ar'}
                  onChange={(e) => setEmail(e.target.value)} />
              </div>
              {error && <div className="au-error">{error}</div>}
              {info && <div className="au-ok">{info}</div>}
              <button className="au-btn" type="submit" disabled={cargando}>
                {cargando ? 'Enviando…' : 'Enviar enlace de recuperación'}
              </button>
            </form>
            <button className="au-link" onClick={() => { setModo('login'); setError(''); setInfo(''); }}>
              Volver al ingreso
            </button>
          </>
        )}

        <p className="au-foot">Gobierno de la Provincia del Chubut</p>
      </div>
    </div>
  );
}
