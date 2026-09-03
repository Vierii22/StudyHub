import { uid } from './store.jsx';
import { supabase } from '../supabase.js';

/* ============================================================
   Subida a Supabase Storage (bucket privado "materiales").
   Compartido por los archivos de materia (facultad.jsx) y las
   notas de voz (inbox.jsx) — mismo bucket, misma política de
   "una carpeta por usuario" ya configurada en Supabase.
   ============================================================ */
export const FILES_BUCKET = "materiales";
export const FILE_MAX_MB = 100;

export async function uploadToStorage(file, sub = "") {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("no-session");
  const safe = (file.name || "archivo").replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/${sub ? sub + "/" : ""}${uid()}-${safe}`;
  const { error } = await supabase.storage.from(FILES_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  /* Guardamos SOLO la ruta, nunca una URL pública permanente — el link
     se firma en el momento de abrirlo y vence en minutos. */
  return { path };
}

/* Link temporal (1 hora) para abrir un archivo del bucket privado. */
export async function signedUrlFor(path) {
  const { data, error } = await supabase.storage.from(FILES_BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeFromStorage(path) {
  await supabase.storage.from(FILES_BUCKET).remove([path]).catch(() => {});
}
