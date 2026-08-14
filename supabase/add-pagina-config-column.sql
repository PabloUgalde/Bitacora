-- ============================================================
-- Configuración de "vuelos por página" de la bitácora física
-- ============================================================
-- Las bitácoras DGAC actuales traen 8 vuelos por página, pero
-- formatos antiguos (o de otras imprentas) traen más o menos.
-- Un mismo piloto puede haber usado más de un formato a lo largo
-- de su carrera (bitácora vieja con N vuelos/página, luego compra
-- una nueva con 8). pagina_config guarda esa historia como una
-- lista de "breakpoints" ordenados por página de inicio:
--
--   [{"desde":1,"vuelosPorPagina":6},{"desde":121,"vuelosPorPagina":8}]
--
-- significa: páginas 1-120 tenían 6 vuelos por página, desde la
-- página 121 en adelante tiene 8. El primer elemento siempre
-- empieza en la página 1. Si el array viene vacío se asume 8
-- (comportamiento histórico de la app, sin cambios para nadie
-- que no toque esta configuración nueva).
--
-- A diferencia de flow_customer_id y columnas similares, esta SÍ
-- la escribe el propio usuario desde Configuración (api.saveProfile),
-- por lo que necesita GRANT explícito para el rol `authenticated`
-- — ver supabase/protect-plan-columns.sql, que ya revocó insert/update
-- general sobre profiles y solo otorga columnas explícitas.

alter table public.profiles
  add column if not exists pagina_config jsonb not null default '[]'::jsonb;

comment on column public.profiles.pagina_config is
  'Historial de vuelos-por-página de la bitácora física del piloto: [{"desde":1,"vuelosPorPagina":8}, ...] ordenado por página de inicio. Vacío = default 8.';

grant insert (pagina_config) on table public.profiles to authenticated;
grant update (pagina_config) on table public.profiles to authenticated;

-- Recargar el esquema de PostgREST para que el cambio aplique al instante
notify pgrst, 'reload schema';
