-- ============================================================
-- Límites en app_data para que un usuario no pueda llenar la base
-- (y hacerte gastar la cuota de Supabase). Verificado el 2026-09-01:
-- un usuario logueado podía escribir valores de 2 MB y claves sin fin.
--
-- Datos reales al momento: valor más grande 16 KB, 21 claves/usuario.
-- Estos límites dan MUCHO margen (2 MB por valor, 100 claves) — ningún
-- usuario real se acerca.
--
-- Correr en Supabase → SQL Editor.
-- ============================================================

-- 1) Tamaño por fila: clave corta + valor de hasta 2 MB.
alter table app_data drop constraint if exists app_data_size_limit;
alter table app_data add constraint app_data_size_limit
  check (length(key) <= 120 and octet_length(value::text) <= 2097152);

-- 2) Tope de claves por usuario (100). El alta de una clave nueva más allá
--    del tope se rechaza; actualizar las existentes sigue funcionando.
-- Solo cuenta cuando la clave es NUEVA. La app usa upsert (INSERT ... ON
-- CONFLICT UPDATE) y el trigger BEFORE INSERT dispara igual aunque termine
-- actualizando: sin el "not exists", actualizar una clave existente al tope
-- fallaría. Con él, actualizar lo que ya tenés nunca se bloquea.
create or replace function app_data_limit_rows()
returns trigger language plpgsql as $$
begin
  if (select count(*) from app_data where user_id = new.user_id) >= 100
     and not exists (select 1 from app_data where user_id = new.user_id and key = new.key) then
    raise exception 'Límite de claves de app_data alcanzado para este usuario';
  end if;
  return new;
end $$;

drop trigger if exists app_data_row_limit on app_data;
create trigger app_data_row_limit
  before insert on app_data
  for each row execute function app_data_limit_rows();
