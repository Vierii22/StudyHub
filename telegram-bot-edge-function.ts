// ============================================================
// Bot de Telegram de StudyHub — Edge Function (Deno / Supabase)
// v2: /help, respuestas intuitivas, confirmación real (solo dice
// "agregado" si de verdad guardó), y consultas ("¿qué tengo?").
//
// Deploy:  supabase functions deploy telegram-bot --no-verify-jwt
//          (o desde el dashboard con "Verify JWT" APAGADO)
// Secrets: TELEGRAM_BOT_TOKEN, GEMINI_API_KEY
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
const todayAR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const ddmm = (iso: string) => { const [, m, d] = iso.split("-"); return `${parseInt(d)}/${parseInt(m)}`; };

async function sendMsg(chatId: number | string, text: string) {
  await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
}

const HELP = `Soy <b>Hubby</b> 🤖, tu asistente de StudyHub. Escribime en lenguaje normal y lo guardo solo en la app.

<b>Ejemplos:</b>
• <i>tarea: terminar el TP de redes para el viernes</i>
• <i>parcial de álgebra el 24</i>
• <i>entrega del práctico 5 el 30/6</i>
• <i>¿qué tengo pendiente?</i>
• <i>¿qué tengo esta semana?</i>

<b>Comandos:</b>
/start — vincular tu cuenta
/help — ver esta ayuda

Probá tirándome cualquier cosa que tengas que hacer o cualquier fecha 👇`;

async function getDomain(userId: string, key: string) {
  const { data } = await supabase.from("app_data").select("value").eq("user_id", userId).eq("key", key).maybeSingle();
  return (data?.value as any) || {};
}
async function setDomain(userId: string, key: string, value: unknown): Promise<boolean> {
  const { error } = await supabase.from("app_data").upsert(
    { user_id: userId, key, value, updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" },
  );
  if (error) console.error("setDomain error:", key, error.message);
  return !error;
}

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

/* Gemini interpreta el mensaje → JSON con la intención */
async function interpret(userId: string, text: string) {
  const tasksDom = await getDomain(userId, "sh_tasks");
  const subsDom = await getDomain(userId, "sh_subjects");
  const calDom = await getDomain(userId, "sh_calendar");
  const subjects = (subsDom.subjects || []) as any[];
  const pend = ((tasksDom.tasks || []) as any[]).filter((t) => !t.done);
  const events = (calDom.events || []) as any[];
  const ctx = {
    materias: subjects.map((s) => s.name),
    pendientes: pend.map((t) => t.t),
    proximos: events.filter((e) => (e.date || "") >= todayAR()).slice(0, 8).map((e) => `${e.title} (${e.date})`),
  };

  const sys = `Sos Hubby, el asistente de StudyHub (organización para la facultad). El usuario te escribe por Telegram en español (Argentina).
Devolvé SOLO un JSON válido (sin markdown), con esta forma:
{"intent":"add_task"|"add_event"|"query"|"chat","reply":"...","task":{"t":"","prio":"alta|media|baja","due":"YYYY-MM-DD o vacío","subjectName":""},"event":{"title":"","date":"YYYY-MM-DD","kind":"evento|parcial|entrega","important":false,"subjectName":""}}
Reglas MUY importantes:
- Si el usuario quiere GUARDAR algo para hacer/estudiar/entregar → intent "add_task" (poné task).
- Si menciona una FECHA concreta (parcial, final, entrega, evento) → intent "add_event" (poné event).
- Si PREGUNTA por sus datos ("qué tengo", "qué pendientes", "cuándo es") → intent "query" y respondé en "reply" usando el contexto.
- Solo usá "chat" para saludos o charla suelta.
- NUNCA digas en "reply" que guardaste algo si el intent no es add_task/add_event. El sistema pone la confirmación.
- Si menciona una materia, poné subjectName parecido a la lista.
Hoy es ${todayAR()}. Contexto del usuario: ${JSON.stringify(ctx)}`;

  try {
    const resp = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 700, responseMimeType: "application/json" },
      }),
    });
    if (!resp.ok) { console.error("gemini http", resp.status, await resp.text()); return { parsed: null, subjects }; }
    const data = await resp.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return { parsed: JSON.parse(raw), subjects };
  } catch (e) {
    console.error("interpret error:", e);
    return { parsed: null, subjects };
  }
}

