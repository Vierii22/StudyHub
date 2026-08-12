-- ============================================================
-- Notificaciones push — tabla + RLS
-- Correr UNA VEZ en Supabase → SQL Editor.
-- (El envío diario lo dispara Vercel Cron, no hace falta pg_cron acá.)
-- ============================================================

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

-- cada usuario ve/crea/borra SOLO sus propias suscripciones
create policy "usuarios manejan sus propias suscripciones"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
