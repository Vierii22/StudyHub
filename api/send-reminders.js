// Manda el recordatorio diario ("para mañana") por notificación push.
// Vercel Cron llama a esto una vez por día (ver vercel.json) y agrega
// automáticamente el header Authorization: Bearer <CRON_SECRET> —
// por eso NO hace falta pg_cron/SQL en Supabase para esto.
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

/* mañana en hora de Argentina (UTC-3) */
function tomorrowAR() {
  const d = new Date(Date.now() - 3 * 3600 * 1000 + 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
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

    stage = 'fetch-subscriptions';
    const manana = tomorrowAR();
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
          const events = ((cal?.value?.events) || []).filter(e => e.date === manana);
          const tasks  = ((tasksDom?.value?.tasks) || []).filter(t => !t.done && t.dueDate === manana);
          if (!events.length && !tasks.length) continue;

          const lines = [
            ...events.map(e => `📅 ${e.title}${e.important ? ' ⭐' : ''}`),
            ...tasks.map(t => `✅ ${t.t}`),
          ];
          payload = JSON.stringify({ title: '🔔 Para mañana', body: lines.join('\n'), url: '/?section=dashboard' });
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

    res.json({ ok: true, enviados, fallidos, usuarios: Object.keys(byUser).length, detalle });
  } catch (e) {
    console.error('send-reminders error at stage', stage, ':', e);
    res.status(500).json({ stage, error: e.message, name: e.name, code: e.code || e.statusCode || null });
  }
};
