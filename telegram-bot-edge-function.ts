import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const TELEGRAM_API = "https://api.telegram.org"
const GEMINI_API   = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
const COLORS       = ["#8b6dff","#3ecf9a","#e8639b","#4ec5e8","#e8b04e","#f0764e","#6d8bff","#c264e8"]

// ─── Schema sh_data (blob único en tabla app_data, key="sh_data") ────────────
// tasks[]:    [{id, t, prio:"alta|media|baja", done, date?"YYYY-MM-DD", subject?}]
// missions[]: [{id, t, desc, prio, xp, subtasks:[{t, done}], expanded}]
// events[]:   [{id, title, date:"YYYY-MM-DD", day:number, color, desc}]
// journal[]:  [{id, date, time, text}]
// subjects[]: [{id, name, color, pct, profs[], notes, next, link, photo, files[], lists{}}]
// kitchen:    {heladera:[{id,title,sub,tag,warn}], almacen:[], freezer:[]}
// shopping[]: [{id, title, done}]
// finance:    {budget, expenses:[{id,cat,desc,monto,fecha,type}]}
// ocio[]:     [{id, emoji, title, type, status, score, note}]

// ─── Prompt de clasificación ──────────────────────────────────────────────────
const SECTION_INFO = `
Sos el asistente inteligente de StudyHub, app de productividad para estudiantes.

=== MODOS ===
- intent_type "add": el usuario quiere guardar algo
- intent_type "query": el usuario hace una pregunta sobre sus datos

=== SECCIONES ===

TAREAS (section: "tareas")
  Todo lo que hay que hacer, estudiar, entregar.
  Ej: "hacer ejercicios de álgebra" → add, tareas, subject: "Álgebra"

MISIONES (section: "misiones")
  Objetivos grandes con múltiples pasos. "quiero terminar", "proyecto de".

CALENDARIO (section: "calendario")
  Eventos con fecha. Parciales, finales, entregas, reuniones.

DIARIO (section: "diario")
  Notas libres, reflexiones, cosas que quiere recordar.

FACULTAD / MATERIAS (section: "facultad")
  Sub-secciones:
  - "nueva_materia": agregar una materia nueva
  - "tp": trabajo práctico → se guarda como tarea con materia
  - "nota_materia": anotación en una materia (needs subject)
  - "progreso": actualizar porcentaje (needs subject + pct)
  - "fecha_materia": actualizar próximo evento (needs subject)
  REGLA: "hacer ejercicios de X" → tareas. "TP de X", "anotar EN X" → facultad.

COCINA (section: "cocina")
  Sub-secciones: "heladera" | "almacen" | "freezer" | "compras"

FINANZAS (section: "finanzas")
  Gastos, ingresos. Cualquier monto de dinero.

OCIO (section: "ocio")
  Series, películas, videojuegos, libros, anime.
`

// ─── uid helper ────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9)

// ─── Telegram helpers ─────────────────────────────────────────────────────────
async function sendMessage(chatId: number | string, token: string, text: string, replyMarkup?: object) {
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "HTML" }
  if (replyMarkup) body.reply_markup = replyMarkup
  return fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function answerCallbackQuery(callbackId: string, token: string) {
  return fetch(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId }),
  })
}

