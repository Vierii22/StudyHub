/* ============================================================
   ADMIN — mensajes de feedback (bugs/sugerencias/ideas) del
   FeedbackWidget. NO forma parte de la app.

   Uso:  npm run feedback
   Requiere .env.admin.local (ver scripts/usuarios.mjs).
   ============================================================ */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(path) {
  const out = {};
  let raw;
  try { raw = readFileSync(path, 'utf8'); }
  catch { console.error(`\n❌ Falta el archivo ${path}\n`); process.exit(1); }
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
  console.error('\n❌ Falta completar .env.admin.local (ver scripts/usuarios.mjs)\n');
  process.exit(1);
}

const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const TYPE_LABEL = { bug: '🐛 BUG', sugerencia: '💡 SUGERENCIA', idea: '✨ IDEA' };
const fmt = (d) => new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

const { data: rows, error } = await sb.from('feedback').select('*').order('created_at', { ascending: false });
if (error) {
  console.error('\n❌ Error al leer la tabla "feedback":', error.message);
  if (error.code === '42P01') console.error('   (la tabla no existe todavía — nadie mandó feedback aún, o falta crearla)');
  console.error('');
  process.exit(1);
}

if (!rows.length) { console.log('\n  Sin mensajes de feedback todavía.\n'); process.exit(0); }

/* traer los mails de quien mandó cada uno (si estaba logueado) */
const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
const emailOf = {};
if (ids.length) {
  const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 });
  for (const u of users) emailOf[u.id] = u.email;
}

const counts = rows.reduce((a, r) => { a[r.type] = (a[r.type] || 0) + 1; return a; }, {});
console.log('');
console.log('  STUDYHUB · FEEDBACK');
console.log('  ' + '─'.repeat(74));
console.log(`  Total: ${rows.length}   ·   🐛 ${counts.bug || 0}   ·   💡 ${counts.sugerencia || 0}   ·   ✨ ${counts.idea || 0}`);
console.log('  ' + '─'.repeat(74));
console.log('');

for (const r of rows) {
  const quien = emailOf[r.user_id] || r.contact || '(anónimo)';
  console.log(`  ${(TYPE_LABEL[r.type] || r.type).padEnd(14)} ${fmt(r.created_at)}   ${quien}${r.section ? `   [${r.section}]` : ''}`);
  console.log(`    "${r.message}"`);
  console.log('');
}
