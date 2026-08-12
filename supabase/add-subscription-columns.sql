-- ============================================================
-- Columnas de cargo automático (Flow Subscriptions)
-- ============================================================
-- Soportan el cobro recurrente vía Flow (customer/register +
-- subscription/create), en paralelo al pago único existente
-- (create-checkout / flow-webhook, que no se modifica).
--
-- flow_customer_id         customerId de Flow (customer/create) —
--                           se crea una sola vez por usuario y se
--                           reutiliza si vuelve a activar cargo
--                           automático tras cancelar.
-- flow_subscription_id     subscriptionId de Flow activo; null si
--                           el usuario nunca activó cargo automático.
-- flow_subscription_status inactive|active|trial|past_due|cancelled
--                           — espejo del status real en Flow.
-- flow_card_last4          Últimos 4 dígitos de la tarjeta registrada,
--                           solo para mostrar en la UI (no es dato
--                           sensible de pago, Flow nunca nos entrega
--                           el número completo).
--
-- IMPORTANTE: estas columnas NO se agregan a los GRANT de
-- protect-plan-columns.sql. Esa migración ya revocó insert/update
-- general sobre profiles y solo otorga columnas explícitas a
-- `authenticated`; como los grants son un whitelist aditivo, las
-- columnas nuevas quedan automáticamente escribibles solo por
-- service_role/postgres sin tocar ese archivo — igual que
-- plan/plan_expires_at/trial_used. Solo las Edge Functions
-- (flow-subscription-start/-return/-webhook/-cancel) las escriben.
-- SELECT no está restringido por columna, así que el dueño de la
-- fila las puede leer (necesario para mostrar el estado en la UI).

alter table public.profiles
  add column if not exists flow_customer_id text,
  add column if not exists flow_subscription_id text,
  add column if not exists flow_subscription_status text,
  add column if not exists flow_card_last4 text;

comment on column public.profiles.flow_customer_id is 'customerId de Flow (customer/create), para reutilizar tarjeta registrada';
comment on column public.profiles.flow_subscription_id is 'subscriptionId de Flow activo; null si nunca activó cargo automático';
comment on column public.profiles.flow_subscription_status is 'inactive|active|trial|past_due|cancelled — espejo del status de Flow';
comment on column public.profiles.flow_card_last4 is 'Últimos 4 dígitos de la tarjeta registrada, solo display, no es PCI-sensible';

-- Recargar el esquema de PostgREST para que las columnas queden disponibles al instante
notify pgrst, 'reload schema';
