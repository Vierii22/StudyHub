-- STUDYHUB SUPABASE SCHEMA

-- 1. PROFILES
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  career text,
  year_of_study int,
  xp int DEFAULT 0,
  level int DEFAULT 1,
  config jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. SUBJECTS
CREATE TABLE subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  code text,
  name text,
  color text,
  progress int DEFAULT 0,
  status text DEFAULT 'en_curso',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. TASKS
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  completed boolean DEFAULT false,
  due_date date,
  subject_id uuid,
  priority text DEFAULT 'normal',
  tags text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. MISSIONS
CREATE TABLE missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  description text,
  xp_reward int DEFAULT 0,
  completed boolean DEFAULT false,
  due_date date,
  category text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. CALENDAR_EVENTS
CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  date date,
  time text,
  type text,
  subject_id uuid,
  description text,
  is_partial boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. DIARY_ENTRIES
CREATE TABLE diary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date,
  content text,
  mood text,
  energy int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. ENERGY_LOG
CREATE TABLE energy_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date,
  level int,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 8. KITCHEN
CREATE TABLE kitchen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text,
  items jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 9. FINANCES
CREATE TABLE finances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 10. CASA
CREATE TABLE casa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 11. OCIO
CREATE TABLE ocio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ROW LEVEL SECURITY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen ENABLE ROW LEVEL SECURITY;
ALTER TABLE finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE casa ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_data" ON profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_data" ON subjects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_data" ON tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_data" ON missions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_data" ON calendar_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_data" ON diary_entries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_data" ON energy_log FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_data" ON kitchen FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_data" ON finances FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_data" ON casa FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_data" ON ocio FOR ALL USING (auth.uid() = user_id);

-- 12. APP_DATA (generic key-value store for SupabaseStorage)
CREATE TABLE app_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, key)
);
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_data" ON app_data FOR ALL USING (auth.uid() = user_id);

-- 13. TELEGRAM_LINKS (vinculación de cuentas Telegram ↔ usuario)
CREATE TABLE IF NOT EXISTS telegram_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  link_code text NOT NULL,
  linked boolean DEFAULT false,
  telegram_chat_id text,
  auto_save boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- Agregar columnas si ya existía la tabla sin ellas
ALTER TABLE telegram_links ADD COLUMN IF NOT EXISTS telegram_chat_id text;
ALTER TABLE telegram_links ADD COLUMN IF NOT EXISTS auto_save boolean DEFAULT false;
ALTER TABLE telegram_links ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE telegram_links ENABLE ROW LEVEL SECURITY;
-- El bot usa service_role (bypassa RLS). El frontend solo lee su propio vínculo.
CREATE POLICY IF NOT EXISTS "user_own_telegram" ON telegram_links FOR ALL USING (auth.uid() = user_id);

-- 15. FEEDBACK (bugs, ideas y sugerencias enviadas desde la app)
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('bug','sugerencia','idea')),
  message text NOT NULL,
  contact text,
  section text,
  created_at timestamptz DEFAULT now()
);
-- Solo el dueño puede insertar; solo vos (service_role) podés leer todo
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "insert_own_feedback" ON feedback FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "select_own_feedback" ON feedback FOR SELECT USING (auth.uid() = user_id);

-- 14. TELEGRAM_STATE (estado de conversación multi-turno del bot)
CREATE TABLE IF NOT EXISTS telegram_state (
  chat_id text PRIMARY KEY,
  state jsonb,
  updated_at timestamptz DEFAULT now()
);
-- Sin RLS — accedida solo por el bot con service_role_key