// ─── State helpers (tabla telegram_state) ─────────────────────────────────────
async function getState(supabase: ReturnType<typeof createClient>, chatId: string) {
  const { data } = await supabase
    .from("telegram_state").select("state, updated_at").eq("chat_id", chatId).maybeSingle()
  if (!data?.state) return null
  if (Date.now() - new Date(data.updated_at || 0).getTime() > 30 * 60 * 1000) {
    await supabase.from("telegram_state").delete().eq("chat_id", chatId)
    return null
  }
  return data.state
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

// ─── sh_data helpers (blob único) ─────────────────────────────────────────────

function ensureArrays(d: any) {
  if (!Array.isArray(d.tasks))    d.tasks    = []
  if (!Array.isArray(d.missions)) d.missions = []
  if (!Array.isArray(d.events))   d.events   = []
  if (!Array.isArray(d.journal))  d.journal  = []
  if (!Array.isArray(d.subjects)) d.subjects = []
  if (!Array.isArray(d.shopping)) d.shopping = []
  if (!Array.isArray(d.ocio))     d.ocio     = []
  if (!d.kitchen || !Array.isArray(d.kitchen.heladera))
    d.kitchen = { heladera: [], almacen: [], freezer: [] }
  if (!d.finance)                       d.finance  = { budget: 200000, expenses: [] }
  if (!Array.isArray(d.finance.expenses)) d.finance.expenses = []
  return d
}

async function getShData(supabase: ReturnType<typeof createClient>, userId: string): Promise<any> {
  const { data } = await supabase
    .from("app_data").select("value").eq("user_id", userId).eq("key", "sh_data").maybeSingle()
  if (!data?.value) return ensureArrays({})
  const raw = typeof data.value === "string" ? JSON.parse(data.value) : data.value
  return ensureArrays(raw)
}

async function setShData(supabase: ReturnType<typeof createClient>, userId: string, blob: any) {
  await supabase.from("app_data").upsert(
    { user_id: userId, key: "sh_data", value: blob, updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" }
  )
}

// ─── Modo LECTURA: responder preguntas ─────────────────────────────────────────
async function handleQuery(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  section: string,
  queryData: Record<string, unknown>,
  geminiKey: string
): Promise<string> {
  const app = await getShData(supabase, userId)
  let rawData: unknown = null
  let contextLabel = section

  switch (section) {
    case "tareas":
      rawData = app.tasks.filter((t: any) => !t.done)
      contextLabel = "tareas pendientes (campo 't' = título, 'prio' = prioridad, 'subject' = materia)"
      break
    case "misiones":
      rawData = app.missions
      contextLabel = "misiones (campo 't' = título, 'subtasks' = pasos)"
      break
    case "calendario":
      rawData = app.events
      contextLabel = "eventos del calendario (campo 'title', 'date', 'desc')"
      break
    case "facultad":
      rawData = app.subjects
      contextLabel = "materias (campo 'name', 'pct' = progreso %, 'notes', 'next' = próximo evento)"
      break
    case "finanzas":
      rawData = app.finance
      contextLabel = "finanzas (campo 'budget' = presupuesto, 'expenses' = gastos con 'monto', 'desc', 'fecha')"
      break
    case "cocina":
      rawData = { heladera: app.kitchen.heladera, almacen: app.kitchen.almacen, freezer: app.kitchen.freezer, compras: app.shopping }
      contextLabel = "cocina"
      break
    case "ocio":
      rawData = app.ocio
      contextLabel = "ocio (campo 'title', 'type', 'status', 'score', 'note')"
      break
    case "diario":
      rawData = app.journal.slice(0, 10)
      contextLabel = "diario (entradas con 'date', 'text')"
      break
  }

  if (!rawData || (Array.isArray(rawData) && (rawData as any[]).length === 0)) {
    return `📭 No tenés datos guardados en ${section} todavía.`
  }

  try {
    const subject     = queryData.subject as string | undefined
    const question    = (queryData.query_text as string) || "Respondé con la info relevante"
    const prompt      = `Sos el asistente de StudyHub. El usuario preguntó: "${question}"
${subject ? `Contexto: sobre la materia "${subject}".` : ""}

Datos de ${contextLabel}:
${JSON.stringify(rawData, null, 2).slice(0, 3000)}

Respondé en español, claro y conciso. Máximo 5 líneas. Sin JSON en la respuesta.`

    const resp = await fetch(`${GEMINI_API}?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 500, thinkingConfig: { thinkingBudget: 0 } }
      })
    })
    const json = await resp.json()
    const answer = json.candidates?.[0]?.content?.parts?.[0]?.text
    if (answer) return `🤖 ${answer.trim()}`
  } catch (e) {
    console.log("Query Gemini error:", e)
  }
  return `📊 Encontré datos pero no pude procesarlos. Abrí la app para verlos.`
}

// ─── Clasificador por palabras clave (fallback sin Gemini) ────────────────────
function classifyByKeywords(text: string): Record<string, unknown> {
  const t = text.toLowerCase()
  if (/gasté|gaste|pagué|pague|costó|costo|\$\d|\d+\s*pesos/.test(t))
    return { intent_type:"add", section:"finanzas", confidence:0.8, data:{ title:text, amount:parseInt(text.match(/\d+/)?.[0]||"0"), type:"gasto", prio:"media" } }
  if (/comprar|lista de compras/.test(t))
    return { intent_type:"add", section:"cocina", confidence:0.8, data:{ title:text, subseccion:"compras" } }
  if (/heladera|nevera/.test(t))
    return { intent_type:"add", section:"cocina", confidence:0.8, data:{ title:text, subseccion:"heladera" } }
  if (/freezer|congelad/.test(t))
    return { intent_type:"add", section:"cocina", confidence:0.8, data:{ title:text, subseccion:"freezer" } }
  if (/almacen|almacén/.test(t))
    return { intent_type:"add", section:"cocina", confidence:0.8, data:{ title:text, subseccion:"almacen" } }
  if (/parcial|final|examen|entrega|reunión|reunion/.test(t))
    return { intent_type:"add", section:"calendario", confidence:0.8, data:{ title:text, prio:"alta" } }
  if (/misión|mision|quiero terminar|proyecto|objetivo/.test(t))
    return { intent_type:"add", section:"misiones", confidence:0.8, data:{ title:text, prio:"media", xp:1000 } }
  if (/anotar|nota:|recordar que/.test(t))
    return { intent_type:"add", section:"diario", confidence:0.85, data:{ title:text } }
  if (/estudiar|leer|hacer|tp |resolver|ejercicio|practica|práctica/.test(t))
    return { intent_type:"add", section:"tareas", confidence:0.8, data:{ title:text, prio:"media" } }
  if (/\?$|cuáles|cuales|qué tengo|que tengo|cuánto|cuanto/.test(t))
    return { intent_type:"query", section:"tareas", confidence:0.7, data:{ query_text:text } }
  return { intent_type:"add", section:null, confidence:0.3, data:{ title:text } }
}

// ─── Gemini: clasificar intención ─────────────────────────────────────────────
async function classifyWithGemini(
  text: string,
  geminiKey: string,
  supabase?: ReturnType<typeof createClient>,
  userId?: string
): Promise<Record<string, unknown>> {
  if (!geminiKey) return classifyByKeywords(text)

  let userContext = ""
  if (supabase && userId) {
    try {
      const app = await getShData(supabase, userId)
      if (app.subjects?.length > 0) {
        userContext = `\nMATERIAS DEL USUARIO: ${app.subjects.map((s: any) => s.name).join(", ")}`
      }
    } catch (_) {}
  }

  try {
    const response = await fetch(`${GEMINI_API}?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SECTION_INFO}${userContext}

Mensaje del usuario: "${text}"

Respondé SOLO con un JSON (sin markdown):
{
  "intent_type": "add|query",
  "section": "tareas|misiones|calendario|diario|facultad|cocina|finanzas|ocio",
  "data": {
    "title": "texto principal",
    "desc": "descripción adicional o vacío",
    "subject": "nombre de la materia si aplica, o null",
    "subseccion": "para cocina: heladera|almacen|freezer|compras. Para facultad: nueva_materia|tp|nota_materia|progreso|fecha_materia. O null",
    "date": "YYYY-MM-DD o null",
    "prio": "alta|media|baja",
    "xp": 1000,
    "amount": null,
    "type": null,
    "pct": null,
    "query_text": "la pregunta original si es query, o null"
  },
  "confidence": 0.9,
  "needs_clarification": false
}
Si es ambiguo (confidence < 0.6), poné needs_clarification: true y data.clarification con la pregunta a hacer.` }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 0 } }
      })
    })

    const json = await response.json()
    if (json.error) {
      console.log("Gemini API error:", json.error.message)
      return { ...classifyByKeywords(text), _geminiError: json.error.message }
    }
    const raw     = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    return JSON.parse(cleaned)
  } catch (e) {
    console.log("Gemini fetch error:", (e as Error).message)
    return classifyByKeywords(text)
  }
}

// ─── Followups según sección ──────────────────────────────────────────────────
function getFollowupQuestion(section: string, draft: Record<string, unknown>): string | null {
  const data = (draft.data || {}) as Record<string, unknown>
  if (section === "misiones")
    return `📋 ¿Querés agregarle pasos/subtareas a esta misión?\nMandálos separados por coma o escribí <b>no</b>.`
  if (section === "tareas" && !data.date)
    return `📅 ¿Para cuándo es? (ej: "lunes", "15 de julio") O escribí <b>sin fecha</b>.`
  if (section === "calendario" && !data.date)
    return `📅 ¿Qué día es el evento?`
  if (section === "finanzas" && !data.amount)
    return `💰 ¿Cuánto fue el gasto? (solo el número)`
  if (section === "cocina" && !data.subseccion)
    return `🍽️ ¿Dónde lo guardo?\n\n<b>heladera</b> · <b>almacen</b> · <b>freezer</b> · <b>compras</b>`
  if (section === "facultad" && !data.subseccion)
    return `📚 ¿Qué tipo de cosa es?\n\n<b>tp</b> · <b>anotacion</b> · <b>nueva materia</b> · <b>progreso</b>`
  if (section === "facultad" && (data.subseccion === "tp" || data.subseccion === "nota_materia") && !data.subject)
    return `📚 ¿Para qué materia?`
  return null
}

// ─── Parsear fecha en español ──────────────────────────────────────────────────
function parseSpanishDate(text: string): string | null {
  if (!text) return null
  const t = text.toLowerCase().trim()
  if (t === "hoy") return new Date().toISOString().slice(0, 10)
  if (t === "mañana") { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) }
  const MONTHS: Record<string, number> = { enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,octubre:9,noviembre:10,diciembre:11 }
  for (const [name, idx] of Object.entries(MONTHS)) {
    const match = t.match(new RegExp(`(\\d{1,2})\\s+(?:de\\s+)?${name}`))
    if (match) {
      const now = new Date()
      const d   = new Date(now.getFullYear(), idx, parseInt(match[1]))
      if (d < now) d.setFullYear(d.getFullYear() + 1)
      return d.toISOString().slice(0, 10)
    }
  }
  const DAYS: Record<string, number> = { lunes:1,martes:2,miércoles:3,miercoles:3,jueves:4,viernes:5,sábado:6,sabado:6,domingo:0 }
  for (const [name, dayIdx] of Object.entries(DAYS)) {
    if (t.includes(name)) {
      const now  = new Date()
      const diff = (dayIdx - now.getDay() + 7) % 7 || 7
      const d    = new Date(now); d.setDate(d.getDate() + diff)
      return d.toISOString().slice(0, 10)
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  return null
}

// ─── Construir y guardar item ──────────────────────────────────────────────────
async function buildAndSave(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  section: string,
  draft: Record<string, unknown>,
  subtasks?: string[]
): Promise<string> {
  const data = (draft.data || {}) as Record<string, unknown>
  const app  = await getShData(supabase, userId) // leer blob completo

  // ── TAREAS ──
  if (section === "tareas") {
    const title = (data.title as string) || "Tarea sin nombre"
    app.tasks.push({
      id: uid(), t: title,
      prio: (data.prio as string) || "media",
      done: false,
      date: (data.date as string) || null,
      subject: (data.subject as string) || null,
    })
    await setShData(supabase, userId, app)
    return `✅ Tarea guardada${data.subject ? ` (${data.subject})` : ""}. Ya aparece en la app.`
  }

  // ── MISIONES ──
  if (section === "misiones") {
    const subs = (subtasks || []).filter(Boolean).map(t => ({ t: t.trim(), done: false }))
    app.missions.push({
      id: uid(), t: (data.title as string) || "Nueva misión",
      desc: (data.desc as string) || "",
      prio: (data.prio as string) || "media",
      xp: (data.xp as number) || 1000,
      subtasks: subs,
      expanded: true,
    })
    await setShData(supabase, userId, app)
    return `✅ Misión guardada${subs.length ? ` con ${subs.length} subtarea(s)` : ""}. Ya aparece en la app.`
  }

  // ── CALENDARIO ──
  if (section === "calendario") {
    const dateStr = (data.date as string) || new Date().toISOString().slice(0, 10)
    const dayNum  = parseInt(dateStr.split("-")[2]) || new Date().getDate()
    app.events.push({
      id: uid(), title: (data.title as string) || "Evento",
      date: dateStr, day: dayNum,
      color: "#8b6dff", desc: (data.desc as string) || "",
    })
    await setShData(supabase, userId, app)
    return `✅ Evento guardado en el calendario. Ya aparece en la app.`
  }

  // ── DIARIO ──
  if (section === "diario") {
    const now     = new Date()
    const dateStr = now.toLocaleDateString("es-AR", { weekday:"long", day:"numeric", month:"long" })
    const timeStr = now.toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" })
    app.journal.unshift({
      id: uid(),
      date: `${dateStr} · vía Telegram`,
      time: timeStr,
      text: (data.title as string) || "",
    })
    await setShData(supabase, userId, app)
    return `✅ Anotación guardada en tu diario.`
  }

  // ── FACULTAD ──
  if (section === "facultad") {
    const subseccion = data.subseccion as string

    if (subseccion === "nueva_materia") {
      const name = (data.title as string) || "Nueva Materia"
      app.subjects.push({
        id: uid(), name,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        pct: 0, profs: [], files: [],
        notes: "", next: "", link: "", photo: null,
        board: null, boardMode: false, showDots: true, lists: {},
      })
      await setShData(supabase, userId, app)
      return `✅ Materia "${name}" agregada. Ya aparece en Facultad.`
    }

    if (subseccion === "tp") {
      // Los TPs se guardan como tareas con el subject correspondiente
      const title = (data.title as string) || "TP sin título"
      app.tasks.push({
        id: uid(), t: title,
        prio: "alta",
        done: false,
        date: (data.date as string) || null,
        subject: (data.subject as string) || null,
      })
      await setShData(supabase, userId, app)
      return `✅ TP "${title}" guardado como tarea${data.subject ? ` en ${data.subject}` : ""}. Ya aparece en Tareas.`
    }

    // Resto de subsecciones → buscar materia por nombre
    const subjectName = ((data.subject || data.title) as string || "").toLowerCase()
    const idx = app.subjects.findIndex((s: any) => s.name.toLowerCase().includes(subjectName))
    if (idx === -1) {
      return `❌ No encontré la materia "${data.subject || data.title}". Verificá el nombre en la app.`
    }
    const subj = app.subjects[idx]

    if (subseccion === "nota_materia") {
      const today = new Date().toLocaleDateString("es-AR")
      subj.notes = subj.notes
        ? `${subj.notes}\n[${today} vía Telegram] ${data.title}`
        : `[${today} vía Telegram] ${data.title}`
      await setShData(supabase, userId, app)
      return `✅ Anotación guardada en ${subj.name}.`
    }

    if (subseccion === "progreso") {
      const newPct = Math.min(100, Math.max(0, (data.pct as number) || 0))
      subj.pct = newPct
      await setShData(supabase, userId, app)
      return `✅ Progreso de ${subj.name} actualizado a ${newPct}%.`
    }

    if (subseccion === "fecha_materia") {
      subj.next = (data.title as string) || (data.date as string) || ""
      await setShData(supabase, userId, app)
      return `✅ Próximo evento de ${subj.name} actualizado.`
    }

    return `❌ No entendí qué guardar en Facultad. Probá: "nuevo TP de álgebra: práctica 5" o "anotar en filosofía: xyz".`
  }

  // ── COCINA ──
  if (section === "cocina") {
    const sub = (data.subseccion as string) || "heladera"
    if (sub === "compras") {
      app.shopping.push({ id: uid(), title: (data.title as string) || "Item", done: false })
    } else {
      const key = sub as "heladera" | "almacen" | "freezer"
      if (!Array.isArray(app.kitchen[key])) app.kitchen[key] = []
      app.kitchen[key].push({
        id: uid(), title: (data.title as string) || "Alimento",
        sub: (data.desc as string) || "", tag: "", warn: false,
      })
    }
    await setShData(supabase, userId, app)
    const labels: Record<string, string> = { heladera:"heladera 🧊", almacen:"almacén 📦", freezer:"freezer ❄️", compras:"lista de compras 🛒" }
    return `✅ Guardado en ${labels[sub] || sub}. Ya aparece en Cocina.`
  }

  // ── FINANZAS ──
  if (section === "finanzas") {
    app.finance.expenses.push({
      id: uid(), cat: "otros",
      desc: (data.title as string) || "Gasto",
      monto: (data.amount as number) || 0,
      fecha: new Date().toISOString().slice(0, 10),
      type: (data.type as string) || "gasto",
    })
    await setShData(supabase, userId, app)
    return `✅ ${data.type === "ingreso" ? "Ingreso" : "Gasto"} guardado en Finanzas.`
  }

  // ── OCIO ──
  if (section === "ocio") {
    app.ocio.push({
      id: uid(), emoji: "📺",
      title: (data.title as string) || "Contenido",
      type: "serie", status: "pendiente", score: 0,
      note: (data.desc as string) || "",
    })
    await setShData(supabase, userId, app)
    return `✅ Guardado en Ocio.`
  }

  return `❌ No pude guardar. Sección desconocida: ${section}.`
}

// ─── Mensaje de confirmación ──────────────────────────────────────────────────
function formatConfirmMessage(section: string, draft: Record<string, unknown>): string {
  const data = (draft.data || {}) as Record<string, unknown>
  const emoji: Record<string,string> = { tareas:"✅",misiones:"⚡",calendario:"📅",diario:"📖",facultad:"📚",cocina:"🍽️",finanzas:"💰",ocio:"🎬" }
  const name:  Record<string,string> = { tareas:"Tareas",misiones:"Misiones",calendario:"Calendario",diario:"Diario",facultad:"Facultad",cocina:"Cocina",finanzas:"Finanzas",ocio:"Ocio" }
  const subsLabel: Record<string,string> = {
    heladera:"Heladera 🧊", almacen:"Almacén 📦", freezer:"Freezer ❄️", compras:"Lista de compras 🛒",
    nueva_materia:"Nueva materia", tp:"Trabajo Práctico", nota_materia:"Anotación", progreso:"Progreso %", fecha_materia:"Próximo evento",
  }
  const prioIcon: Record<string,string> = { alta:"🔴", media:"🟡", baja:"🟢" }

  let details = `<b>${data.title as string || "Item"}</b>`
  if (data.subject)    details += `\n📚 Materia: ${data.subject}`
  if (data.subseccion) details += `\n📁 ${subsLabel[data.subseccion as string] || data.subseccion}`
  if (data.desc)       details += `\n📝 ${data.desc}`
  if (data.date)       details += `\n📅 ${data.date}`
  if (data.prio)       details += `\n${prioIcon[data.prio as string] || "⚪"} Prioridad ${data.prio}`
  if (data.pct)        details += `\n📊 ${data.pct}% de progreso`
  if (data.amount)     details += `\n💰 $${data.amount} (${data.type || "gasto"})`

  return `${emoji[section]||"📌"} <b>${name[section]||section}</b>\n\n${details}\n\n¿Guardamos esto?`
}

const CONFIRM_KEYBOARD = {
  inline_keyboard: [[
    { text: "✅ Sí, guardar",       callback_data: "confirm_yes"     },
    { text: "❌ No",                 callback_data: "confirm_no"      },
    { text: "📁 Cambiar sección",   callback_data: "change_section"  },
  ]]
}

// ─── Handler principal ────────────────────────────────────────────────────────
serve(async (req) => {
  try {
    const body          = await req.json()
    const supabase      = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!
    const geminiKey     = Deno.env.get("GEMINI_API_KEY")!

    // ── Callback query (botones inline) ─────────────────────────────────────
    if (body.callback_query) {
      const cq           = body.callback_query
      const chatId       = cq.message.chat.id.toString()
      const callbackData = cq.data as string
      await answerCallbackQuery(cq.id, telegramToken)
      const state = await getState(supabase, chatId)

      if (!state) {
        await sendMessage(chatId, telegramToken, "❓ No encontré nada pendiente. Mandame algo nuevo.")
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      if (callbackData === "confirm_yes" && state.stage === "awaiting_confirm") {
        const result = await buildAndSave(supabase, state.user_id as string, state.section as string, state.draft as Record<string,unknown>, state.subtasks as string[]|undefined)
        await setState(supabase, chatId, null)
        await sendMessage(chatId, telegramToken, result)

      } else if (callbackData === "confirm_no") {
        await setState(supabase, chatId, null)
        await sendMessage(chatId, telegramToken, "❌ Cancelado.")

      } else if (callbackData === "change_section") {
        await setState(supabase, chatId, { ...state, stage: "awaiting_section_change" })
        await sendMessage(chatId, telegramToken, "📁 ¿A qué sección lo mando?\n\n<b>tareas · misiones · calendario · diario · facultad · cocina · finanzas · ocio</b>")
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // ── Mensaje de texto ─────────────────────────────────────────────────────
    const message = body.message
    if (!message) return new Response(JSON.stringify({ ok: true }), { status: 200 })
    const chatId = message.chat.id.toString()
    const text   = (message.text || "").trim()
    if (!text) return new Response(JSON.stringify({ ok: true }), { status: 200 })

    // ── Vinculación SH-XXXX ──────────────────────────────────────────────────
    if (/^SH-[A-Z0-9]{4}$/i.test(text)) {
      const code = text.toUpperCase()
      const { data: pendingLink } = await supabase
        .from("telegram_links").select("user_id").eq("link_code", code).eq("linked", false).maybeSingle()
      if (!pendingLink) {
        await sendMessage(chatId, telegramToken, "❌ Código inválido o ya usado. Generá uno nuevo desde la app.")
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      await supabase.from("telegram_links")
        .update({ linked: true, telegram_chat_id: chatId, updated_at: new Date().toISOString() })
        .eq("link_code", code)
      await sendMessage(chatId, telegramToken,
        `✅ <b>¡Vinculación exitosa!</b>\n\nAhora podés mandarme cualquier cosa en lenguaje natural:\n\n` +
        `• "hacer ejercicios de álgebra"\n• "parcial de análisis el 15 de julio"\n• "gasté 3000 en fotocopias"\n` +
        `• "nuevo TP de álgebra: práctica 5"\n• "¿qué tareas tengo pendientes?"\n\n` +
        `🎯 ¡Empezá!`)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // ── Chequear vínculo ─────────────────────────────────────────────────────
    const { data: link } = await supabase
      .from("telegram_links").select("user_id").eq("telegram_chat_id", chatId).eq("linked", true).maybeSingle()
    if (!link) {
      await sendMessage(chatId, telegramToken,
        "🔗 <b>Tu cuenta no está vinculada.</b>\n\nAbrí StudyHub → Configuración → Integraciones → Telegram, generá el código y mandámelo acá.")
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    const userId = link.user_id as string

    // ── Estado activo (conversación en curso) ────────────────────────────────
    const state = await getState(supabase, chatId)
    if (state) {
      const stage   = state.stage as string
      const draft   = state.draft as Record<string,unknown>
      const section = state.section as string

      if (stage === "awaiting_section_change") {
        const valid      = ["tareas","misiones","calendario","diario","facultad","cocina","finanzas","ocio"]
        const newSection = text.toLowerCase().trim()
        if (valid.includes(newSection)) {
          const followup = getFollowupQuestion(newSection, draft)
          if (followup) {
            await setState(supabase, chatId, { ...state, stage: "awaiting_followup", section: newSection })
            await sendMessage(chatId, telegramToken, followup)
          } else {
            await setState(supabase, chatId, { ...state, stage: "awaiting_confirm", section: newSection })
            await sendMessage(chatId, telegramToken, formatConfirmMessage(newSection, draft), CONFIRM_KEYBOARD)
          }
        } else {
          await sendMessage(chatId, telegramToken, "❓ Opciones: tareas · misiones · calendario · diario · facultad · cocina · finanzas · ocio")
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      if (stage === "awaiting_followup") {
        let updatedDraft = { ...draft }
        let subtasks     = state.subtasks as string[] | undefined
        const data       = (draft.data || {}) as Record<string, unknown>

        if (section === "misiones") {
          if (text.toLowerCase() !== "no")
            subtasks = text.split(",").map((t: string) => t.trim()).filter(Boolean)
        } else if (section === "tareas" || section === "calendario") {
          if (!["sin fecha","no tengo","nada"].some(s => text.toLowerCase().includes(s))) {
            const parsedDate = parseSpanishDate(text) || text
            updatedDraft = { ...draft, data: { ...data, date: parsedDate } }
          }
        } else if (section === "finanzas") {
          const num = parseFloat(text.replace(/[^\d.,]/g,"").replace(",","."))
          if (!isNaN(num)) updatedDraft = { ...draft, data: { ...data, amount: num } }
        } else if (section === "cocina") {
          const subMap: Record<string,string> = { heladera:"heladera", almacen:"almacen", almacén:"almacen", freezer:"freezer", compras:"compras", lista:"compras" }
          const sub = Object.keys(subMap).find(k => text.toLowerCase().includes(k))
          if (sub) updatedDraft = { ...draft, data: { ...data, subseccion: subMap[sub] } }
        } else if (section === "facultad") {
          const tt = text.toLowerCase()
          if (tt.includes("tp") || tt.includes("trabajo"))       updatedDraft = { ...draft, data: { ...data, subseccion: "tp" } }
          else if (tt.includes("anot") || tt.includes("nota"))   updatedDraft = { ...draft, data: { ...data, subseccion: "nota_materia" } }
          else if (tt.includes("nueva") || tt.includes("materia")) updatedDraft = { ...draft, data: { ...data, subseccion: "nueva_materia" } }
          else if (tt.includes("progreso") || tt.includes("%"))  updatedDraft = { ...draft, data: { ...data, subseccion: "progreso" } }
          else if (!data.subject) updatedDraft = { ...draft, data: { ...data, subject: text.trim() } }
        }

        const nextFollowup = getFollowupQuestion(section, updatedDraft)
        if (nextFollowup && nextFollowup !== getFollowupQuestion(section, draft)) {
          await setState(supabase, chatId, { ...state, draft: updatedDraft, subtasks })
          await sendMessage(chatId, telegramToken, nextFollowup)
        } else {
          await setState(supabase, chatId, { ...state, stage: "awaiting_confirm", draft: updatedDraft, subtasks })
          await sendMessage(chatId, telegramToken, formatConfirmMessage(section, updatedDraft), CONFIRM_KEYBOARD)
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      if (stage === "awaiting_confirm") {
        const t = text.toLowerCase()
        if (["sí","si","yes","dale","ok","guardar"].some(w => t.includes(w))) {
          const result = await buildAndSave(supabase, userId, section, draft, state.subtasks as string[]|undefined)
          await setState(supabase, chatId, null)
          await sendMessage(chatId, telegramToken, result)
        } else if (["no","cancelar"].some(w => t.includes(w))) {
          await setState(supabase, chatId, null)
          await sendMessage(chatId, telegramToken, "❌ Cancelado.")
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
    }

    // ── Comandos ─────────────────────────────────────────────────────────────
    if (text === "/start") {
      const { data: existingLink } = await supabase
        .from("telegram_links").select("linked").eq("telegram_chat_id", chatId).eq("linked", true).maybeSingle()
      if (existingLink) {
        await sendMessage(chatId, telegramToken,
          `👋 <b>¡Ya estás conectado a StudyHub!</b>\n\n` +
          `Mandame cualquier cosa en lenguaje natural:\n\n` +
          `📝 "hacer ejercicios de álgebra"\n📅 "parcial de análisis el 20 de julio"\n💰 "gasté 3000 en fotocopias"\n🔍 "¿qué tareas tengo pendientes?"\n\n` +
          `Escribí /ayuda para más ejemplos.`)
      } else {
        await sendMessage(chatId, telegramToken,
          `✨ <b>¡Hola! Soy Hubby, tu asistente de StudyHub.</b>\n\n` +
          `Para empezar, vinculá tu cuenta:\n\n` +
          `1. Abrí StudyHub\n2. Configuración → Integraciones → Telegram\n3. Generá tu código <b>SH-XXXX</b>\n4. Mandámelo acá\n\n🚀`)
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (text === "/ayuda" || text === "/help") {
      await sendMessage(chatId, telegramToken,
        `🤖 <b>Hubby — Asistente de StudyHub</b>\n\n` +
        `📝 <b>Guardar:</b>\n• "hacer ejercicios de álgebra"\n• "nuevo TP de álgebra: práctica 5"\n` +
        `• "anotar en filosofía: temas del parcial son X y Y"\n• "parcial de análisis el 20 de julio"\n` +
        `• "gasté 3000 en fotocopias"\n• "comprar pan y leche"\n• "metí empanadas al freezer"\n\n` +
        `🔍 <b>Consultar:</b>\n• "¿qué tareas tengo pendientes?"\n• "¿cuáles son los temas de filosofía?"\n` +
        `• "¿cuánto gasté este mes?"\n\n⚙️ /cancelar para cancelar una operación`)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (text === "/cancelar") {
      await setState(supabase, chatId, null)
      await sendMessage(chatId, telegramToken, "✅ Operación cancelada.")
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (text === "/debug") {
      const hasGemini = !!geminiKey
      let geminiTest  = "no probado"
      if (hasGemini) {
        try {
          const r = await fetch(`${GEMINI_API}?key=${geminiKey}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "Respondé solo con la palabra: ok" }] }],
              generationConfig: { temperature: 0, maxOutputTokens: 10, thinkingConfig: { thinkingBudget: 0 } }
            })
          })
          const j = await r.json()
          if (j.error)                                    geminiTest = `❌ ${j.error.code}: ${j.error.message}`
          else if (j.candidates?.[0]?.content?.parts?.[0]?.text) geminiTest = `✅ "${j.candidates[0].content.parts[0].text}"`
          else                                            geminiTest = `⚠️ Respuesta rara`
        } catch (e) { geminiTest = `❌ ${(e as Error).message}` }
      }
      // Chequear que el usuario tiene sh_data en la BD
      let dataTest = "no verificado"
      try {
        const app = await getShData(supabase, userId)
        const counts = `tareas:${app.tasks.length} misiones:${app.missions.length} eventos:${app.events.length} materias:${app.subjects.length}`
        dataTest = `✅ sh_data encontrado — ${counts}`
      } catch (e) { dataTest = `❌ ${(e as Error).message}` }
      await sendMessage(chatId, telegramToken,
        `🔧 <b>Debug</b>\n\nTELEGRAM_BOT_TOKEN: ${!!telegramToken ? "✅" : "❌"}\nGEMINI_API_KEY: ${hasGemini ? "✅" : "❌"}\nGemini test: ${geminiTest}\n\nDatos: ${dataTest}`)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // ── Clasificar con Gemini ────────────────────────────────────────────────
    const intent = await classifyWithGemini(text, geminiKey, supabase, userId)

    // Modo QUERY
    if (intent.intent_type === "query") {
      const answer = await handleQuery(supabase, userId, intent.section as string, (intent.data || {}) as Record<string,unknown>, geminiKey)
      await sendMessage(chatId, telegramToken, answer)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // Baja confianza
    if (!intent.section || (intent.confidence as number) < 0.5) {
      await sendMessage(chatId, telegramToken,
        `🤔 No entendí bien. Probá:\n• "tarea: estudiar capítulo 4"\n• "parcial de álgebra el 15 de julio"\n• "gasto: 3000 en transporte"\n• "¿qué tengo pendiente?"\n\nO /ayuda.`)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (intent.needs_clarification) {
      const q = (intent.data as Record<string,unknown>)?.clarification as string
      await setState(supabase, chatId, { stage: "awaiting_clarification", original_text: text, user_id: userId })
      await sendMessage(chatId, telegramToken, q || "¿Podés ser más específico?")
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    const section   = intent.section as string
    const followupQ = getFollowupQuestion(section, intent as Record<string,unknown>)

    if (followupQ) {
      await setState(supabase, chatId, { stage: "awaiting_followup", section, draft: intent, user_id: userId })
      await sendMessage(chatId, telegramToken,
        `🎯 Entendí: <b>${(intent.data as Record<string,unknown>)?.title || text}</b> → ${section}\n\n${followupQ}`)
    } else {
      await setState(supabase, chatId, { stage: "awaiting_confirm", section, draft: intent, user_id: userId })
      await sendMessage(chatId, telegramToken, formatConfirmMessage(section, intent as Record<string,unknown>), CONFIRM_KEYBOARD)
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })

  } catch (error) {
    console.error("Bot error:", error)
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message }), { status: 500 })
  }
})
