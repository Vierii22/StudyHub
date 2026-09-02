/* ============================================================
   BANCO DE PRUEBAS DE LA IA — manda frases reales a /api/chat
   (producción) y verifica qué acciones devuelve.
   Uso: npm run test-ia             (todos)
        npm run test-ia -- gym      (solo los que matcheen)
   NO es parte de la app.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { buildSystemPrompt } from '../src/app/aiPrompt.js';

function loadEnv(p) {
  const o = {};
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^["']|["']$/g, '').trim();
  }
  return o;
}
const pub = loadEnv('.env'), adm = loadEnv('.env.admin.local');

/* parseActions replicado (el original importa React/store) */
function parseActions(reply) {
  const raw = String(reply || '');
  const idx = raw.indexOf('@@ACTIONS@@');
  if (idx === -1) return { text: raw.trim(), actions: [] };
  const text = raw.slice(0, idx).trim();
  const j = raw.slice(idx + 11).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let actions = [];
  try {
    const p = JSON.parse(j);
    actions = Array.isArray(p) ? p : (p && typeof p === 'object' ? [p] : []);
  } catch { /* no parsea = no ejecutamos */ }
  return { text: text || 'Listo.', actions: actions.filter(a => a && a.type) };
}

/* ── datos de prueba realistas ── */
const hoy = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const mas = (n) => { const d = new Date(hoy); d.setDate(d.getDate() + n); return iso(d); };
const DATA = {
  profile: { name: 'Vierii', career: 'Lic. en Nutrición', uni: 'UNLP', year: '3' },
  subjects: [
    { id: 's1', name: 'Bromatología' },
    { id: 's2', name: 'Nutrición Pública' },
    { id: 's3', name: 'Psicología de la Alimentación' },
  ],
  tasks: [
    { id: 't1', t: 'Resumen unidad 2', prio: 'alta', due: mas(2), done: false },
    { id: 't2', t: 'Leer paper de Filardi', prio: 'baja', done: false },
  ],
  events: [{ id: 'e1', title: 'Primer parcial Bromatología', date: mas(9) }],
};

const tipos = (a, t) => a.filter(x => x.type === t);
const hay = (a, t) => tipos(a, t).length > 0;

/* ── casos: [frase, modo, check, qué se espera] ── */
const T = [
  /* --- las que pediste vos --- */
  ['Mañana quiero hacer 3 cosas: terminar el resumen, mandar el TP y estudiar bromato', 'quick',
    a => tipos(a, 'add_task').length === 3 && tipos(a, 'add_task').every(x => x.due === mas(1)),
    '3 tareas, todas con fecha de mañana'],
  ['Agregá que de acá hasta noviembre todos los martes voy al gym 2 horas a la mañana', 'quick',
    a => a.length === 1 && a[0].type === 'add_recurring_event' && JSON.stringify(a[0].dows) === '[2]' && /-11-/.test(a[0].until || ''),
    '1 evento recurrente, martes (dow 2), hasta noviembre'],
  ['Hoy hice el trabajo práctico de titulación en la clase de Bromatología', 'quick',
    a => hay(a, 'note_subject') && /bromato/i.test(tipos(a, 'note_subject')[0]?.subject || ''),
    'anota en la materia Bromatología'],

  /* --- fecha puntual vs recurrente (el error clásico) --- */
  ['El jueves tengo clase de Nutrición Pública', 'quick',
    a => a.length === 1 && a[0].type === 'add_event',
    'UNA fecha puntual, NO recurrente'],
  ['Todos los lunes y miércoles tengo Psicología a las 18', 'quick',
    a => a.length === 1 && a[0].type === 'add_recurring_event' && (a[0].dows || []).length === 2,
    'recurrente con 2 días'],

  /* --- sin fecha: NO debe inventar --- */
  ['Tengo que repasar la unidad 3', 'quick',
    a => a.length === 1 && a[0].type === 'add_task' && !a[0].due,
    'tarea SIN fecha inventada'],
  ['Anotá que tengo que comprar el apunte', 'quick',
    a => a.length === 1 && a[0].type === 'add_task' && !a[0].due,
    'tarea sin fecha'],

  /* --- fechas relativas --- */
  ['Parcial de Nutrición Pública el 24', 'quick',
    a => hay(a, 'add_event') && /-24$/.test(tipos(a, 'add_event')[0]?.date || ''),
    'evento el día 24'],
  ['TP para el viernes', 'quick',
    a => hay(a, 'add_task') && !!tipos(a, 'add_task')[0]?.due,
    'tarea con fecha del viernes'],
  ['Pasado mañana entrego el informe', 'quick',
    a => hay(a, 'add_task') && tipos(a, 'add_task')[0]?.due === mas(2),
    'fecha = pasado mañana'],

  /* --- completar / borrar --- */
  ['Ya terminé el resumen unidad 2', 'quick',
    a => hay(a, 'complete_task'), 'completa la tarea'],
  ['Borrá la tarea de leer el paper', 'quick',
    a => hay(a, 'delete_task'), 'borra la tarea'],

  /* --- no debe hacer NADA --- */
  ['¿Qué me conviene estudiar primero?', 'chat',
    a => a.length === 0, 'solo consejo, SIN acciones'],
  ['Explicame qué es el índice glucémico', 'chat',
    a => a.length === 0, 'rechaza explicar temas, sin acciones'],
  ['¿Cómo agrego una materia en la app?', 'chat',
    a => a.length === 0, 'explica la app, sin acciones'],

  /* --- combinados / difíciles --- */
  ['Mañana parcial de bromato y el viernes entrego el TP de nutrición pública', 'quick',
    a => a.length >= 2, '2 cosas distintas'],
  ['Todos los martes gym de 8 a 10 y los jueves natación a las 19', 'quick',
    a => tipos(a, 'add_recurring_event').length === 2, '2 series recurrentes distintas'],
];

