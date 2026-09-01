-- ============================================================
-- ARCHIVOS (bucket "materiales") — cerrar el bucket. IMPORTANTE.
--
-- Cómo estaba (verificado con pruebas reales el 2026-09-01):
--   * bucket PÚBLICO: cualquiera con el link se bajaba el archivo, sin login
--   * cualquier usuario logueado podía SUBIR archivos a la carpeta de otro
--   * sin límite de tamaño ni de tipo de archivo (se podía llenar la cuota)
--
-- Correr UNA VEZ en Supabase → SQL Editor.
-- ============================================================

-- 1) El bucket deja de ser público + límite de 100 MB por archivo.
update storage.buckets
   set public = false,
       file_size_limit = 104857600
 where id = 'materiales';

-- 2) Políticas: cada usuario SOLO toca su propia carpeta.
--    La carpeta es su user id — así lo sube la app: "<user_id>/<archivo>".
drop policy if exists "materiales_select_propio" on storage.objects;
drop policy if exists "materiales_insert_propio" on storage.objects;
drop policy if exists "materiales_update_propio" on storage.objects;
drop policy if exists "materiales_delete_propio" on storage.objects;

-- OJO: además de exigir que la carpeta sea la del usuario, hay que
-- RECHAZAR ".." en el nombre. Sin eso, un atacante sube
-- "<su_uid>/../<uid_ajeno>/archivo" — la primera carpeta es la suya
-- (pasa el chequeo) pero el path aterriza en la carpeta de otro.
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

-- 3) Comprobar que quedó bien.
select id, public, file_size_limit from storage.buckets where id = 'materiales';
