import { useAuth } from './auth';

/** Roles que pueden crear/editar maestros y expedientes. */
const ROLES_EDICION = ['administrador', 'director', 'parques', 'archivo'];

export function usePermisos() {
  const { perfil } = useAuth();
  const rol = perfil?.rol;
  return {
    rol,
    puedeEditar: !!rol && ROLES_EDICION.includes(rol),
    esAdmin: rol === 'administrador' || rol === 'director',
  };
}
