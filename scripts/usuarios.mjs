/* ============================================================
   ADMIN — quién usa StudyHub (NO forma parte de la app)
   Este script NO se compila ni llega a los usuarios: vive en
   scripts/ y se corre a mano desde la compu.

   Uso:  npm run usuarios
   Requiere .env.admin.local con SUPABASE_URL y
   SUPABASE_SERVICE_ROLE_KEY (ese archivo está ignorado por git).
   ============================================================ */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

/* ── leer .env.admin.local sin dependencias extra ── */
function loadEnv(path) {
  const out = {};
  let raw;
  try { raw = readFileSync(path, 'utf8'); }
  catch {
    console.error(`\n❌ Falta el archivo ${path}\n`);
    process.exit(1);
  }
  for (const line of raw.split('\n')) {
    if (/^\s*#/.test(line)) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

const env = loadEnv('.env.admin.local');
const SB_URL = env.SUPABASE_URL, SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SB_URL || !SB_KEY || SB_URL === '[SENSITIVE]' || SB_KEY === '[SENSITIVE]') {
  console.error('\n❌ Falta completar .env.admin.local\n');
  console.error('   Abrí  studyhub-app/.env.admin.local  y completá estas dos líneas:\n');
  console.error('   SUPABASE_URL=                Supabase → Settings → API → "Project URL"');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=   Supabase → Settings → API → "Secret keys" (sb_secret_...)\n');
  process.exit(1);
}

const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const fmt  = (d) => d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
const hace = (d) => {
  if (!d) return 'nunca';
  const dias = Math.floor((Date.now() - new Date(d)) / 86400000);
  return dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias}d`;
};

const { data: listed, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
if (error) { console.error('❌ Error al leer usuarios:', error.message); process.exit(1); }
const users = listed.users;

/* actividad real: última vez que guardó algo + qué tiene cargado */
const { data: rows }   = await sb.from('app_data').select('user_id, key, value, updated_at');
const { data: pushes } = await sb.from('push_subscriptions').select('user_id');

const act = {};
for (const r of rows || []) {
  const a = act[r.user_id] || (act[r.user_id] = { ultima: null, materias: 0, tareas: 0 });
  if (!a.ultima || r.updated_at > a.ultima) a.ultima = r.updated_at;
  if (r.key === 'sh_subjects') a.materias = (r.value?.subjects || []).length;
  if (r.key === 'sh_tasks')    a.tareas   = (r.value?.tasks || []).length;
}
const pushCount = {};
for (const p of pushes || []) pushCount[p.user_id] = (pushCount[p.user_id] || 0) + 1;

const dias = (d) => d ? (Date.now() - new Date(d)) / 86400000 : Infinity;
/* OJO: last_sign_in_at solo se actualiza cuando alguien se loguea DE CERO.
   Con la sesion guardada (app instalada) se usa la app sin volver a loguearse,
   asi que ese dato subestima el uso. La senal real es cuando guardo algo
   (app_data.updated_at). Usamos esa para medir actividad. */
const ultimoUso = (u) => act[u.id]?.ultima || null;
const act7     = users.filter(u => dias(ultimoUso(u)) <= 7).length;
const act30    = users.filter(u => dias(ultimoUso(u)) <= 30).length;
const conDatos = users.filter(u => (act[u.id]?.materias || 0) > 0).length;
const nunca    = users.filter(u => !ultimoUso(u) && !(act[u.id]?.materias)).length;

console.log('');
console.log('  STUDYHUB · USUARIOS');
console.log('  ' + '─'.repeat(74));
console.log(`  Registrados: ${users.length}   ·   Usaron la app (guardaron algo) — últimos 7 días: ${act7}   ·   últimos 30: ${act30}`);
console.log(`  Con materias cargadas: ${conDatos}${nunca ? `   ·   Nunca usaron nada: ${nunca}` : ''}`);
console.log('  ' + '─'.repeat(74));
console.log('');

const orden = [...users].sort((a, b) => new Date(ultimoUso(b) || 0) - new Date(ultimoUso(a) || 0));
for (const u of orden) {
  const a = act[u.id] || {};
  const avisos = pushCount[u.id] ? `  🔔${pushCount[u.id]}` : '';
  const sinConf = u.email_confirmed_at ? '' : '  ⚠️ mail sin confirmar';
  console.log(
    `  ${(u.email || '(sin mail)').padEnd(32)}` +
    `alta ${fmt(u.created_at)}   ` +
    `entró ${hace(u.last_sign_in_at).padEnd(10)}` +
    `guardó ${hace(a.ultima).padEnd(10)}` +
    `${String(a.materias || 0).padStart(2)} mat · ${String(a.tareas || 0).padStart(3)} tar` +
    avisos + sinConf
  );
}
console.log('');