const filtro = process.argv[2];
const casos = filtro ? T.filter(c => c[0].toLowerCase().includes(filtro.toLowerCase())) : T;

const admin = createClient(adm.SUPABASE_URL, adm.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = `zz-ia-${Date.now()}@studyhub.com.ar`, password = 'TestIA-9182!';
const { data: c } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
const sb = createClient(pub.VITE_SUPABASE_URL, pub.VITE_SUPABASE_KEY, { auth: { persistSession: false } });
const { data: s } = await sb.auth.signInWithPassword({ email, password });
const tok = s.session.access_token;

console.log(`\nHoy: ${iso(hoy)} · ${casos.length} casos\n${'='.repeat(72)}`);
let ok = 0;
const fail = [];

for (const [frase, modo, check, esperado] of casos) {
  const sys = buildSystemPrompt(DATA, modo);
  let txt = '', acts = [], errHttp = null;
  /* Gemini free tier = 5 pedidos/min. Reintentamos si nos frena. */
  for (let intento = 0; intento < 4; intento++) {
    try {
      const r = await fetch('https://studyhub.com.ar/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://studyhub.com.ar', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ systemPrompt: sys, messages: [{ role: 'user', content: frase }] }),
      });
      const j = await r.json();
      if (r.ok) { ({ text: txt, actions: acts } = parseActions(j.text || '')); errHttp = null; break; }
      errHttp = `HTTP ${r.status} ${JSON.stringify(j).slice(0, 80)}`;
      if (r.status === 429 || r.status === 502) { await new Promise(res => setTimeout(res, 20000)); continue; }
      break;
    } catch (e) { errHttp = e.message; await new Promise(res => setTimeout(res, 5000)); }
  }
  if (errHttp) { console.log(`\n[${errHttp}] ${frase}`); fail.push(frase); continue; }
  let pass = false;
  try { pass = !!check(acts); } catch { pass = false; }
  if (pass) ok++; else fail.push(frase);
  console.log(`\n${pass ? 'OK  ' : 'FALLA'} "${frase}"`);
  console.log(`   espera: ${esperado}`);
  console.log(`   dijo:   ${txt.replace(/\n/g, ' ').slice(0, 95)}`);
  console.log(`   acciones (${acts.length}): ${JSON.stringify(acts).slice(0, 320)}`);
  await new Promise(res => setTimeout(res, 13000)); /* free tier: 5 pedidos/min */
}

console.log(`\n${'='.repeat(72)}\nRESULTADO: ${ok}/${casos.length} OK`);
if (fail.length) console.log('Fallaron:\n' + fail.map(f => '  - ' + f).join('\n'));

await admin.from('ai_usage').delete().eq('user_id', c.user.id);
await admin.auth.admin.deleteUser(c.user.id);
