-- ============================================================
-- LIMPIEZA — borrar tablas muertas (2026-09-02)
--
-- Verificado con el código y con los datos reales:
--   La app SOLO usa 4 tablas -> app_data, push_subscriptions,
--   feedback y ai_usage. Ninguna otra aparece en src/ ni en api/.
--
-- Lo que se borra y por qué:
--   * subjects, tasks, missions, calendar_events, diary_entries,
--     energy_log, kitchen, finances, casa, ocio
--       -> 0 filas, nunca se usaron. Restos del esquema original,
--          antes de que todo pasara a guardarse en app_data.
--   * profiles (1 fila)
--       -> el "xp/level" de una gamificación que nunca se conectó.
--          La app guarda el perfil en app_data (clave sh_profile).
--   * telegram_links (6 filas), telegram_state (1 fila)
--       -> del bot de Telegram, dado de baja el 2026-08-24.
--
-- OJO: esto BORRA esas tablas y su contenido. Son datos muertos
-- (no los lee nadie), pero es irreversible. Si querés guardarte una
-- copia antes, en Supabase: Table Editor -> la tabla -> Export CSV.
--
-- Correr en Supabase -> SQL Editor.
-- ============================================================

drop table if exists subjects        cascade;
drop table if exists tasks           cascade;
drop table if exists missions        cascade;
drop table if exists calendar_events cascade;
drop table if exists diary_entries   cascade;
drop table if exists energy_log      cascade;
drop table if exists kitchen         cascade;
drop table if exists finances        cascade;
drop table if exists casa            cascade;
drop table if exists ocio            cascade;
drop table if exists profiles        cascade;
drop table if exists telegram_links  cascade;
drop table if exists telegram_state  cascade;

-- Comprobar qué queda (deberían verse solo las 4 vivas).
select table_name
  from information_schema.tables
 where table_schema = 'public'
 order by table_name;
