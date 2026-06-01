import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TELEGRAM_API = "https://api.telegram.org"
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

// ─── Formas exactas de la app (deben matchear 100%) ──────────────────────────
// studyhub_v3_tasks:    [{id,name,avClass,initials,progress,xp,status,statusTone,done,createdAt,dueDate?}]
// studyhub_v3_missions: [{id,title,desc,priority,xp,done,tasks:[{id,text,done}]}]
// studyhub_v3_calendar: [{id,title,date,color,desc}]
// studyhub_v3_diary:    string (texto plano)
// studyhub_v3_subjects: [{id,name,code,pct,prof,next,color,notes,tp:[]}]

const SECTION_INFO = `
Secciones disponibles:
- tareas: cualquier cosa a hacer, estudiar, entregar, resolver. Mencionar una materia (álgebra, análisis, programación) NO significa agregar la materia, significa que la tarea ES de esa materia.
- misiones: objetivos grandes con múltiples pasos o etapas. "quiero terminar", "proyecto de", "objetivo".
- calendario: eventos con fecha concreta. Parciales, finales, entregas, reuniones.
- diario: notas personales, reflexiones, "anotar que", "recordar que".
- materias: SOLO si el usuario quiere AGREGAR UNA MATERIA NUEVA que no existe todavía. Ej: "agregar la materia física" o "nueva materia: química".
- cocina: alimentos en heladera, freezer o almacén.
- compras: cosas para comprar, lista de compras.
- finanzas: gastos, ingresos, presupuesto. Cualquier monto de dinero.
- ocio: series, películas, juegos, libros, anime.

REGLA CRÍTICA: Cuando el usuario menciona una materia (álgebra, análisis, programación, etc.) junto con algo que hacer, la sección es TAREAS o MISIONES, nunca "materias". El nombre de la materia va en el campo "subject" y en el "title".

Ejemplos correctos:
"estudiar álgebra" → tareas, title: "Estudiar Álgebra", subject: "Álgebra"
"hacer ejercicios de análisis" → tareas, title: "Ejercicios de Análisis", subject: "Análisis"
"resolver práctica 5 de álgebra" → tareas, title: "Práctica 5 de Álgebra", subject: "Álgebra"
"terminar TP de programación" → tareas, title: "TP de Programación", subject: "Programación"
"misión: aprobar álgebra" → misiones, title: "Aprobar Álgebra", subject: "Álgebra"
"parcial de álgebra el 15 de julio" → calendario, title: "Parcial Álgebra", date: "2025-07-15"
"agregar la materia física" → materias, title: "Física"
"gasté 3000 en fotocopias" → finanzas
"comprar leche y pan" → compras
"anotar que la clase estuvo buena" → diario
`

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sendMessage(chatId: number | string, token: string, text: string, replyMarkup?: object) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  }
  if (replyMarkup) body.reply_markup = replyMarkup
  return fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function answerCallbackQuery(callbackId: string, token: string, text = "") {
  return fetch(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId, text }),
  })
}

async function getState(supabase: ReturnType<typeof createClient>, chatId: string) {
  const { data } = await supabase
    .from("telegram_state")
    .select("state")
    .eq("chat_id", chatId)
    .maybeSingle()
  return data?.state || null
}

async function setState(supabase: ReturnType<typeof createClient>, chatId: string, state: object | null) {
  if (state === null) {
    await supabase.from("telegram_state").delete().eq("chat_id", chatId)
  } else {
    await supabase.from("telegram_state").upsert(
      { chat_id: chatId, state, updated_at: new Date().toISOString() },
      { onConflict: "chat_id" }
    )
  }
}

