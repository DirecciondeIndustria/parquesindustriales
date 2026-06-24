import { supabase } from './supabase';

/** Llama a la Edge Function `admin-usuarios` con el token del admin.
 *  Acciones: crear | resetear_password | set_rol | set_activo |
 *            crear_acceso_empresa | revocar_acceso_empresa */
export async function adminUsuarios(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-usuarios', { body: payload });
  if (error) {
    let msg = error.message;
    try {
      const ctx = await (error as { context?: Response }).context?.json();
      if (ctx?.error) msg = ctx.error;
    } catch { /* ignorar */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
