// ============================================================
// Bot de Telegram de StudyHub — Edge Function (Deno / Supabase)
// Reescrito para el esquema actual (app_data por dominios).
//
// Deploy:  supabase functions deploy telegram-bot --no-verify-jwt
// Secrets: TELEGRAM_BOT_TOKEN, GEMINI_API_KEY
//          (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase)
// Webhook: https://api.telegram.org/bot<TOKEN>/setWebhook?url=<FUNCTION_URL>
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")!;
const TG_API = `https://api.telegram.org/bot${TG_TOKEN}`;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const uid = () => Math.random().toString(36).slice(2, 9);
/* "hoy" en hora de Argentina (UTC-3) */
const todayAR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const ddmm = (iso: string) => { const [, m, d] = iso.split("-"); return `${parseInt(d)}/${parseInt(m)}`; };

async function sendMsg(chatId: number | string, text: string) {
  await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

/* ── app_data: leer/escribir un dominio de un usuario ── */
async function getDomain(userId: string, key: string) {
  const { data } = await supabase.from("app_data").select("value").eq("user_id", userId).eq("key", key).maybeSingle();
  return (data?.value as any) || {};
}
async function setDomain(userId: string, key: string, value: unknown) {
  await supabase.from("app_data").upsert(
    { user_id: userId, key, value, updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" },
  );
}

/* ── vinculación por /start CODE ── */
async function linkChat(code: string, chatId: number): Promise<boolean> {
  const { data: row } = await supabase.from("telegram_links").select("id").eq("link_code", code).maybeSingle();
  if (!row) return false;
  await supabase.from("telegram_links").update({ telegram_chat_id: String(chatId), linked: true, updated_at: new Date().toISOString() }).eq("id", row.id);
  return true;
}
async function userIdForChat(chatId: number): Promise<string | null> {
  const { data } = await supabase.from("telegram_links").select("user_id").eq("telegram_chat_id", String(chatId)).eq("linked", true).maybeSingle();
  return (data?.user_id as string) || null;
}

/* ── Gemini: interpreta el mensaje del usuario ── */
async function interpret(userId: string, text: string) {
  const tasksDom = await getDomain(userId, "sh_tasks");
  const subsDom = await getDomain(userId, "sh_subjects");
  const subjects = (subsDom.subjects || []) as any[];
  const pend = (tasksDom.tasks || []).filter((t: any) => !t.done);
  const summary = [
    `Materias: ${subjects.map((s) => s.name).join(", ") || "ninguna"}.`,
    `Tareas pendientes: ${pend.length}.`,
  ].join(" ");

  const sys = `Sos Hubby, el asistente de StudyHub (app de organización para la facultad). El usuario te escribe por Telegram, en español (Argentina).
Respondé SOLO con un JSON válido (sin markdown, sin \`\`\`), con esta forma exacta:
{"intent":"add_task"|"add_event"|"chat","reply":"texto corto y cálido para responderle","task":{"t":"","prio":"alta|media|baja","due":"YYYY-MM-DD o vacío","subjectName":""},"event":{"title":"","date":"YYYY-MM-DD","kind":"evento|parcial|entrega","important":false}}
Reglas:
- add_task: quiere guardar algo para hacer/estudiar/entregar. Poné task; omití event.
- add_event: menciona una fecha concreta (parcial, final, entrega, evento). Poné event; omití task. important=true si dice que es importante o es un final/parcial clave.
- chat: preguntas sobre sus datos o charla. Solo reply, usando el contexto.
- Si menciona una materia, poné subjectName con el nombre parecido al de la lista.
Hoy es ${todayAR()}. Contexto: ${summary}`;

  const resp = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 700, responseMimeType: "application/json" },
    }),
  });
  const data = await resp.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  try { return { parsed: JSON.parse(raw), subjects }; }
  catch { return { parsed: { intent: "chat", reply: raw.slice(0, 400) }, subjects }; }
}

/* ── aplica la acción a app_data ── */
async function applyIntent(userId: string, parsed: any, subjects: any[]): Promise<string> {
  const findSubjId = (name?: string) => {
    if (!name) return null;
    const n = name.toLowerCase().trim();
    const hit = subjects.find((s) => (s.name || "").toLowerCase().includes(n) || n.includes((s.name || "").toLowerCase()));
    return hit?.id || null;
  };

  if (parsed.intent === "add_task" && parsed.task) {
    const t = parsed.task;
    const dom = await getDomain(userId, "sh_tasks");
    if (!Array.isArray(dom.tasks)) dom.tasks = [];
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(t.due || "") ? t.due : "";
    dom.tasks.push({
      id: uid(), t: (t.t || "").trim(), desc: "",
      subject: findSubjId(t.subjectName), prio: ["alta", "media", "baja"].includes(t.prio) ? t.prio : "media",
      due: iso ? ddmm(iso) : "—", dueDate: iso, status: "pendiente", done: false,
    });
    await setDomain(userId, "sh_tasks", dom);
    return parsed.reply || `Anotado: ${t.t} ✅`;
  }

  if (parsed.intent === "add_event" && parsed.event) {
    const e = parsed.event;
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(e.date || "") ? e.date : todayAR();
    const dom = await getDomain(userId, "sh_calendar");
    if (!Array.isArray(dom.events)) dom.events = [];
    dom.events.push({
      id: uid(), title: (e.title || "").trim(), date: iso, day: parseInt(iso.slice(8, 10)),
      time: "", color: "#D9551F", desc: "",
      kind: ["evento", "parcial", "entrega", "clase", "estudio"].includes(e.kind) ? e.kind : "evento",
      subjectId: null, important: !!e.important,
    });
    await setDomain(userId, "sh_calendar", dom);
    return parsed.reply || `Agendado: ${e.title} para el ${ddmm(iso)} 📅`;
  }

  return parsed.reply || "Listo.";
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  let update: any;
  try { update = await req.json(); } catch { return new Response("ok"); }

  const msg = update?.message;
  const chatId = msg?.chat?.id;
  const text = (msg?.text || "").trim();
  if (!chatId || !text) return new Response("ok");

  try {
    // /start [CODE] → vincular la cuenta
    if (text.startsWith("/start")) {
      const code = text.split(/\s+/)[1];
      if (code && await linkChat(code, chatId)) {
        await sendMsg(chatId, "¡Listo! 🎉 Tu Telegram quedó vinculado a StudyHub. Escribime lo que quieras guardar, por ejemplo:\n• <i>parcial de álgebra el 24/6</i>\n• <i>tarea: terminar el TP de redes para el viernes</i>");
      } else {
        await sendMsg(chatId, "¡Hola! Soy Hubby 🤖. Para vincularte, entrá a StudyHub → Configuración → Integraciones, generá tu código y mandámelo con <code>/start TUCODIGO</code>.");
      }
      return new Response("ok");
    }

    const userId = await userIdForChat(chatId);
    if (!userId) {
      await sendMsg(chatId, "Todavía no estás vinculado. Entrá a StudyHub → Configuración → Integraciones, generá tu código y mandámelo con <code>/start TUCODIGO</code>.");
      return new Response("ok");
    }

    const { parsed, subjects } = await interpret(userId, text);
    const reply = await applyIntent(userId, parsed, subjects);
    await sendMsg(chatId, reply);
  } catch (e) {
    console.error("bot error:", e);
    await sendMsg(chatId, "Uf, se me trabó algo. Probá de nuevo en un ratito.");
  }
  return new Response("ok");
});