/* aplica la acción y devuelve la confirmación REAL (solo dice OK si guardó) */
async function applyIntent(userId: string, parsed: any, subjects: any[]): Promise<string> {
  const findSubjId = (name?: string) => {
    if (!name) return null;
    const n = name.toLowerCase().trim();
    const hit = subjects.find((s) => (s.name || "").toLowerCase().includes(n) || n.includes((s.name || "").toLowerCase()));
    return hit?.id || null;
  };

  if (parsed?.intent === "add_task" && parsed.task?.t) {
    const t = parsed.task;
    const dom = await getDomain(userId, "sh_tasks");
    if (!Array.isArray(dom.tasks)) dom.tasks = [];
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(t.due || "") ? t.due : "";
    dom.tasks.push({
      id: uid(), t: t.t.trim(), desc: "", subject: findSubjId(t.subjectName),
      prio: ["alta", "media", "baja"].includes(t.prio) ? t.prio : "media",
      due: iso ? ddmm(iso) : "—", dueDate: iso, status: "pendiente", done: false,
    });
    const ok = await setDomain(userId, "sh_tasks", dom);
    return ok
      ? `✅ Tarea guardada: <b>${t.t.trim()}</b>${iso ? ` · vence ${ddmm(iso)}` : ""}\nLa ves en la app en <b>Tareas</b>.`
      : `Uf, no pude guardarla 😕 probá de nuevo en un ratito.`;
  }

  if (parsed?.intent === "add_event" && parsed.event?.title) {
    const e = parsed.event;
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(e.date || "") ? e.date : todayAR();
    const dom = await getDomain(userId, "sh_calendar");
    if (!Array.isArray(dom.events)) dom.events = [];
    dom.events.push({
      id: uid(), title: e.title.trim(), date: iso, day: parseInt(iso.slice(8, 10)),
      time: "", color: "#D9551F", desc: "",
      kind: ["evento", "parcial", "entrega", "clase", "estudio"].includes(e.kind) ? e.kind : "evento",
      subjectId: findSubjId(e.subjectName), important: !!e.important,
    });
    const ok = await setDomain(userId, "sh_calendar", dom);
    return ok
      ? `📅 Agendado: <b>${e.title.trim()}</b> para el ${ddmm(iso)}\nLo ves en la app en <b>Calendario</b>.`
      : `Uf, no pude agendarlo 😕 probá de nuevo.`;
  }

  /* query o chat: contestamos lo que dijo Gemini */
  return parsed?.reply || "No te entendí del todo 🤔 probá /help para ver ejemplos.";
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
    if (text.startsWith("/start")) {
      const code = text.split(/\s+/)[1];
      if (code && await linkChat(code, chatId)) {
        await sendMsg(chatId, `¡Listo! 🎉 Tu Telegram quedó vinculado a StudyHub.\n\n${HELP}`);
      } else {
        await sendMsg(chatId, "¡Hola! Soy Hubby 🤖\n\nPara empezar, entrá a StudyHub → <b>Configuración → Integraciones</b>, generá tu código, y mandámelo así:\n<code>/start TUCODIGO</code>");
      }
      return new Response("ok");
    }
    if (text === "/help" || text === "/ayuda" || text.toLowerCase() === "ayuda") {
      await sendMsg(chatId, HELP);
      return new Response("ok");
    }

    const userId = await userIdForChat(chatId);
    if (!userId) {
      await sendMsg(chatId, "Todavía no estás vinculado 🔗\nEntrá a StudyHub → <b>Configuración → Integraciones</b>, generá tu código y mandámelo con <code>/start TUCODIGO</code>.");
      return new Response("ok");
    }

    await fetch(`${TG_API}/sendChatAction`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, action: "typing" }) });

    const { parsed, subjects } = await interpret(userId, text);
    if (!parsed) { await sendMsg(chatId, "Se me complicó entenderte ahora 😕 probá de nuevo, o mirá /help para ver ejemplos."); return new Response("ok"); }
    const reply = await applyIntent(userId, parsed, subjects);
    await sendMsg(chatId, reply);
  } catch (e) {
    console.error("bot error:", e);
    await sendMsg(chatId, "Uf, se me trabó algo 😕 probá de nuevo en un ratito.");
  }
  return new Response("ok");
});
