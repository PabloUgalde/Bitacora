-- ============================================================
-- Protección de columnas de plan en profiles
-- ============================================================
-- EJECUTADO EN PRODUCCIÓN el 13-jul-2026 (via Management API).
-- Se conserva aquí como documentación / para re-aplicar si se
-- recrea la base.
--
-- Problema: la política RLS de profiles permite UPDATE de la fila
-- propia sin restricción de columnas → un usuario podía auto-
-- otorgarse Pro escribiendo plan/plan_expires_at con su JWT.
--
-- Solución: privilegios a nivel de columna. El rol authenticated
-- (clientes con JWT) solo puede INSERT/UPDATE las columnas que
-- api.saveProfile() escribe. plan, plan_expires_at y trial_used
-- quedan escribibles solo por service_role (Edge Functions
-- create-checkout / flow-webhook) y por postgres (dashboard,
-- modificaciones manuales del administrador).
--
-- Notas:
--  - SELECT no se toca: el cliente necesita leer plan/trial_used.
--  - DELETE no se toca: "eliminar cuenta" borra la fila propia.
--  - ep_avwx_key / ep_gemini_key quedan sin grant (sin uso actual);
--    si alguna app las necesita, agregar a las listas de abajo.

revoke insert, update on table public.profiles from anon, authenticated;

grant insert (id, full_name, rut, fecha_nacimiento, carnet, telefono, email,
              domicilio, licencias, dashboard_cards, dashboard_card_count,
              user_role, hours_format, updated_at, pais)
  on table public.profiles to authenticated;

grant update (id, full_name, rut, fecha_nacimiento, carnet, telefono, email,
              domicilio, licencias, dashboard_cards, dashboard_card_count,
              user_role, hours_format, updated_at, pais)
  on table public.profiles to authenticated;

-- Recargar el esquema de PostgREST para que los cambios apliquen al instante
notify pgrst, 'reload schema';
