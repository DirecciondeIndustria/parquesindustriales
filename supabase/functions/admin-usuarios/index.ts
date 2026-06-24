// ════════════════════════════════════════════════════════════════
//  SIGPIP — Edge Function: admin-usuarios
//  Crea y administra usuarios usando la service_role (que NO puede vivir
//  en el frontend). Verifica que quien llama sea administrador/director.
//  Acciones: crear | resetear_password | set_rol | set_activo
//
//  Deploy (una vez):  Supabase → Edge Functions → Deploy new function
//                     (o `supabase functions deploy admin-usuarios`)
//  No requiere cargar secrets: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
//  los inyecta Supabase automáticamente.
// ════════════════════════════════════════════════════════════════
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ROLES = ['administrador', 'director', 'direccion_general', 'parques', 'archivo', 'inspector', 'consulta'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 1) Identificar a quien llama por su token y validar que sea admin.
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: 'No autenticado.' }, 401);

    const { data: perfil } = await admin
      .from('usuarios').select('rol').eq('id', userData.user.id).maybeSingle();
    if (!perfil || !['administrador', 'director'].includes(perfil.rol)) {
      return json({ error: 'Solo un administrador puede gestionar usuarios.' }, 403);
    }

    // 2) Ejecutar la acción pedida.
    const body = await req.json();
    const action = body.action as string;

    if (action === 'crear') {
      const { nombre, email, password, rol } = body;
      if (!nombre || !email || !password || !ROLES.includes(rol)) return json({ error: 'Datos incompletos.' }, 400);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (cErr || !created.user) return json({ error: cErr?.message ?? 'No se pudo crear el usuario.' }, 400);

      const { error: pErr } = await admin.from('usuarios')
        .insert({ id: created.user.id, nombre, email, rol, activo: true });
      if (pErr) {
        // Revertir el usuario de auth si falló el perfil.
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: pErr.message }, 400);
      }
      return json({ ok: true, id: created.user.id });
    }

    if (action === 'resetear_password') {
      const { user_id, password } = body;
      if (!user_id || !password) return json({ error: 'Datos incompletos.' }, 400);
      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'set_rol') {
      const { user_id, rol } = body;
      if (!user_id || !ROLES.includes(rol)) return json({ error: 'Datos incompletos.' }, 400);
      const { error } = await admin.from('usuarios').update({ rol }).eq('id', user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'set_activo') {
      const { user_id, activo } = body;
      if (!user_id || typeof activo !== 'boolean') return json({ error: 'Datos incompletos.' }, 400);
      const { error } = await admin.from('usuarios').update({ activo }).eq('id', user_id);
      if (error) return json({ error: error.message }, 400);
      // Bloquear/desbloquear el acceso en Auth.
      await admin.auth.admin.updateUserById(user_id, { ban_duration: activo ? 'none' : '876000h' });
      return json({ ok: true });
    }

    if (action === 'eliminar') {
      const { user_id } = body;
      if (!user_id) return json({ error: 'Datos incompletos.' }, 400);
      if (user_id === userData.user.id) return json({ error: 'No podés eliminar tu propia cuenta.' }, 400);
      // Borra la cuenta de Auth; el perfil en `usuarios` y sus referencias
      // se eliminan/anulan por las claves foráneas (on delete cascade/set null).
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ── Portal de empresas (cuentas externas de solo lectura) ──
    if (action === 'crear_acceso_empresa') {
      const { empresa_id, email, password } = body;
      if (!empresa_id || !email || !password) return json({ error: 'Datos incompletos.' }, 400);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (cErr || !created.user) return json({ error: cErr?.message ?? 'No se pudo crear el acceso.' }, 400);

      // OJO: NO se inserta en `usuarios` (no es personal interno).
      const { error: aErr } = await admin.from('empresa_accesos')
        .insert({ empresa_id, user_id: created.user.id, email, activo: true });
      if (aErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: aErr.message }, 400);
      }
      return json({ ok: true, user_id: created.user.id });
    }

    if (action === 'revocar_acceso_empresa') {
      const { user_id } = body;
      if (!user_id) return json({ error: 'Datos incompletos.' }, 400);
      await admin.from('empresa_accesos').update({ activo: false }).eq('user_id', user_id);
      await admin.auth.admin.updateUserById(user_id, { ban_duration: '876000h' });
      return json({ ok: true });
    }

    return json({ error: 'Acción desconocida.' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
