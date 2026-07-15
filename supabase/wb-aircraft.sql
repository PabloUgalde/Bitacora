-- wb_aircraft — aeronaves de Peso y Balance (módulo En Vuelo)
-- user_id NULL  → catálogo global (solo service role / dashboard escriben)
-- user_id = uid → aeronave creada por el usuario
-- data: objeto JSON con el formato de AERONAVES_DB (stations, limits,
--       envelopeMode 'moment'|'cg', etc.). data->>'id' es el id lógico
--       que usa el cliente (ej: 'c172m_kua', 'u_...').

create table if not exists public.wb_aircraft (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wb_aircraft_user_idx on public.wb_aircraft (user_id);
-- id lógico único por dueño (los NULL global no chocan entre sí en Postgres,
-- por eso el índice parcial aparte para el catálogo)
create unique index if not exists wb_aircraft_user_dataid_idx
  on public.wb_aircraft (user_id, (data->>'id')) where user_id is not null;
create unique index if not exists wb_aircraft_global_dataid_idx
  on public.wb_aircraft ((data->>'id')) where user_id is null;

alter table public.wb_aircraft enable row level security;

-- Lectura: catálogo global + las propias
drop policy if exists wb_aircraft_select on public.wb_aircraft;
create policy wb_aircraft_select on public.wb_aircraft
  for select to authenticated
  using (user_id is null or user_id = auth.uid());

-- Escritura: solo las propias (el catálogo global se administra con service role)
drop policy if exists wb_aircraft_insert on public.wb_aircraft;
create policy wb_aircraft_insert on public.wb_aircraft
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists wb_aircraft_update on public.wb_aircraft;
create policy wb_aircraft_update on public.wb_aircraft
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists wb_aircraft_delete on public.wb_aircraft;
create policy wb_aircraft_delete on public.wb_aircraft
  for delete to authenticated
  using (user_id = auth.uid());

-- ── Aeronaves públicas (14-jul-2026) ─────────────────────────────────
-- El dueño puede compartir su aeronave con la comunidad: pasa a ser
-- legible por cualquier usuario autenticado (solo lectura; editar/borrar
-- sigue restringido al dueño).
alter table public.wb_aircraft add column if not exists is_public boolean not null default false;

drop policy if exists wb_aircraft_select on public.wb_aircraft;
create policy wb_aircraft_select on public.wb_aircraft
  for select to authenticated
  using (user_id is null or user_id = auth.uid() or is_public = true);

create index if not exists wb_aircraft_public_idx on public.wb_aircraft (is_public) where is_public = true;

-- ── Anti-duplicados de matrícula (14-jul-2026) ───────────────────────
-- Dos aeronaves públicas/catálogo no pueden compartir matrícula (case-
-- insensitive). Choque real (carrera entre dos usuarios) → 23505 en el
-- cliente, que dirige a soporte en vez de fallar en silencio.
create unique index if not exists wb_aircraft_public_reg_idx
  on public.wb_aircraft (lower(data->>'registration'))
  where (is_public = true or user_id is null) and coalesce(data->>'registration','') <> '';
