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
import Placeholder from './pages/Placeholder';

export default function App() {
  const { session, cargando } = useAuth();

  if (cargando) {
    return <div className="min-h-full grid place-items-center text-slate-500">Cargando…</div>;
  }

  if (!session) return <Login />;

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
