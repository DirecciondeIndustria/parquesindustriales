import { useAuth } from './auth';

/** Roles principales que pueden editar el SIGPIP (todos menos inspector). */
const ROLES_EDICION = [
  'administrador', 'director', 'jefe_departamento', 'mesa_entrada', 'tecnico_administrativo',
];

export function usePermisos() {
  const { perfil } = useAuth();
  const rol = perfil?.rol;
  const rolSecundario = perfil?.rol_secundario ?? null;
  return {
    rol,
    rolSecundario,
    // Edición general: definida SOLO por el rol principal.
    puedeEditar: !!rol && ROLES_EDICION.includes(rol),
    // Acceso total / borrado / gestión de roles: solo administrador.
    esAdmin: rol === 'administrador',
    // App de actas: inspector como principal o secundario.
    puedeInspeccionar: rol === 'inspector' || rolSecundario === 'inspector',
  };
}
