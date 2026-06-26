import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

// Login unificado con la app de inspecciones (mismo formato; solo cambia el
// nombre del sistema). Paleta Marca Chubut, tipografía Public Sans.
const authCSS = `
.au-screen{min-height:100%;min-height:100dvh;display:grid;place-items:center;padding:20px;
  font-family:'Public Sans',system-ui,-apple-system,'Segoe UI',sans-serif;
  background:
    radial-gradient(900px 520px at 50% -12%, rgba(255,104,44,.12), transparent 60%),
    radial-gradient(760px 520px at 50% 120%, rgba(33,112,140,.09), transparent 55%),
    #f7f4ef;}
.au-card{width:100%;max-width:380px;background:#fff;border-radius:22px;padding:30px 26px 24px;
  text-align:center;border:1px solid #eef0f3;box-shadow:0 26px 70px -22px rgba(143,52,22,.30);}
.au-logo{display:block;width:100%;max-width:236px;height:auto;margin:0 auto 20px;}
.au-title{font-size:26px;font-weight:800;letter-spacing:-.02em;margin:0;
  background:linear-gradient(135deg,#ff682c 0%,#ff8540 55%,#ffb109 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent;}
.au-sub{font-size:13.5px;color:#64748b;margin:6px 0 22px;line-height:1.5;}
.au-field{text-align:left;margin-bottom:14px;}
.au-field label{display:block;font-size:13px;font-weight:600;color:#334155;margin-bottom:6px;}
.au-field input{width:100%;box-sizing:border-box;padding:11px 13px;font-size:15px;font-family:inherit;
  color:#15202e;background:#fff;border:1px solid #d4dde8;border-radius:11px;outline:none;
  transition:border-color .15s,box-shadow .15s;}
.au-field input:focus{border-color:#ff682c;box-shadow:0 0 0 3px rgba(255,104,44,.15);}
.au-error{background:#fdecec;border:1px solid #f3b9b9;color:#a12020;border-radius:10px;padding:10px 12px;
  font-size:13px;margin-bottom:12px;text-align:left;line-height:1.45;}
.au-btn{width:100%;padding:12px;font-size:15px;font-weight:700;font-family:inherit;color:#fff;border:none;
  border-radius:11px;cursor:pointer;background:linear-gradient(135deg,#ff682c 0%,#e85420 100%);
  box-shadow:0 10px 24px -10px rgba(232,84,32,.6);transition:filter .15s,transform .05s;}
.au-btn:hover{filter:brightness(1.05);}
.au-btn:active{transform:translateY(1px);}
.au-btn:disabled{opacity:.6;cursor:default;}
.au-foot{font-size:11px;color:#94a3b8;margin-top:20px;letter-spacing:.02em;}
`;

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
    <div className="au-screen">
      <style>{authCSS}</style>
      <div className="au-card">
        <img className="au-logo" src="/logo.png" alt="Ministerio de Producción del Chubut" />
        <h1 className="au-title">SIGPIP</h1>
        <p className="au-sub">Dirección de Industria · Ministerio de Producción del Chubut</p>
        <form onSubmit={onSubmit}>
          <div className="au-field">
            <label>Email</label>
            <input type="email" required value={email} autoComplete="username"
              placeholder="tu.usuario@chubut.gov.ar"
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
        <p className="au-foot">Gobierno de la Provincia del Chubut</p>
      </div>
    </div>
  );
}