// Append un item a un array en app_data con la key correcta
async function appendToAppData(supabase: ReturnType<typeof createClient>, userId: string, key: string, newItem: object) {
  const { data } = await supabase
    .from("app_data")
    .select("value")
    .eq("user_id", userId)
    .eq("key", key)
    .maybeSingle()

  const arr = Array.isArray(data?.value) ? data.value : []
  arr.push(newItem)

  await supabase.from("app_data").upsert(
    { user_id: userId, key, value: arr, updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" }
  )
}

// Agregar texto al diario (string acumulado)
async function appendToDiary(supabase: ReturnType<typeof createClient>, userId: string, text: string) {
  const { data } = await supabase
    .from("app_data")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "studyhub_v3_diary")
    .maybeSingle()

  const current = typeof data?.value === "string" ? data.value : (data?.value?.text || "")
  const today = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
  const newText = current ? `${current}\n\n[${today} vía Telegram]\n${text}` : `[${today} vía Telegram]\n${text}`

  await supabase.from("app_data").upsert(
    { user_id: userId, key: "studyhub_v3_diary", value: newText, updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" }
  )
}

// Clasificador por palabras clave (fallback si Gemini falla)
function classifyByKeywords(text: string): Record<string, unknown> {
  const t = text.toLowerCase()

  // Finanzas — monto explícito o palabras de gasto
  if (/gasté|gaste|pagué|pague|compré por|costó|costo|me cobró|\$\d|\d+\s*pesos/.test(t)) {
    const amountMatch = text.match(/\d+/)
    return { section: "finanzas", confidence: 0.8, data: { title: text, amount: amountMatch ? parseInt(amountMatch[0]) : null, type: "gasto", priority: "medium", xp: 5 } }
  }

  // Compras — lista de compras
  if (/^comprar\s|necesito comprar|lista de compras|me falta|falta\s/.test(t)) {
    return { section: "compras", confidence: 0.85, data: { title: text, priority: "medium", xp: 5 } }
  }

  // Calendario — evento con fecha
  if (/parcial|final|examen|entrega|reunión|reunion|clase\s+el|evento/.test(t)) {
    return { section: "calendario", confidence: 0.8, data: { title: text, priority: "high", xp: 20 } }
  }

  // Misiones — objetivo grande
  if (/misión|mision|quiero terminar|quiero hacer|proyecto|objetivo|meta/.test(t)) {
    return { section: "misiones", confidence: 0.8, data: { title: text, priority: "medium", xp: 20 } }
  }

  // Diario — nota personal
  if (/anotar|nota:|diario|recordar que|pensar en|reflexión|reflexion/.test(t)) {
    return { section: "diario", confidence: 0.85, data: { title: text, priority: "low", xp: 5 } }
  }

  // Tareas — estudiar, hacer, leer
  if (/estudiar|leer|hacer|tp |trabajo práctico|práctica|practica|repasar|capítulo|capitulo|ejercicio|resolver/.test(t)) {
    return { section: "tareas", confidence: 0.8, data: { title: text, priority: "medium", xp: 10 } }
  }

  return { section: null, confidence: 0.3, data: { title: text } }
}

// Clasificar con Gemini (con fallback a keywords y debug de errores)
async function classifyWithGemini(text: string, geminiKey: string): Promise<Record<string, unknown> & { _geminiError?: string }> {
  // Si no hay API key, usar keywords directamente
  if (!geminiKey) {
    console.log("GEMINI_API_KEY no configurado, usando clasificador por keywords")
    return classifyByKeywords(text)
  }

  try {
    const response = await fetch(`${GEMINI_API}?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Sos un asistente de la app de estudio StudyHub. Analizá este mensaje y clasificalo.

${SECTION_INFO}

Mensaje del usuario: "${text}"

Respondé SOLO con un JSON (sin markdown, sin explicación):
{
  "section": "tareas|misiones|calendario|diario|materias|cocina|compras|finanzas|ocio",
  "action": "add",
  "data": {
    "title": "texto descriptivo del item (incluí la materia si aplica, ej: 'Práctica 5 de Álgebra')",
    "desc": "descripción adicional si la hay, o vacío",
    "subject": "nombre de la materia si se menciona (ej: 'Álgebra', 'Análisis'), o null",
    "date": "YYYY-MM-DD si hay fecha mencionada, o null",
    "priority": "high|medium|low",
    "xp": 10,
    "amount": null,
    "type": null
  },
  "confidence": 0.9,
  "needs_clarification": false
}

Si el mensaje es ambiguo (confidence < 0.6), poné "needs_clarification": true y agregá "data.clarification" con la pregunta al usuario.`
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    })

    const json = await response.json()

    // Debug: loguear respuesta completa de Gemini
    console.log("Gemini status:", response.status)
    console.log("Gemini response:", JSON.stringify(json).slice(0, 500))

    // Si hay error de API (clave inválida, quota, etc.)
    if (json.error) {
      console.log("Gemini API error:", json.error.message)
      const fallback = classifyByKeywords(text)
      return { ...fallback, _geminiError: json.error.message }
    }

    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const parsed = JSON.parse(cleaned)
    return parsed

  } catch (e) {
    console.log("Gemini fetch error:", (e as Error).message)
    // Fallback a keywords
    return classifyByKeywords(text)
  }
}

