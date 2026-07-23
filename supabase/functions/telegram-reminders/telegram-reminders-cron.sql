-- ============================================================
-- Programar los recordatorios diarios de StudyHub
-- Correr UNA VEZ en Supabase → SQL Editor.
-- Manda el aviso todos los días a las 9:00 de Argentina (12:00 UTC).
--
-- Reemplazá:
--   TU_REF               = tu Project Ref (Settings → General)
--   TU_SERVICE_ROLE_KEY  = Settings → API → service_role key (secreta)
-- ============================================================

-- 1) habilitar las extensiones (si no lo están)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) programar la llamada diaria a la función
select cron.schedule(
  'studyhub-recordatorios',
  '0 12 * * *',
  $$
  select net.http_post(
    url     := 'https://TU_REF.supabase.co/functions/v1/telegram-reminders',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer TU_SERVICE_ROLE_KEY"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Para ver los jobs:   select * from cron.job;
-- Para borrarlo:       select cron.unschedule('studyhub-recordatorios');
