// Avisos por notificación push. DOS momentos del día (ver vercel.json):
//   ?tipo=manana (8am AR) -> "hoy tenés..." — lo que arranca hoy
//   ?tipo=noche  (21h AR) -> cierre del día + "¿qué hacés mañana?"
// El contenido cambia según la situación de CADA usuario; si no hay nada
// que decir no se manda nada (avisar por avisar hace que te silencien).
// Vercel Cron agrega solo el header Authorization: Bearer <CRON_SECRET>.
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');
const crypto = require('crypto');

/* Compara sin filtrar información por el tiempo que tarda. Con === se
   puede adivinar el secreto carácter por carácter midiendo la demora. */
function secretoValido(recibido, esperado) {
  if (!esperado || !recibido) return false;
  const a = Buffer.from(String(recibido));
  const b = Buffer.from(String(esperado));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* fechas en hora de Argentina (UTC-3) */
function todayAR() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
function tomorrowAR() {
  const d = new Date(Date.now() - 3 * 3600 * 1000 + 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

const NL = String.fromCharCode(10);

/* ── Qué decirle a CADA usuario ──────────────────────────────
   Un mismo aviso que cambia según su situación, en vez de N
   avisos distintos (el plan Hobby de Vercel deja 100 tareas
   programadas, pero cada una dispara UNA vez por día).
   Devuelve null si no hay nada que valga una notificación —
   avisar por avisar es la forma más rápida de que te silencien. */
function armarAviso(tipo, { eventosHoy, tareasHoy, eventosManana, tareasManana, pendientesHoy, inbox }) {
  if (tipo === 'noche') {
    const lineas = [];
    if (pendientesHoy.length === 0 && (tareasHoy.length > 0 || eventosHoy.length > 0)) {
      lineas.push('Terminaste todo lo de hoy. Bien ahí 👏');
    } else if (pendientesHoy.length > 0) {
      lineas.push(`Te quedaron ${pendientesHoy.length} cosa${pendientesHoy.length > 1 ? 's' : ''} de hoy:`);
      lineas.push(...pendientesHoy.slice(0, 3).map(t => `· ${t.t}`));
    }
    if (inbox.length > 0) {
      lineas.push(`Tenés ${inbox.length} nota${inbox.length > 1 ? 's' : ''} sin ordenar.`);
    }
    const manana = [...eventosManana.map(e => e.title), ...tareasManana.map(t => t.t)];
    if (manana.length) lineas.push(`Mañana: ${manana.slice(0, 3).join(' · ')}`);

    if (!lineas.length) return null;
    return { title: '¿Qué hacés mañana?', body: lineas.join(NL), url: '/?section=dashboard' };
  }

  /* mañana temprano: lo de HOY (antes avisaba lo de mañana, que a las
     8am ya no sirve para nada — el día que importa es el que arranca) */
  const lineas = [
    ...eventosHoy.map(e => `📅 ${e.title}${e.important ? ' ⭐' : ''}`),
    ...tareasHoy.map(t => `✅ ${t.t}`),
  ];
  if (!lineas.length) return null;
  return { title: '🔔 Hoy tenés', body: lineas.slice(0, 5).join(NL), url: '/?section=dashboard' };
}

module.exports = async function handler(req, res) {
  let stage = 'auth';
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!secretoValido(token, process.env.CRON_SECRET)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    stage = 'env-check';
    const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return res.status(500).json({ stage, error: 'Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY' });
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ stage, error: 'Faltan las credenciales de Supabase' });

    stage = 'vapid-setup';
    webpush.setVapidDetails('mailto:soporte@studyhub.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    stage = 'supabase-client';
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    /* ?tipo=noche  -> cierre del dia + que haces manana (21hs)
       ?tipo=manana -> lo que tenes HOY (8am, por defecto) */
    const tipo = req.query?.tipo === 'noche' ? 'noche' : 'manana';

    stage = 'fetch-subscriptions';
    const manana = tomorrowAR();
    const hoy = todayAR();
    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth_key');
    if (subsErr) throw subsErr;

    const byUser = {};
    for (const s of subs || []) (byUser[s.user_id] = byUser[s.user_id] || []).push(s);

    /* modo prueba: ?test=1&user=<uuid> — manda un push de prueba SOLO a ese
       usuario. Antes le pegaba a todos los suscriptos: si el CRON_SECRET se
       filtraba, era spam masivo a todo el mundo. */
    const isTest = req.query?.test === '1' || req.query?.test === 'true';
    const testUser = req.query?.user || '';
    if (isTest && !/^[0-9a-f-]{36}$/i.test(testUser)) {
      return res.status(400).json({ error: 'En modo prueba hace falta ?user=<uuid> — no se manda a todos.' });
    }
    if (isTest) {
      for (const uid of Object.keys(byUser)) if (uid !== testUser) delete byUser[uid];
    }

    let enviados = 0, fallidos = 0;
    const detalle = [];

    stage = 'loop-usuarios';
    for (const userId of Object.keys(byUser)) {
      try {
        let payload;
        if (isTest) {
          payload = JSON.stringify({ title: '🔔 StudyHub', body: 'Notificación de prueba — si ves esto, ¡funciona! 🎉', url: '/?section=dashboard' });
        } else {
          const [{ data: cal }, { data: tasksDom }] = await Promise.all([
            supabase.from('app_data').select('value').eq('user_id', userId).eq('key', 'sh_calendar').maybeSingle(),
            supabase.from('app_data').select('value').eq('user_id', userId).eq('key', 'sh_tasks').maybeSingle(),
          ]);
          const todosEventos = (cal?.value?.events) || [];
          const todasTareas  = (tasksDom?.value?.tasks) || [];

          const aviso = armarAviso(tipo, {
            eventosHoy:    todosEventos.filter(e => e.date === hoy),
            tareasHoy:     todasTareas.filter(t => t.dueDate === hoy),
            eventosManana: todosEventos.filter(e => e.date === manana),
            tareasManana:  todasTareas.filter(t => !t.done && t.dueDate === manana),
            pendientesHoy: todasTareas.filter(t => !t.done && t.dueDate === hoy),
            inbox:         (tasksDom?.value?.inbox) || [],
          });
          if (!aviso) continue; /* sin nada que decir, no molestamos */
          payload = JSON.stringify(aviso);
        }

        for (const sub of byUser[userId]) {
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } }, payload);
            enviados++;
          } catch (err) {
            fallidos++;
            detalle.push({ subId: sub.id, error: err.message, code: err.statusCode || err.code || null });
            /* suscripción vencida/inválida → la limpiamos */
            if (err.statusCode === 404 || err.statusCode === 410) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            }
          }
        }
      } catch (e) {
        detalle.push({ userId, error: e.message });
        console.error('reminder error for', userId, e.message);
      }
    }

    res.json({ ok: true, tipo, enviados, fallidos, usuarios: Object.keys(byUser).length, detalle });
  } catch (e) {
    console.error('send-reminders error at stage', stage, ':', e);
    res.status(500).json({ stage, error: e.message, name: e.name, code: e.code || e.statusCode || null });
  }
};