// Preguntas de seguimiento según sección
function getFollowupQuestion(section: string, draft: Record<string, unknown>): string | null {
  const data = (draft.data || {}) as Record<string, unknown>

  if (section === "misiones") {
    // Siempre preguntar por subtareas en misiones
    return `📋 ¿Querés agregarle tareas/pasos a esta misión?\n\nMandá las tareas separadas por coma (ej: "estudiar cap1, hacer ejercicios, repasar") o escribí <b>no</b> para crearla sin tareas.`
  }

  if (section === "tareas" && !data.date) {
    return `📅 ¿Para cuándo es esta tarea? (ej: "lunes", "15 de julio", "la semana que viene") O escribí <b>sin fecha</b>.`
  }

  if (section === "calendario" && !data.date) {
    return `📅 ¿Qué día es? (ej: "15 de julio", "próximo lunes", "el 20")`
  }

  if (section === "finanzas" && !data.amount) {
    return `💰 ¿Cuánto fue el ${data.type === "ingreso" ? "ingreso" : "gasto"}? (solo el número, ej: 3500)`
  }

  return null
}

// Parsear fecha en español
function parseSpanishDate(text: string): string | null {
  if (!text) return null
  const t = text.toLowerCase().trim()

  if (t === "hoy" || t === "today") {
    return new Date().toISOString().slice(0, 10)
  }
  if (t === "mañana") {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }
  if (t.startsWith("el ") || t.startsWith("para el ")) {
    const num = parseInt(t.replace(/\D+/g, ""))
    if (num >= 1 && num <= 31) {
      const now = new Date()
      const d = new Date(now.getFullYear(), now.getMonth(), num)
      if (d < now) d.setMonth(d.getMonth() + 1)
      return d.toISOString().slice(0, 10)
    }
  }

  const MONTHS: Record<string, number> = {
    enero:0, febrero:1, marzo:2, abril:3, mayo:4, junio:5,
    julio:6, agosto:7, septiembre:8, octubre:9, noviembre:10, diciembre:11
  }
  for (const [name, idx] of Object.entries(MONTHS)) {
    const match = t.match(new RegExp(`(\\d{1,2})\\s+(?:de\\s+)?${name}`))
    if (match) {
      const day = parseInt(match[1])
      const now = new Date()
      const d = new Date(now.getFullYear(), idx, day)
      if (d < now) d.setFullYear(d.getFullYear() + 1)
      return d.toISOString().slice(0, 10)
    }
  }

  const DAYS: Record<string, number> = {
    lunes:1, martes:2, miércoles:3, miercoles:3, jueves:4,
    viernes:5, sábado:6, sabado:6, domingo:0
  }
  for (const [name, dayIdx] of Object.entries(DAYS)) {
    if (t.includes(name)) {
      const now = new Date()
      const diff = (dayIdx - now.getDay() + 7) % 7 || 7
      const d = new Date(now)
      d.setDate(d.getDate() + diff)
      return d.toISOString().slice(0, 10)
    }
  }

  // Formato YYYY-MM-DD directo
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t

  return null
}

