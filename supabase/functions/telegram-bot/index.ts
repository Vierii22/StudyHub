// ============================================================
// Bot de Telegram de StudyHub — Edge Function (Deno / Supabase)
// v3: + marcar hecho, anotar en materia, cargar nota, y botones
// rápidos (menú con inline keyboard). v2: /help, confirmación real.
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

/* menú con botones (para quien no sabe usar un bot) */
async function sendMenu(chatId: number | string) {
  await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "¿Qué querés hacer? También podés escribirme cualquier cosa 👇",
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📋 Ver pendientes", callback_data: "q_pend" }, { text: "🗓 Esta semana", callback_data: "q_week" }],
          [{ text: "❓ Cómo se usa", callback_data: "help" }],
        ],
      },
    }),
  });
}

const HELP = `Soy <b>Hubby</b> 🤖, tu asistente de StudyHub. Escribime en lenguaje normal y lo guardo solo en la app.

<b>Podés tirarme cosas como:</b>
• <i>tarea: terminar el TP de redes para el viernes</i>
• <i>parcial de álgebra el 24</i>
• <i>ya terminé el TP de redes</i> (lo marco hecho)
• <i>anotá en filosofía: el parcial entra hasta la unidad 3</i>
• <i>me saqué 8 en el parcial de álgebra</i>
• <i>¿qué tengo pendiente?</i> · <i>¿qué tengo esta semana?</i>

<b>Comandos:</b>
/start — vincular tu cuenta
/help — ver esta ayuda

Escribime cualquier cosa que tengas que hacer, una fecha, o preguntame qué tenés 👇`;

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
{"intent":"add_task"|"add_event"|"complete_task"|"note_subject"|"set_grade"|"query"|"chat","reply":"...","task":{"t":"","prio":"alta|media|baja","due":"YYYY-MM-DD o vacío","subjectName":""},"event":{"title":"","date":"YYYY-MM-DD","kind":"evento|parcial|entrega","important":false,"subjectName":""},"taskName":"","subjectName":"","note":"","gradeKey":"p1|p2|p3|coloquio|final","gradeValue":0}
Reglas MUY importantes:
- Guardar algo para hacer/estudiar/entregar → "add_task" (poné task).
- Menciona una FECHA concreta (parcial, final, entrega, evento) → "add_event" (poné event).
- Marca algo como HECHO/terminado ("ya terminé X", "hice X", "listo el TP") → "complete_task" (poné taskName con el nombre de la tarea).
- Quiere ANOTAR algo EN una materia ("anotá en filosofía: ...", "agregá a álgebra que...") → "note_subject" (poné subjectName y note).
- Dice una NOTA/calificación ("me saqué 8 en el parcial de álgebra", "aprobé el final de redes con 7") → "set_grade" (poné subjectName, gradeKey y gradeValue). Si dice "parcial" sin número, usá "p1".
- PREGUNTA por sus datos ("qué tengo", "qué pendientes", "cuándo es") → "query" y respondé en "reply" usando el contexto.
- Solo "chat" para saludos o charla suelta.
- NUNCA digas en "reply" que hiciste algo si el intent es query/chat. El sistema pone la confirmación de las acciones.
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

  if (parsed?.intent === "complete_task" && parsed.taskName) {
    const n = parsed.taskName.toLowerCase().trim();
    const dom = await getDomain(userId, "sh_tasks");
    const tasks = (dom.tasks || []) as any[];
    const hit = tasks.find((t) => !t.done && (t.t || "").toLowerCase().includes(n))
      || tasks.find((t) => (t.t || "").toLowerCase().includes(n));
    if (!hit) return `No encontré una tarea parecida a "<b>${parsed.taskName}</b>" 🤔`;
    hit.done = true; hit.status = "lista"; hit.completedAt = todayAR();
    const ok = await setDomain(userId, "sh_tasks", dom);
    return ok ? `✅ Marqué como hecha: <b>${hit.t}</b> ¡Bien ahí! 🎉` : `Uf, no pude actualizarla 😕`;
  }

  if (parsed?.intent === "note_subject" && parsed.subjectName && parsed.note) {
    const dom = await getDomain(userId, "sh_subjects");
    const subs = (dom.subjects || []) as any[];
    const n = parsed.subjectName.toLowerCase().trim();
    const sub = subs.find((s) => (s.name || "").toLowerCase().includes(n) || n.includes((s.name || "").toLowerCase()));
    if (!sub) return `No encontré la materia "<b>${parsed.subjectName}</b>" 🤔 Fijate cómo la escribiste en la app.`;
    if (!sub.lists) sub.lists = {};
    if (!Array.isArray(sub.lists.notas)) sub.lists.notas = [];
    sub.lists.notas.push({ id: uid(), t: parsed.note.trim() });
    const ok = await setDomain(userId, "sh_subjects", dom);
    return ok ? `📝 Anoté en <b>${sub.name}</b>: “${parsed.note.trim()}”` : `Uf, no pude anotarlo 😕`;
  }

  if (parsed?.intent === "set_grade" && parsed.subjectName && parsed.gradeValue != null) {
    const dom = await getDomain(userId, "sh_subjects");
    const subs = (dom.subjects || []) as any[];
    const n = parsed.subjectName.toLowerCase().trim();
    const sub = subs.find((s) => (s.name || "").toLowerCase().includes(n) || n.includes((s.name || "").toLowerCase()));
    if (!sub) return `No encontré la materia "<b>${parsed.subjectName}</b>" 🤔`;
    const key = ["p1", "p2", "p3", "coloquio", "final"].includes(parsed.gradeKey) ? parsed.gradeKey : "p1";
    const val = Math.max(1, Math.min(10, Number(parsed.gradeValue)));
    if (!sub.grades) sub.grades = {};
    sub.grades[key] = val;
    const ok = await setDomain(userId, "sh_subjects", dom);
    const label = key === "final" ? "el final" : key === "coloquio" ? "el coloquio" : `el parcial ${key.slice(1)}`;
    return ok ? `📊 Cargué <b>${val}</b> en ${label} de <b>${sub.name}</b>. Lo ves en <b>Progreso</b>.` : `Uf, no pude cargarla 😕`;
  }

  /* query o chat: contestamos lo que dijo Gemini */
  return parsed?.reply || "No te entendí del todo 🤔 probá /help para ver ejemplos.";
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  let update: any;
  try { update = await req.json(); } catch { return new Response("ok"); }

  /* clicks en los botones */
  const cq = update?.callback_query;
  if (cq) {
    const cqChat = cq.message?.chat?.id;
    try { await fetch(`${TG_API}/answerCallbackQuery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: cq.id }) }); } catch {}
    if (!cqChat) return new Response("ok");
    if (cq.data === "help") { await sendMsg(cqChat, HELP); return new Response("ok"); }
    const cqUser = await userIdForChat(cqChat);
    if (!cqUser) { await sendMsg(cqChat, "Vinculate primero con <code>/start TUCODIGO</code>."); return new Response("ok"); }
    const q = cq.data === "q_pend" ? "¿qué tengo pendiente?" : "¿qué tengo esta semana?";
    const r = await interpret(cqUser, q);
    await sendMsg(cqChat, r.parsed ? await applyIntent(cqUser, r.parsed, r.subjects) : "No pude ahora, probá de nuevo 😕");
    return new Response("ok");
  }

  const msg = update?.message;
  const chatId = msg?.chat?.id;
  const text = (msg?.text || "").trim();
  if (!chatId || !text) return new Response("ok");

  try {
    if (text.startsWith("/start")) {
      const code = text.split(/\s+/)[1];
      if (code && await linkChat(code, chatId)) {
        await sendMsg(chatId, `¡Listo! 🎉 Tu Telegram quedó vinculado a StudyHub.\n\n${HELP}`);
        await sendMenu(chatId);
      } else {
        await sendMsg(chatId, "¡Hola! Soy Hubby 🤖\n\nPara empezar, entrá a StudyHub → <b>Configuración → Integraciones</b>, generá tu código, y mandámelo así:\n<code>/start TUCODIGO</code>");
      }
      return new Response("ok");
    }
    if (text === "/help" || text === "/ayuda" || text.toLowerCase() === "ayuda") {
      await sendMsg(chatId, HELP);
      return new Response("ok");
    }
    if (text === "/menu" || text.toLowerCase() === "menu" || text.toLowerCase() === "menú") {
      await sendMenu(chatId);
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
