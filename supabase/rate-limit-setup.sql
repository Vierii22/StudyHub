-- ============================================================
-- Rate limit de la IA, compartido entre todas las instancias del
-- servidor. Antes el conteo vivía en memoria de cada instancia
-- serverless, así que abriendo muchas conexiones se podía esquivar.
-- Correr UNA VEZ en Supabase → SQL Editor.
-- ============================================================

create table if not exists ai_usage (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_time on ai_usage (user_id, created_at desc);

-- Nadie la lee ni la escribe desde el navegador: solo el backend con
-- service_role. Con RLS activo y sin políticas, queda cerrada a todos.
alter table ai_usage enable row level security;

-- Cuenta + registra en una sola operación atómica (evita que dos pedidos
-- simultáneos pasen los dos el chequeo).
create or replace function check_ai_rate_limit(
  p_user_id uuid,
  p_max int,
  p_window_minutes int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  usados int;
begin
  delete from ai_usage
   where created_at < now() - interval '1 day';

  select count(*) into usados
    from ai_usage
   where user_id = p_user_id
     and created_at > now() - (p_window_minutes || ' minutes')::interval;

  if usados >= p_max then
    return false;
  end if;

  insert into ai_usage (user_id) values (p_user_id);
  return true;
end;
$$;

revoke all on function check_ai_rate_limit(uuid, int, int) from public, anon, authenticated;