// Construir el item final para guardar en app_data según la sección
function buildItem(section: string, draft: Record<string, unknown>, subtasks?: string[]): { key: string; item: Record<string, unknown> } | null {
  const data = (draft.data || {}) as Record<string, unknown>
  const now = Date.now()

  if (section === "tareas") {
    const avClasses = ["v1","v2","v3","v4"]
    const title = (data.title as string) || "Tarea sin nombre"
    const initials = title.split(/\s+/).slice(0,2).map((w: string) => w[0]?.toUpperCase() || "?").join("")
    return {
      key: "studyhub_v3_tasks",
      item: {
        id: now,
        name: title,
        avClass: avClasses[Math.floor(Math.random() * avClasses.length)],
        initials,
        progress: (data.subject as string) ? `${data.subject} · ${(data.desc as string) || "En curso"}` : ((data.desc as string) || "En curso"),
        xp: (data.xp as number) || 10,
        status: "Pendiente",
        statusTone: "blue",
        done: false,
        createdAt: now,
        dueDate: data.date || null,
        savedViaTelegram: true,
      },
    }
  }

  if (section === "misiones") {
    const tasks = (subtasks || []).map((t, i) => ({ id: now + i, text: t.trim(), done: false }))
    return {
      key: "studyhub_v3_missions",
      item: {
        id: now,
        title: (data.title as string) || "Nueva misión",
        desc: (data.desc as string) || "",
        priority: (data.priority as string) || "medium",
        xp: (data.xp as number) || 15,
        done: false,
        tasks,
        savedViaTelegram: true,
      },
    }
  }

  if (section === "calendario") {
    const colors = ["v1","v2","v3","v4"]
    return {
      key: "studyhub_v3_calendar",
      item: {
        id: now,
        title: (data.title as string) || "Evento",
        date: (data.date as string) || new Date().toISOString().slice(0, 10),
        color: colors[Math.floor(Math.random() * colors.length)],
        desc: (data.desc as string) || "",
        savedViaTelegram: true,
      },
    }
  }

  if (section === "compras") {
    return {
      key: "studyhub_v3_groceries",
      item: {
        id: now,
        title: (data.title as string) || "Item",
        done: false,
      },
    }
  }

  if (section === "cocina") {
    return {
      key: "studyhub_v3_kitchen",
      item: {
        id: now,
        title: (data.title as string) || "Alimento",
        sub: (data.desc as string) || "",
        tag: "",
        warn: false,
        section: "heladera",
      },
    }
  }

  if (section === "materias") {
    const name = (data.title as string) || "Materia"
    const code = name.split(/\s+/).map((w: string) => w[0]?.toUpperCase() || "").join("").slice(0, 3)
    return {
      key: "studyhub_v3_subjects",
      item: {
        id: now,
        name,
        code,
        pct: 0,
        prof: "",
        next: "",
        color: "v1",
        notes: "",
        tp: [],
      },
    }
  }

  if (section === "ocio") {
    const typeMap: Record<string, string> = {
      serie:"serie", pelicula:"pelicula", película:"pelicula",
      juego:"juego", libro:"libro", anime:"anime"
    }
    const detectedType = Object.keys(typeMap).find(k => (data.title as string || "").toLowerCase().includes(k)) || "serie"
    const emojiMap: Record<string, string> = { serie:"📺", pelicula:"🎬", juego:"🎮", libro:"📚", anime:"⛩️" }
    return {
      key: "studyhub_ocio_v1",
      item: {
        id: now,
        emoji: emojiMap[typeMap[detectedType]] || "📺",
        title: (data.title as string) || "Contenido",
        type: typeMap[detectedType] || "serie",
        status: "pendiente",
        score: 0,
        note: (data.desc as string) || "",
      },
    }
  }

  return null
}

function formatConfirmMessage(section: string, draft: Record<string, unknown>): string {
  const data = (draft.data || {}) as Record<string, unknown>
  const sectionEmoji: Record<string, string> = {
    tareas:"✅", misiones:"⚡", calendario:"📅", diario:"📖",
    materias:"📚", cocina:"🍽️", compras:"🛒", finanzas:"💰", ocio:"🎬"
  }
  const sectionName: Record<string, string> = {
    tareas:"Tareas", misiones:"Misiones", calendario:"Calendario", diario:"Diario",
    materias:"Materias", cocina:"Cocina", compras:"Lista de compras", finanzas:"Finanzas", ocio:"Ocio"
  }

  let details = `<b>${data.title as string || "Item"}</b>`
  if (data.subject) details += `\n📚 Materia: ${data.subject}`
  if (data.desc) details += `\n📝 ${data.desc}`
  if (data.date) details += `\n📅 ${data.date}`
  if (data.priority === "high") details += "\n🔴 Prioridad alta"
  if (data.xp) details += `\n⚡ +${data.xp} XP`
  if (data.amount) details += `\n💰 $${data.amount} (${data.type || "gasto"})`

  return `${sectionEmoji[section] || "📌"} <b>${sectionName[section] || section}</b>\n\n${details}\n\n¿Guardamos esto?`
}

