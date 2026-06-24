import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Parques from './pages/Parques';
import Empresas from './pages/Empresas';
import Parcelas from './pages/Parcelas';
import Expedientes from './pages/Expedientes';
import MisExpedientes from './pages/MisExpedientes';
import ExpedienteDetalle from './pages/ExpedienteDetalle';
import Flujos from './pages/Flujos';
import Documentos from './pages/Documentos';
import Inspecciones from './pages/Inspecciones';
import Escrituraciones from './pages/Escrituraciones';
import Archivo from './pages/Archivo';
import Alertas from './pages/Alertas';
import Auditoria from './pages/Auditoria';
import Usuarios from './pages/Usuarios';
import MiCuenta from './pages/MiCuenta';
import Portal from './pages/Portal';
import Placeholder from './pages/Placeholder';

export default function App() {
  const { session, perfil, empresaId, cargando, salir } = useAuth();

  if (cargando) {
    return <div className="min-h-full grid place-items-center text-slate-500">Cargando…</div>;
  }

  if (!session) return <Login />;

  // Cuenta de empresa (portal externo de solo lectura).
  if (!perfil && empresaId) return <Portal />;

  // Sesión sin perfil interno ni acceso de empresa: cuenta sin permisos.
  if (!perfil) {
    return (
      <div className="min-h-full grid place-items-center p-4 text-center">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm">
          <div className="text-3xl mb-2">🔒</div>
          <h1 className="font-semibold text-slate-800 mb-1">Tu cuenta no tiene accesos asignados</h1>
          <p className="text-sm text-slate-500 mb-4">Comunicate con la Dirección de Industria para que te habiliten.</p>
          <button onClick={salir} className="text-[var(--brand)] hover:underline text-sm">Cerrar sesión</button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="parques" element={<Parques />} />
          <Route path="empresas" element={<Empresas />} />
          <Route path="parcelas" element={<Parcelas />} />
          <Route path="expedientes" element={<Expedientes />} />
          <Route path="mis-expedientes" element={<MisExpedientes />} />
          <Route path="expedientes/:id" element={<ExpedienteDetalle />} />
          <Route path="flujos" element={<Flujos />} />
          <Route path="documentos" element={<Documentos />} />
          <Route path="inspecciones" element={<Inspecciones />} />
          <Route path="escrituraciones" element={<Escrituraciones />} />
          <Route path="archivo" element={<Archivo />} />
          <Route path="alertas" element={<Alertas />} />
          <Route path="asistente" element={<Placeholder titulo="Asistente administrativo" fase="Fase 5" />} />
          <Route path="auditoria" element={<Auditoria />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="mi-cuenta" element={<MiCuenta />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
