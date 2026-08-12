-- wb_fleet — picks simples de "Mi Flota" (Peso y Balance)
-- Guarda SOLO qué aeronave del catálogo/comunidad agregó el usuario a su
-- flota (aircraft_id = AERONAVES_DB[].id o el id de una pública de otro
-- piloto) — no los datos de la aeronave, esos ya viven en AERONAVES_DB o en
-- wb_aircraft.data. Las aeronaves propias (source:'custom', creadas con
-- "+ Crear propia") NO usan esta tabla — sincronizan completas vía
-- wb_aircraft con user_id propio (ver wb-aircraft.sql).
--
-- Antes de esta tabla, _addToFlota/_removeFromFlota solo escribían
-- localStorage._miFlota — el pick quedaba pegado al dispositivo/navegador
-- donde se hizo (ej: no aparecía en una pestaña incógnita con la misma
-- cuenta).

create table if not exists public.wb_fleet (
  user_id uuid not null references auth.users(id) on delete cascade,
  aircraft_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, aircraft_id)
);

alter table public.wb_fleet enable row level security;

drop policy if exists wb_fleet_select on public.wb_fleet;
create policy wb_fleet_select on public.wb_fleet
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists wb_fleet_insert on public.wb_fleet;
create policy wb_fleet_insert on public.wb_fleet
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists wb_fleet_delete on public.wb_fleet;
create policy wb_fleet_delete on public.wb_fleet
  for delete to authenticated
  using (user_id = auth.uid());
