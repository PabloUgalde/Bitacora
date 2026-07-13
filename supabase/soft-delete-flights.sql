-- ============================================================
-- Papelera (soft-delete) para la tabla flights
-- ============================================================
-- Ejecutar UNA VEZ en el SQL Editor de Supabase, idealmente ANTES de
-- desplegar el frontend que la usa. El frontend tiene fallback: si la
-- columna no existe, vuelve al DELETE físico y carga sin filtro, así
-- que el orden de deploy no rompe nada.
--
-- Comportamiento resultante:
--  - deleteFlight / deleteAllFlights marcan deleted_at en vez de borrar
--  - loadInitialFlights excluye filas con deleted_at
--  - La papelera (Configuración → Zona de peligro) permite restaurar
--  - Purga automática client-side a los 30 días de eliminado
--  - "Eliminar cuenta" sigue siendo DELETE físico (privacidad)

alter table public.flights
  add column if not exists deleted_at timestamptz default null;

-- Acelera el filtro habitual (user_id + deleted_at is null) y la papelera
create index if not exists flights_user_deleted_idx
  on public.flights (user_id, deleted_at);

-- Las políticas RLS existentes por user_id cubren también esta columna
-- (marcar/restaurar es un UPDATE normal; la purga es un DELETE normal).
-- No se requieren políticas nuevas.
