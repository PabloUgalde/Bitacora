-- live_log_sessions — respaldo temporal en la nube del vuelo activo de
-- Live Log (mismo esquema que localStorage._liveLog: startTs, endTs,
-- pausedMs, tipoAvion, condicion, aterrizajesDia/Noche, manualDuration, etc.)
--
-- Antes de esta tabla, el estado del vuelo activo vivía SOLO en
-- localStorage — si la app se cerraba por un error, se perdía el
-- localStorage del dispositivo (ej. iOS mata el proceso en segundo plano y
-- al reabrir por el ícono de inicio a veces cae en otra partición de
-- storage), o el usuario cambiaba de dispositivo a mitad de vuelo, no había
-- forma de recuperar el vuelo en curso — se perdía la hora de despegue y
-- todo el resto sin dejar rastro.
--
-- Una fila por usuario (upsert en cada _saveState), se borra al aterrizar y
-- guardar (o cancelar) el vuelo. No es la fuente de verdad del vuelo
-- guardado — flights sigue siéndolo — esto es solo un respaldo para
-- recuperar un vuelo que quedó a medias.

create table if not exists public.live_log_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.live_log_sessions enable row level security;

drop policy if exists live_log_sessions_select on public.live_log_sessions;
create policy live_log_sessions_select on public.live_log_sessions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists live_log_sessions_insert on public.live_log_sessions;
create policy live_log_sessions_insert on public.live_log_sessions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists live_log_sessions_update on public.live_log_sessions;
create policy live_log_sessions_update on public.live_log_sessions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists live_log_sessions_delete on public.live_log_sessions;
create policy live_log_sessions_delete on public.live_log_sessions
  for delete to authenticated
  using (user_id = auth.uid());
