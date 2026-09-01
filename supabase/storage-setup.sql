-- ============================================================
-- ARCHIVOS (bucket "materiales") — cerrar el bucket. IMPORTANTE.
--
-- Cómo estaba (verificado con pruebas reales el 2026-09-01):
--   * bucket PÚBLICO: cualquiera con el link se bajaba el archivo, sin login
--   * cualquier usuario logueado podía SUBIR a la carpeta de otro
--   * un archivo "<uid>/../<uid_ajeno>/x" esquivaba el chequeo de carpeta
--   * sin límite de tamaño ni tipo (se podía llenar la cuota)
--
-- OJO: había políticas viejas y PERMISIVAS creadas desde el panel de
-- Supabase (con otros nombres) que dejaban subir a cualquier carpeta.
-- Las políticas de RLS se SUMAN (con que una permita, alcanza), así que
-- no basta con agregar las restrictivas: hay que BORRAR las viejas.
-- Este bloque borra TODAS las de storage.objects (solo existe el bucket
-- "materiales") y deja solo las 4 correctas.
--
-- Correr en Supabase → SQL Editor.
-- ============================================================

-- 1) El bucket deja de ser público + límite de 100 MB por archivo.
update storage.buckets
   set public = false,
       file_size_limit = 104857600
 where id = 'materiales';

-- 2) Borrar TODAS las políticas existentes de storage.objects.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end $$;

-- 3) Dejar SOLO estas 4: cada usuario toca únicamente su carpeta (su uid),
--    y se rechaza el traversal con "/.." o "../" en el nombre.
--    (El chequeo es preciso para no bloquear nombres legítimos con puntos
--    dobles tipo "Resumen..final.pdf".)
create policy "materiales_select_propio" on storage.objects
  for select to authenticated
  using (bucket_id = 'materiales' and (storage.foldername(name))[1] = auth.uid()::text and position('/..' in name) = 0 and position('../' in name) = 0);

create policy "materiales_insert_propio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'materiales' and (storage.foldername(name))[1] = auth.uid()::text and position('/..' in name) = 0 and position('../' in name) = 0);

create policy "materiales_update_propio" on storage.objects
  for update to authenticated
  using (bucket_id = 'materiales' and (storage.foldername(name))[1] = auth.uid()::text and position('/..' in name) = 0 and position('../' in name) = 0)
  with check (bucket_id = 'materiales' and (storage.foldername(name))[1] = auth.uid()::text and position('/..' in name) = 0 and position('../' in name) = 0);

create policy "materiales_delete_propio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'materiales' and (storage.foldername(name))[1] = auth.uid()::text and position('/..' in name) = 0 and position('../' in name) = 0);

-- 4) Comprobar.
select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects';
select id, public, file_size_limit from storage.buckets where id = 'materiales';
