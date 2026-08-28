-- ============================================================
-- Feedback (bugs / sugerencias / ideas) del FeedbackWidget — tabla + RLS
-- Correr UNA VEZ en Supabase → SQL Editor.
-- Sin esto el widget falla silenciosamente (el usuario ve un error
-- toast "Error al enviar", pero nunca queda guardado en ningún lado).
-- ============================================================

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('bug', 'sugerencia', 'idea')),
  message text not null,
  contact text,
  section text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table feedback enable row level security;

-- cualquier usuario logueado puede MANDAR feedback (propio o anónimo),
-- pero nadie puede LEER lo que mandaron otros (ni lo propio) — eso
-- solo se lee con la service_role key desde scripts/feedback.mjs.
create policy "cualquiera logueado puede mandar feedback"
  on feedback for insert
  to authenticated
  with check (user_id is null or user_id = auth.uid());