// ─── Handler principal ────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    const body = await req.json()

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!
    const geminiKey = Deno.env.get("GEMINI_API_KEY")!

    const supabase = createClient(supabaseUrl, supabaseKey)

    // ── Callback query (respuesta a botones inline) ──────────────────────────
    if (body.callback_query) {
      const cq = body.callback_query
      const chatId = cq.message.chat.id.toString()
      const callbackData = cq.data as string

      await answerCallbackQuery(cq.id, telegramToken)

      const state = await getState(supabase, chatId)

      if (!state) {
        await sendMessage(chatId, telegramToken, "❓ No encontré nada pendiente. Mandame algo nuevo.")
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      if (callbackData === "confirm_yes" && state.stage === "awaiting_confirm") {
        // Guardar el item
        const built = buildItem(state.section as string, state.draft as Record<string, unknown>, state.subtasks as string[] | undefined)

        if (built) {
          if (state.section === "diario") {
            await appendToDiary(supabase, state.user_id as string, (state.draft as Record<string, unknown>).data?.title as string || "")
          } else {
            await appendToAppData(supabase, state.user_id as string, built.key, built.item)
          }
          await setState(supabase, chatId, null)
          await sendMessage(chatId, telegramToken, "✅ ¡Guardado! Ya aparece en la app.")
        } else {
          await setState(supabase, chatId, null)
          await sendMessage(chatId, telegramToken, "❌ No pude guardar ese tipo de item.")
        }

      } else if (callbackData === "confirm_no") {
        await setState(supabase, chatId, null)
        await sendMessage(chatId, telegramToken, "❌ Cancelado. Si querés guardar otra cosa, mandame un mensaje.")

      } else if (callbackData === "change_section") {
        await setState(supabase, chatId, { ...state, stage: "awaiting_section_change" })
        await sendMessage(chatId, telegramToken,
          "📁 ¿A qué sección lo mando?\n\nOpciones: <b>tareas, misiones, calendario, diario, materias, cocina, compras, finanzas, ocio</b>")
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // ── Mensaje de texto ─────────────────────────────────────────────────────
    const message = body.message
    if (!message) return new Response(JSON.stringify({ ok: true }), { status: 200 })

    const chatId = message.chat.id.toString()
    const text = (message.text || "").trim()

    if (!text) return new Response(JSON.stringify({ ok: true }), { status: 200 })

    // ── PASO 1: Verificar/procesar código SH-XXXX (ANTES del chequeo de vínculo)
    if (/^SH-[A-Z0-9]{4}$/i.test(text.trim())) {
      const code = text.trim().toUpperCase()

      const { data: pendingLink, error: findErr } = await supabase
        .from("telegram_links")
        .select("user_id, link_code")
        .eq("link_code", code)
        .eq("linked", false)
        .maybeSingle()

      if (findErr || !pendingLink) {
        await sendMessage(chatId, telegramToken, "❌ Código inválido o ya usado. Generá uno nuevo desde la app.")
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      await supabase
        .from("telegram_links")
        .update({
          linked: true,
          telegram_chat_id: chatId,
          updated_at: new Date().toISOString(),
        })
        .eq("link_code", code)

      await sendMessage(chatId, telegramToken,
        `✅ <b>¡Vinculación exitosa!</b>\n\nAhora podés mandarme cualquier cosa y la guardo en StudyHub.\n\n` +
        `Algunos ejemplos:\n` +
        `• "estudiar análisis el lunes" → Tareas\n` +
        `• "parcial álgebra el 15 de julio" → Calendario\n` +
        `• "quiero terminar el TP final" → Misiones\n` +
        `• "gasté 3000 en fotocopias" → Finanzas\n\n` +
        `🎯 Mando <b>un mensaje a la vez</b>, claro y directo. ¡Empezá!`)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // ── PASO 2: Verificar que el chat esté vinculado ─────────────────────────
    const { data: link } = await supabase
      .from("telegram_links")
      .select("user_id, auto_save")
      .eq("telegram_chat_id", chatId)
      .eq("linked", true)
      .maybeSingle()

    if (!link) {
      await sendMessage(chatId, telegramToken,
        "🔗 <b>Tu cuenta no está vinculada todavía.</b>\n\nAbrí StudyHub → Configuración → Integraciones → Telegram, generá el código y mandámelo acá.")
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    const userId = link.user_id as string

    // ── PASO 3: Verificar si hay estado activo (conversación en curso) ────────
    const state = await getState(supabase, chatId)

    if (state) {
      const stage = state.stage as string
      const draft = state.draft as Record<string, unknown>
      const section = state.section as string

      // Respuesta a cambio de sección
      if (stage === "awaiting_section_change") {
        const validSections = ["tareas","misiones","calendario","diario","materias","cocina","compras","finanzas","ocio"]
        const newSection = text.toLowerCase().trim()
        if (validSections.includes(newSection)) {
          const newDraft = { ...draft, data: { ...(draft.data as Record<string, unknown>), title: (draft.data as Record<string,unknown>)?.title } }
          const newState = { ...state, stage: "awaiting_confirm", section: newSection, draft: newDraft }

          const followup = getFollowupQuestion(newSection, newDraft)
          if (followup) {
            await setState(supabase, chatId, { ...newState, stage: "awaiting_followup" })
            await sendMessage(chatId, telegramToken, followup)
          } else {
            await setState(supabase, chatId, newState)
            await sendMessage(chatId, telegramToken, formatConfirmMessage(newSection, newDraft), {
              inline_keyboard: [[
                { text: "✅ Sí, guardar", callback_data: "confirm_yes" },
                { text: "❌ No", callback_data: "confirm_no" },
                { text: "📁 Cambiar sección", callback_data: "change_section" },
              ]]
            })
          }
        } else {
          await sendMessage(chatId, telegramToken, "❓ No reconocí esa sección. Mandá una de estas: tareas, misiones, calendario, diario, materias, cocina, compras, finanzas, ocio")
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      // Respuesta a followup (misiones: subtareas, tareas: fecha, etc.)
      if (stage === "awaiting_followup") {
        let updatedDraft = { ...draft }
        let subtasks: string[] | undefined = state.subtasks as string[] | undefined

        if (section === "misiones") {
          // El usuario respondió sobre las subtareas
          if (text.toLowerCase() !== "no") {
            subtasks = text.split(",").map((t: string) => t.trim()).filter(Boolean)
          }
        } else if (section === "tareas" || section === "calendario") {
          // Respuesta de fecha
          if (!["sin fecha", "no tengo", "no sé", "nada"].some(s => text.toLowerCase().includes(s))) {
            const parsedDate = parseSpanishDate(text) || text
            updatedDraft = { ...draft, data: { ...(draft.data as Record<string,unknown>), date: parsedDate } }
          }
        } else if (section === "finanzas") {
          // Monto
          const num = parseFloat(text.replace(/[^\d.,]/g, "").replace(",", "."))
          if (!isNaN(num)) {
            updatedDraft = { ...draft, data: { ...(draft.data as Record<string,unknown>), amount: num } }
          }
        }

        // Actualizar estado y pasar a confirmación
        const newState = { ...state, stage: "awaiting_confirm", draft: updatedDraft, subtasks }
        await setState(supabase, chatId, newState)

        await sendMessage(chatId, telegramToken, formatConfirmMessage(section, updatedDraft), {
          inline_keyboard: [[
            { text: "✅ Sí, guardar", callback_data: "confirm_yes" },
            { text: "❌ No", callback_data: "confirm_no" },
            { text: "📁 Cambiar sección", callback_data: "change_section" },
          ]]
        })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      // Confirmación textual (respaldo si los botones no funcionan)
      if (stage === "awaiting_confirm") {
        const t = text.toLowerCase()
        if (["sí","si","yes","dale","ok","confirmar","guardalo","guardar"].some(w => t.includes(w))) {
          const built = buildItem(section, draft, state.subtasks as string[] | undefined)
          if (built) {
            if (section === "diario") {
              await appendToDiary(supabase, userId, (draft.data as Record<string,unknown>)?.title as string || "")
            } else {
              await appendToAppData(supabase, userId, built.key, built.item)
            }
            await setState(supabase, chatId, null)
            await sendMessage(chatId, telegramToken, "✅ ¡Guardado! Ya aparece en la app.")
          }
        } else if (["no","cancelar","descartar"].some(w => t.includes(w))) {
          await setState(supabase, chatId, null)
          await sendMessage(chatId, telegramToken, "❌ Cancelado.")
        } else {
          // Puede ser un nuevo mensaje, limpiar estado y procesar como nuevo intent
          await setState(supabase, chatId, null)
          // Continuar al procesamiento de nuevo intent abajo
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
    }

    // ── PASO 4: Comandos especiales ──────────────────────────────────────────
    if (text === "/start" || text === "/ayuda" || text === "/help") {
      await sendMessage(chatId, telegramToken,
        `👋 <b>Hola! Soy el bot de StudyHub.</b>\n\n` +
        `Mandame cualquier cosa en lenguaje natural y la guardo en tu app:\n\n` +
        `📚 <b>Ejemplos:</b>\n` +
        `• "estudiar análisis para el lunes"\n` +
        `• "parcial de álgebra el 15 de julio"\n` +
        `• "quiero terminar el TP grupal — misión"\n` +
        `• "gasté 2500 en libros"\n` +
        `• "comprar pan, leche, huevos"\n` +
        `• "anotar: la clase de hoy estuvo buena"\n\n` +
        `⚙️ Comandos: /ayuda · /cancelar`)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (text === "/cancelar") {
      await setState(supabase, chatId, null)
      await sendMessage(chatId, telegramToken, "✅ Operación cancelada.")
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // Comando de debug — muestra estado de secrets y prueba Gemini en vivo
    if (text === "/debug") {
      const hasGemini = !!geminiKey
      const hasToken = !!telegramToken
      let geminiTest = "no probado"
      let geminiRaw = ""
      if (hasGemini) {
        try {
          const r = await fetch(`${GEMINI_API}?key=${geminiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "Respondé solo con la palabra: ok" }] }],
              generationConfig: {
                temperature: 0,
                maxOutputTokens: 500,
                thinkingConfig: { thinkingBudget: 0 }
              }
            })
          })
          const j = await r.json()
          geminiRaw = JSON.stringify(j).slice(0, 300)
          if (j.error) {
            geminiTest = `❌ Error ${j.error.code}: ${j.error.message}`
          } else if (j.candidates?.[0]?.content?.parts?.[0]?.text) {
            geminiTest = `✅ Funciona: "${j.candidates[0].content.parts[0].text}"`
          } else {
            geminiTest = `⚠️ Respuesta rara: ${geminiRaw}`
          }
        } catch (e) {
          geminiTest = `❌ Fetch error: ${(e as Error).message}`
        }
      }
      await sendMessage(chatId, telegramToken,
        `🔧 <b>Debug</b>\n\n` +
        `TELEGRAM_BOT_TOKEN: ${hasToken ? "✅" : "❌"}\n` +
        `GEMINI_API_KEY: ${hasGemini ? "✅ presente" : "❌ no configurada"}\n\n` +
        `Gemini test: ${geminiTest}`)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // ── PASO 5: Clasificar con Gemini y empezar flujo ────────────────────────
    const intent = await classifyWithGemini(text, geminiKey)

    // Debug temporal: si Gemini tuvo error, avisarlo
    if (intent._geminiError) {
      console.log("Gemini error (usando fallback keywords):", intent._geminiError)
    }

    if (!intent.section || (intent.confidence as number) < 0.5) {
      await sendMessage(chatId, telegramToken,
        `🤔 No entendí bien qué querés guardar.\n\n` +
        `Probá ser más específico. Por ejemplo:\n` +
        `• "tarea: estudiar capítulo 4"\n` +
        `• "evento: parcial álgebra el 20"\n` +
        `• "gasto: 3000 en transporte"\n\n` +
        `O escribí <b>/ayuda</b> para ver todos los ejemplos.`)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (intent.needs_clarification) {
      const clarQuestion = (intent.data as Record<string,unknown>)?.clarification as string
      await setState(supabase, chatId, { stage: "awaiting_clarification", original_text: text, user_id: userId })
      await sendMessage(chatId, telegramToken, clarQuestion || "¿Podés ser más específico?")
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // Guardar estado inicial con el draft
    const section = intent.section as string
    const draftState: Record<string, unknown> = { stage: "awaiting_followup", section, draft: intent, user_id: userId }

    // Verificar si necesita followup
    const followupQ = getFollowupQuestion(section, intent as Record<string,unknown>)

    if (followupQ) {
      await setState(supabase, chatId, draftState)
      await sendMessage(chatId, telegramToken,
        `🎯 Entendí: <b>${intent.data?.title || text}</b> → ${section}\n\n${followupQ}`)
    } else {
      // Ir directo a confirmación
      const confirmState = { ...draftState, stage: "awaiting_confirm" }
      await setState(supabase, chatId, confirmState)
      await sendMessage(chatId, telegramToken, formatConfirmMessage(section, intent as Record<string,unknown>), {
        inline_keyboard: [[
          { text: "✅ Sí, guardar", callback_data: "confirm_yes" },
          { text: "❌ No", callback_data: "confirm_no" },
          { text: "📁 Cambiar sección", callback_data: "change_section" },
        ]]
      })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })

  } catch (error) {
    console.error("Bot error:", error)
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message }), { status: 500 })
  }
})
