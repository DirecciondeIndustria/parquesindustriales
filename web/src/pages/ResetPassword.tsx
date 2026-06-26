import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { authCSS } from '../lib/authCss';

// Página a la que llega el usuario desde el enlace de recuperación del email.
// Supabase ya estableció una sesión de recuperación; acá define la clave nueva.
export default function ResetPassword() {
  const [pass, setPass] = useState({ a: '', b: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (pass.a.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (pass.a !== pass.b) { setError('Las contraseñas no coinciden.'); return; }
    setCargando(true);
    const { error } = await supabase.auth.updateUser({ password: pass.a });
    setCargando(false);
    if (error) { setError('No se pudo actualizar. El enlace puede haber vencido; pedí uno nuevo desde el ingreso.'); return; }
    await supabase.auth.signOut();
    setOk(true);
  }

  return (
    <div className="au-screen">
      <style>{authCSS}</style>
      <div className="au-card">
        <img className="au-logo" src="/logo.png" alt="Ministerio de Producción del Chubut" />
        <h1 className="au-title">Nueva contraseña</h1>
        <p className="au-sub">Elegí una contraseña nueva para tu cuenta.</p>

        {ok ? (
          <>
            <div className="au-ok">Tu contraseña se actualizó. Ya podés ingresar con la nueva.</div>
            <button className="au-btn" onClick={() => { window.location.href = '/'; }}>Ir al ingreso</button>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="au-field">
              <label>Nueva contraseña (mín. 6)</label>
              <input type="password" required minLength={6} value={pass.a} autoComplete="new-password"
                placeholder="••••••••" onChange={(e) => setPass({ ...pass, a: e.target.value })} />
            </div>
            <div className="au-field">
              <label>Repetir contraseña</label>
              <input type="password" required value={pass.b} autoComplete="new-password"
                placeholder="••••••••" onChange={(e) => setPass({ ...pass, b: e.target.value })} />
            </div>
            {error && <div className="au-error">{error}</div>}
            <button className="au-btn" type="submit" disabled={cargando}>
              {cargando ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}

        <p className="au-foot">Gobierno de la Provincia del Chubut</p>
      </div>
    </div>
  );
}
