// ============================================================
// Recordatorios automáticos de StudyHub — Edge Function (Deno)
// Se llama UNA VEZ POR DÍA (con un cron). Le manda a cada usuario
// vinculado un aviso con lo que tiene MAÑANA (eventos + tareas).
//
// Deploy:  supabase functions deploy telegram-reminders --no-verify-jwt
// Secrets: usa TELEGRAM_BOT_TOKEN (el mismo del bot) + los SUPABASE_* auto.
// Cron:    ver telegram-reminders-cron.sql (una vez, en el SQL Editor).
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TG_API = `https://api.telegram.org/bot${TG_TOKEN}`;
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

/* mañana en hora de Argentina (UTC-3) */
const tomorrowAR = () => new Date(Date.now() - 3 * 3600 * 1000 + 24 * 3600 * 1000).toISOString().slice(0, 10);

async function sendMsg(chatId: string, text: string) {
  await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
}
async function getDomain(userId: string, key: string) {
  const { data } = await supabase.from("app_data").select("value").eq("user_id", userId).eq("key", key).maybeSingle();
  return (data?.value as any) || {};
}

serve(async () => {
  const manana = tomorrowAR();
  const { data: links } = await supabase
    .from("telegram_links")
    .select("user_id, telegram_chat_id")
    .eq("linked", true);

  let enviados = 0;
  for (const l of (links || [])) {
    if (!l.telegram_chat_id) continue;
    try {
      const cal = await getDomain(l.user_id, "sh_calendar");
      const tasksDom = await getDomain(l.user_id, "sh_tasks");
      const evs = ((cal.events || []) as any[]).filter((e) => e.date === manana);
      const tareas = ((tasksDom.tasks || []) as any[]).filter((t) => !t.done && t.dueDate === manana);
      if (!evs.length && !tareas.length) continue;

      let msg = "🔔 <b>Para mañana:</b>\n";
      for (const e of evs) msg += `📅 ${e.title}${e.important ? " ⭐" : ""}\n`;
      for (const t of tareas) msg += `✅ ${t.t}\n`;
      msg += "\n¡A darle! 💪";
      await sendMsg(String(l.telegram_chat_id), msg);
      enviados++;
    } catch (e) {
      console.error("reminder error for", l.user_id, e);
    }
  }
  return new Response(JSON.stringify({ ok: true, enviados }), { headers: { "Content-Type": "application/json" } });
});
