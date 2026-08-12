// Manda el recordatorio diario ("para mañana") por notificación push.
// Vercel Cron llama a esto una vez por día (ver vercel.json) y agrega
// automáticamente el header Authorization: Bearer <CRON_SECRET> —
// por eso NO hace falta pg_cron/SQL en Supabase para esto.
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

/* mañana en hora de Argentina (UTC-3) */
function tomorrowAR() {
  const d = new Date(Date.now() - 3 * 3600 * 1000 + 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

module.exports = async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return res.status(500).json({ error: 'Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'Faltan las credenciales de Supabase' });

  webpush.setVapidDetails('mailto:soporte@studyhub.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const manana = tomorrowAR();

    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth_key');
    if (subsErr) throw subsErr;

    const byUser = {};
    for (const s of subs || []) (byUser[s.user_id] = byUser[s.user_id] || []).push(s);

    /* modo prueba: ?test=1 — manda un push de prueba a todos los suscriptos,
       sin importar si tienen algo para mañana (para poder probar al toque) */
    const isTest = req.query?.test === '1' || req.query?.test === 'true';

    let enviados = 0, fallidos = 0;

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
            /* suscripción vencida/inválida → la limpiamos */
            if (err.statusCode === 404 || err.statusCode === 410) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            }
          }
        }
      } catch (e) {
        console.error('reminder error for', userId, e.message);
      }
    }

    res.json({ ok: true, enviados, fallidos, usuarios: Object.keys(byUser).length });
  } catch (e) {
    console.error('send-reminders error:', e);
    res.status(500).json({ error: e.message });
  }
};
