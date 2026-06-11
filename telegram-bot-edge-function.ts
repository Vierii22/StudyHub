import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const TELEGRAM_API = "https://api.telegram.org"
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

// ─── Formas exactas de la app ─────────────────────────────────────────────────
// studyhub_v3_tasks:    [{id,name,avClass,initials,progress,xp,status,statusTone,done,createdAt,dueDate?,subjectName?}]
// studyhub_v3_missions: [{id,title,desc,priority,xp,done,tasks:[{id,text,done}]}]
// studyhub_v3_calendar: [{id,title,date,color,desc}]
// studyhub_v3_diary:    string
// studyhub_v3_subjects: [{id,name,code,pct,prof,next,color,notes,tp:[{id,title,desc,done,dueDate}]}]
// studyhub_v3_kitchen:  [{id,title,sub,tag,warn,section:'heladera'}]
// studyhub_v3_almacen:  [{id,title,sub,tag,warn,section:'almacen'}]
// studyhub_v3_freezer:  [{id,title,sub,tag,warn,section:'freezer'}]
// studyhub_v3_groceries:[{id,title,done}]
// studyhub_fin_v1:      {presupuesto,gastos:[{id,cat,desc,monto,fecha}],metas:[],mes,anio}
// studyhub_ocio_v1:     [{id,emoji,title,type,status,score,note}]

const SECTION_INFO = `
Sos el asistente inteligente de StudyHub, una app de productividad para estudiantes universitarios.

=== MODOS ===
- intent_type "add": el usuario quiere guardar algo
- intent_type "query": el usuario hace una pregunta sobre sus datos ("¿qué tengo pendiente?", "¿cuáles son los temas?", "¿cuánto gasté?")

=== SECCIONES Y SUB-SECCIONES ===

TAREAS (section: "tareas")
  Cualquier cosa a hacer, estudiar, entregar, resolver.
  Cuando se menciona una materia, va en el campo "subject" y en el title.
  Ej: "hacer ejercicios de álgebra" → title: "Ejercicios de Álgebra", subject: "Álgebra"

MISIONES (section: "misiones")
  Objetivos grandes con múltiples pasos. "quiero terminar", "proyecto de", "objetivo largo".

CALENDARIO (section: "calendario")
  Eventos con fecha. Parciales, finales, entregas, reuniones.

DIARIO (section: "diario")
  Notas libres, reflexiones, "anotar que", "recordar que".

FACULTAD / MATERIAS (section: "facultad")
  Sub-secciones:
  - "nueva_materia": agregar una materia nueva. Ej: "agregar la materia física"
  - "tp": agregar un trabajo práctico a una materia. Ej: "nuevo TP de álgebra: práctica 5"
  - "nota_materia": guardar anotación en una materia. Ej: "anotar en filosofía: los temas son X y Z"
  - "progreso": actualizar progreso de una materia. Ej: "completé 80% de álgebra"
  - "fecha_materia": actualizar próximo evento de materia. Ej: "parcial de álgebra el 20 de junio"
  REGLA: mencionar una materia con algo que hacer → TAREAS. Mencionar materia con "anotar EN", "agregar A", "TP de" → FACULTAD.

COCINA (section: "cocina")
  Sub-secciones (campo "subseccion"):
  - "heladera": alimentos frescos en heladera
  - "almacen": productos secos, enlatados, bebidas
  - "freezer": alimentos congelados
  - "compras": lista de cosas para comprar
  Ej: "tengo leche en la heladera" → subseccion: "heladera"
  Ej: "comprar pan y leche" → subseccion: "compras"
  Ej: "metí empanadas al freezer" → subseccion: "freezer"
  Si no queda claro dónde va → needs_clarification: true

FINANZAS (section: "finanzas")
  Gastos, ingresos, presupuesto. Cualquier monto de dinero.

OCIO (section: "ocio")
  Series, películas, videojuegos, libros, anime.

=== EJEMPLOS ===
"hacer ejercicios de álgebra" → add, tareas, subject: "Álgebra"
"nuevo TP de análisis: práctica 5" → add, facultad, subseccion: "tp", subject: "Análisis"
"anotar en filosofía: los temas son Kant y Hegel" → add, facultad, subseccion: "nota_materia"
"parcial de álgebra el 15 de julio" → add, calendario
"gasté 3000 en fotocopias" → add, finanzas
"comprar pan, leche, huevos" → add, cocina, subseccion: "compras"
"metí arroz al almacén" → add, cocina, subseccion: "almacen"
"agregar la materia química" → add, facultad, subseccion: "nueva_materia"
"¿qué tareas tengo pendientes?" → query, tareas
"¿cuáles son los temas del parcial de filosofía?" → query, facultad, subject: "Filosofía"
"¿cuánto gasté este mes?" → query, finanzas
`

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

async function getState(supabase: ReturnType<typeof createClient>, chatId: string) {
  const { data } = await supabase
    .from("telegram_state").select("state, updated_at").eq("chat_id", chatId).maybeSingle()
  if (!data?.state) return null
  const updatedAt = new Date(data.updated_at || 0).getTime()
  if (Date.now() - updatedAt > 30 * 60 * 1000) {
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

async function getAppData(supabase: ReturnType<typeof createClient>, userId: string, key: string) {
  const { data } = await supabase.from("app_data").select("value").eq("user_id", userId).eq("key", key).maybeSingle()
  return data?.value ?? null
}

async function appendToAppData(supabase: ReturnType<typeof createClient>, userId: string, key: string, newItem: object) {
  const { data } = await supabase.from("app_data").select("value").eq("user_id", userId).eq("key", key).maybeSingle()
  const arr = Array.isArray(data?.value) ? data.value : []
  arr.push(newItem)
  await supabase.from("app_data").upsert(
    { user_id: userId, key, value: arr, updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" }
  )
}

async function upsertAppData(supabase: ReturnType<typeof createClient>, userId: string, key: string, value: unknown) {
  await supabase.from("app_data").upsert(
    { user_id: userId, key, value, updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" }
  )
}

async function appendToDiary(supabase: ReturnType<typeof createClient>, userId: string, text: string) {
  const { data } = await supabase.from("app_data").select("value").eq("user_id", userId).eq("key", "studyhub_v3_diary").maybeSingle()
  const current = typeof data?.value === "string" ? data.value : ""
  const today = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
  const newText = current ? `${current}\n\n[${today} vía Telegram]\n${text}` : `[${today} vía Telegram]\n${text}`
  await upsertAppData(supabase, userId, "studyhub_v3_diary", newText)
}

// ─── Modo LECTURA: responder preguntas sobre los datos ────────────────────────

async function handleQuery(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  section: string,
  data: Record<string, unknown>,
  geminiKey: string
): Promise<string> {
  let rawData: unknown = null
  let contextLabel = section

  if (section === "tareas") {
    rawData = await getAppData(supabase, userId, "studyhub_v3_tasks")
    contextLabel = "tareas"
  } else if (section === "misiones") {
    rawData = await getAppData(supabase, userId, "studyhub_v3_missions")
    contextLabel = "misiones"
  } else if (section === "calendario") {
    rawData = await getAppData(supabase, userId, "studyhub_v3_calendar")
    contextLabel = "calendario"
  } else if (section === "facultad") {
    rawData = await getAppData(supabase, userId, "studyhub_v3_subjects")
    contextLabel = "materias"
  } else if (section === "finanzas") {
    rawData = await getAppData(supabase, userId, "studyhub_fin_v1")
    contextLabel = "finanzas"
  } else if (section === "cocina") {
    const hel = await getAppData(supabase, userId, "studyhub_v3_kitchen") || []
    const alm = await getAppData(supabase, userId, "studyhub_v3_almacen") || []
    const fre = await getAppData(supabase, userId, "studyhub_v3_freezer") || []
    const comp = await getAppData(supabase, userId, "studyhub_v3_groceries") || []
    rawData = { heladera: hel, almacen: alm, freezer: fre, compras: comp }
    contextLabel = "cocina"
  } else if (section === "ocio") {
    rawData = await getAppData(supabase, userId, "studyhub_ocio_v1")
    contextLabel = "ocio"
  } else if (section === "diario") {
    rawData = await getAppData(supabase, userId, "studyhub_v3_diary")
    contextLabel = "diario"
  }

  if (!rawData || (Array.isArray(rawData) && rawData.length === 0)) {
    return `📭 No tenés datos guardados en ${contextLabel} todavía.`
  }

  // Usar Gemini para generar respuesta natural basada en los datos
  try {
    const subject = data.subject as string | undefined
    const question = data.query_text as string || "Respondé con la info relevante"
    const APP_GUIDE = `=== MANUAL DE USO DE STUDYHUB ===
SECCIONES: Dashboard (widgets XP/racha/tareas/eventos), Facultad (materias con pizarrón), Tareas (filtros por materia/prioridad), Misiones (XP gamificado), Calendario (eventos + .ics), Pomodoro (25min foco), Chat IA (Gemini con contexto del usuario), Diario (registro + sueño/energía), Mi Espacio (pizarrón libre), Cocina, Finanzas, Casa, Ocio, Configuración.
CÓMO HACER COSAS COMUNES: Agregar materia → Facultad → "+ Nueva materia". Agregar tarea → Tareas → campo de abajo + Enter, o botón "+". Ver progreso → Facultad → porcentaje en cada materia. Pizarrón de materia → Facultad → click materia → activar "Modo pizarrón". Personalizar dashboard → Config > Dashboard → "Abrir editor". Cambiar tema/colores → Config > Apariencia → selector de Tema (Medianoche/Papel/Terminal/Sakura/Océano). Conectar Telegram → Config > Integraciones → generar código → @Hubby_ia_bot. Command palette → Ctrl+K (busca secciones, tareas, materias o crea desde texto libre). Tab bar en celular → íconos en la parte de abajo. Instalar como app → Config > Acerca de → "Instalar como app".
BOT DE TELEGRAM — COMANDOS: /tareas (ver pendientes), /agenda (próximos eventos), /pomo (iniciar pomodoro), /nota [texto] (guardar nota), /gasto [monto] [descripción] (registrar gasto), /ingreso [monto] [descripción], /ayuda (ver ejemplos).`

    const prompt = `Sos Hubby, el asistente de StudyHub. El usuario preguntó via Telegram: "${question}"
${subject ? `Contexto adicional: está preguntando sobre "${subject}".` : ""}

MANUAL DE LA APP (usalo si pregunta cómo hacer algo o qué es algo):
${APP_GUIDE}

Datos actuales del usuario en ${contextLabel}:
${JSON.stringify(rawData, null, 2).slice(0, 2500)}

Respondé en español, de forma clara y concisa. Máximo 5 líneas. No uses JSON en la respuesta.
Si pregunta por temas de parcial, buscá en el campo "notes" o "tp" de la materia correspondiente.
Si pregunta qué tiene pendiente, mostrá solo los items con done:false.
Si pregunta cómo usar la app o qué hace alguna función, respondé usando el MANUAL DE LA APP de arriba.`

    const response = await fetch(`${GEMINI_API}?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 500, thinkingConfig: { thinkingBudget: 0 } }
      })
    })
    const json = await response.json()
    const answer = json.candidates?.[0]?.content?.parts?.[0]?.text
    if (answer) return `🤖 ${answer.trim()}`
  } catch (e) {
    console.log("Query Gemini error:", e)
  }

  return `📊 Encontré datos en ${contextLabel} pero no pude procesarlos. Abrí la app para verlos.`
}

// ─── Clasificador por palabras clave (fallback) ───────────────────────────────

function classifyByKeywords(text: string): Record<string, unknown> {
  const t = text.toLowerCase()
  if (/gasté|gaste|pagué|pague|costó|costo|\$\d|\d+\s*pesos/.test(t))
    return { intent_type: "add", section: "finanzas", confidence: 0.8, data: { title: text, amount: parseInt(text.match(/\d+/)?.[0] || "0"), type: "gasto", priority: "medium", xp: 5 } }
  if (/comprar|lista de compras/.test(t))
    return { intent_type: "add", section: "cocina", confidence: 0.8, data: { title: text, subseccion: "compras" } }
  if (/heladera|nevera/.test(t))
    return { intent_type: "add", section: "cocina", confidence: 0.8, data: { title: text, subseccion: "heladera" } }
  if (/freezer|congelad/.test(t))
    return { intent_type: "add", section: "cocina", confidence: 0.8, data: { title: text, subseccion: "freezer" } }
  if (/almacen|almacén/.test(t))
    return { intent_type: "add", section: "cocina", confidence: 0.8, data: { title: text, subseccion: "almacen" } }
  if (/parcial|final|examen|entrega|reunión|reunion/.test(t))
    return { intent_type: "add", section: "calendario", confidence: 0.8, data: { title: text, priority: "high", xp: 20 } }
  if (/misión|mision|quiero terminar|proyecto|objetivo/.test(t))
    return { intent_type: "add", section: "misiones", confidence: 0.8, data: { title: text, priority: "medium", xp: 20 } }
  if (/anotar|nota:|recordar que/.test(t))
    return { intent_type: "add", section: "diario", confidence: 0.85, data: { title: text, priority: "low", xp: 5 } }
  if (/estudiar|leer|hacer|tp |resolver|ejercicio|practica|práctica/.test(t))
    return { intent_type: "add", section: "tareas", confidence: 0.8, data: { title: text, priority: "medium", xp: 10 } }
  if (/\?$|cuáles|cuales|qué tengo|que tengo|cuánto|cuanto/.test(t))
    return { intent_type: "query", section: "tareas", confidence: 0.7, data: { query_text: text } }
  return { intent_type: "add", section: null, confidence: 0.3, data: { title: text } }
}

// ─── Gemini: clasificar intención ─────────────────────────────────────────────

async function classifyWithGemini(text: string, geminiKey: string, lastAction?: { section: string, title: string, date?: string } | null): Promise<Record<string, unknown> & { _geminiError?: string }> {
  if (!geminiKey) return classifyByKeywords(text)

  const contextLine = lastAction
    ? `\nCONTEXTO DEL MENSAJE ANTERIOR: el usuario acaba de guardar "${lastAction.title}" en ${lastAction.section}${lastAction.date ? ` (fecha: ${lastAction.date})` : ""}. Si el nuevo mensaje hace referencia a eso con palabras como "también", "esa", "lo mismo", "y agrega", "agrégalo", "para eso también", etc., usá ese contexto para completar el intent.`
    : ""

  try {
    const response = await fetch(`${GEMINI_API}?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SECTION_INFO}${contextLine}

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
    "priority": "high|medium|low",
    "xp": 10,
    "amount": null,
    "type": null,
    "query_text": "la pregunta original si es query, o null",
    "pct": null
  },
  "confidence": 0.9,
  "needs_clarification": false
}
Si es ambiguo (confidence < 0.6), poné needs_clarification: true y data.clarification con la pregunta.` }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } }
      })
    })

    const json = await response.json()
    console.log("Gemini status:", response.status)
    if (json.error) {
      console.log("Gemini API error:", json.error.message)
      return { ...classifyByKeywords(text), _geminiError: json.error.message }
    }

    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
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
    return `💰 ¿Cuánto fue el ${data.type === "ingreso" ? "ingreso" : "gasto"}? (solo número)`

  if (section === "cocina" && !data.subseccion)
    return `🍽️ ¿Dónde lo guardo?\n\n<b>heladera</b> · <b>almacen</b> · <b>freezer</b> · <b>compras</b>`

  if (section === "facultad" && !data.subseccion)
    return `📚 ¿Qué tipo de cosa es?\n\n<b>tp</b> (trabajo práctico) · <b>anotacion</b> · <b>nueva materia</b> · <b>progreso</b>`

  if (section === "facultad" && (data.subseccion === "tp" || data.subseccion === "nota_materia") && !data.subject)
    return `📚 ¿Para qué materia? (escribí el nombre)`

  return null
}

// ─── Parsear fecha en español ─────────────────────────────────────────────────

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
      const d = new Date(now.getFullYear(), idx, parseInt(match[1]))
      if (d < now) d.setFullYear(d.getFullYear() + 1)
      return d.toISOString().slice(0, 10)
    }
  }
  const DAYS: Record<string, number> = { lunes:1,martes:2,miércoles:3,miercoles:3,jueves:4,viernes:5,sábado:6,sabado:6,domingo:0 }
  for (const [name, dayIdx] of Object.entries(DAYS)) {
    if (t.includes(name)) {
      const now = new Date()
      const diff = (dayIdx - now.getDay() + 7) % 7 || 7
      const d = new Date(now); d.setDate(d.getDate() + diff)
      return d.toISOString().slice(0, 10)
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  return null
}

// ─── Construir item para guardar ──────────────────────────────────────────────

async function buildAndSave(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  section: string,
  draft: Record<string, unknown>,
  subtasks?: string[]
): Promise<string> {
  const data = (draft.data || {}) as Record<string, unknown>
  const now = Date.now()
  const avClasses = ["v1","v2","v3","v4"]

  // ── TAREAS ──
  if (section === "tareas") {
    const title = (data.title as string) || "Tarea sin nombre"
    const initials = title.split(/\s+/).slice(0,2).map((w: string) => w[0]?.toUpperCase() || "?").join("")
    const progress = (data.subject as string) ? `${data.subject} · En curso` : "En curso"
    await appendToAppData(supabase, userId, "studyhub_v3_tasks", {
      id: now, name: title, avClass: avClasses[now % 4], initials, progress,
      xp: (data.xp as number) || 10, status: "Pendiente", statusTone: "blue",
      done: false, createdAt: now, dueDate: data.date || null,
      subjectName: data.subject || null, savedViaTelegram: true
    })
    return `✅ Tarea guardada${data.subject ? ` (${data.subject})` : ""}. Ya aparece en la app.`
  }

  // ── MISIONES ──
  if (section === "misiones") {
    const tasks = (subtasks || []).map((t, i) => ({ id: now + i, text: t.trim(), done: false }))
    await appendToAppData(supabase, userId, "studyhub_v3_missions", {
      id: now, title: (data.title as string) || "Nueva misión",
      desc: (data.desc as string) || "", priority: (data.priority as string) || "medium",
      xp: (data.xp as number) || 15, done: false, tasks, savedViaTelegram: true
    })
    return `✅ Misión guardada${tasks.length ? ` con ${tasks.length} subtarea(s)` : ""}. Ya aparece en la app.`
  }

  // ── CALENDARIO ──
  if (section === "calendario") {
    await appendToAppData(supabase, userId, "studyhub_v3_calendar", {
      id: now, title: (data.title as string) || "Evento",
      date: (data.date as string) || new Date().toISOString().slice(0,10),
      color: "v1", desc: (data.desc as string) || "", savedViaTelegram: true
    })
    return `✅ Evento guardado en calendario. Ya aparece en la app.`
  }

  // ── DIARIO ──
  if (section === "diario") {
    await appendToDiary(supabase, userId, (data.title as string) || "")
    return `✅ Anotación guardada en tu diario.`
  }

  // ── FACULTAD ──
  if (section === "facultad") {
    const subseccion = data.subseccion as string
    const subjects = await getAppData(supabase, userId, "studyhub_v3_subjects") as Record<string, unknown>[] || []

    if (subseccion === "nueva_materia") {
      const name = (data.title as string) || "Nueva Materia"
      const code = name.split(/\s+/).map((w: string) => w[0]?.toUpperCase() || "").join("").slice(0, 3)
      await appendToAppData(supabase, userId, "studyhub_v3_subjects", {
        id: now, name, code, pct: 0, prof: "", next: "", color: "v1", notes: "", tp: []
      })
      return `✅ Materia "${name}" agregada en Facultad.`
    }

    if (subseccion === "tp" && data.subject) {
      const subjectName = (data.subject as string).toLowerCase()
      const idx = subjects.findIndex((s: Record<string, unknown>) => (s.name as string).toLowerCase().includes(subjectName))
      if (idx === -1) return `❌ No encontré la materia "${data.subject}". Verificá el nombre en la app.`
      const subj = { ...subjects[idx] } as Record<string, unknown>
      const tps = Array.isArray(subj.tp) ? [...subj.tp] : []
      tps.push({ id: now, title: (data.title as string) || "TP", desc: (data.desc as string) || "", done: false, dueDate: data.date || null })
      subj.tp = tps
      subjects[idx] = subj
      await upsertAppData(supabase, userId, "studyhub_v3_subjects", subjects)
      return `✅ TP agregado a ${subjects[idx].name}. Ya aparece en Facultad.`
    }

    if (subseccion === "nota_materia" && data.subject) {
      const subjectName = (data.subject as string).toLowerCase()
      const idx = subjects.findIndex((s: Record<string, unknown>) => (s.name as string).toLowerCase().includes(subjectName))
      if (idx === -1) return `❌ No encontré la materia "${data.subject}".`
      const subj = { ...subjects[idx] } as Record<string, unknown>
      const today = new Date().toLocaleDateString("es-AR")
      subj.notes = subj.notes ? `${subj.notes}\n[${today}] ${data.title}` : `[${today}] ${data.title}`
      subjects[idx] = subj
      await upsertAppData(supabase, userId, "studyhub_v3_subjects", subjects)
      return `✅ Anotación guardada en ${subjects[idx].name}.`
    }

    if (subseccion === "progreso" && data.subject) {
      const subjectName = (data.subject as string).toLowerCase()
      const idx = subjects.findIndex((s: Record<string, unknown>) => (s.name as string).toLowerCase().includes(subjectName))
      if (idx === -1) return `❌ No encontré la materia "${data.subject}".`
      const subj = { ...subjects[idx] } as Record<string, unknown>
      subj.pct = Math.min(100, Math.max(0, (data.pct as number) || 0))
      subjects[idx] = subj
      await upsertAppData(supabase, userId, "studyhub_v3_subjects", subjects)
      return `✅ Progreso de ${subjects[idx].name} actualizado a ${subj.pct}%.`
    }

    if (subseccion === "fecha_materia" && data.subject) {
      const subjectName = (data.subject as string).toLowerCase()
      const idx = subjects.findIndex((s: Record<string, unknown>) => (s.name as string).toLowerCase().includes(subjectName))
      if (idx === -1) return `❌ No encontré la materia "${data.subject}".`
      const subj = { ...subjects[idx] } as Record<string, unknown>
      subj.next = (data.title as string) || (data.date as string) || ""
      subjects[idx] = subj
      await upsertAppData(supabase, userId, "studyhub_v3_subjects", subjects)
      return `✅ Próximo evento de ${subjects[idx].name} actualizado.`
    }

    return `❌ No entendí qué guardar en Facultad. Probá: "nuevo TP de álgebra: práctica 5" o "anotar en filosofía: xyz".`
  }

  // ── COCINA ──
  if (section === "cocina") {
    const subseccion = (data.subseccion as string) || "heladera"
    const keyMap: Record<string, string> = {
      heladera: "studyhub_v3_kitchen",
      almacen: "studyhub_v3_almacen",
      freezer: "studyhub_v3_freezer",
      compras: "studyhub_v3_groceries"
    }
    const key = keyMap[subseccion] || "studyhub_v3_kitchen"

    if (subseccion === "compras") {
      await appendToAppData(supabase, userId, key, { id: now, title: (data.title as string) || "Item", done: false })
    } else {
      await appendToAppData(supabase, userId, key, {
        id: now, title: (data.title as string) || "Alimento",
        sub: (data.desc as string) || "", tag: "", warn: false, section: subseccion
      })
    }
    const labels: Record<string, string> = { heladera:"heladera 🧊", almacen:"almacén 📦", freezer:"freezer ❄️", compras:"lista de compras 🛒" }
    return `✅ Guardado en ${labels[subseccion] || subseccion}. Ya aparece en Cocina.`
  }

  // ── FINANZAS ──
  if (section === "finanzas") {
    const fin = await getAppData(supabase, userId, "studyhub_fin_v1") as Record<string, unknown> || { presupuesto: 0, gastos: [], metas: [], mes: new Date().getMonth(), anio: new Date().getFullYear() }
    const gastos = Array.isArray(fin.gastos) ? [...fin.gastos as Record<string, unknown>[]] : []
    gastos.push({
      id: now, cat: "otros", desc: (data.title as string) || "Gasto",
      monto: (data.amount as number) || 0,
      fecha: new Date().toISOString().slice(0, 10),
      type: data.type || "gasto"
    })
    fin.gastos = gastos
    await upsertAppData(supabase, userId, "studyhub_fin_v1", fin)
    return `✅ ${data.type === "ingreso" ? "Ingreso" : "Gasto"} guardado en Finanzas.`
  }

  // ── OCIO ──
  if (section === "ocio") {
    await appendToAppData(supabase, userId, "studyhub_ocio_v1", {
      id: now, emoji: "📺", title: (data.title as string) || "Contenido",
      type: "serie", status: "pendiente", score: 0, note: (data.desc as string) || ""
    })
    return `✅ Guardado en Ocio.`
  }

  return `❌ No pude guardar. Sección desconocida: ${section}.`
}

// ─── Mensaje de confirmación ──────────────────────────────────────────────────

function formatConfirmMessage(section: string, draft: Record<string, unknown>): string {
  const data = (draft.data || {}) as Record<string, unknown>
  const emoji: Record<string,string> = { tareas:"✅",misiones:"⚡",calendario:"📅",diario:"📖",facultad:"📚",cocina:"🍽️",finanzas:"💰",ocio:"🎬" }
  const name: Record<string,string> = {
    tareas:"Tareas", misiones:"Misiones", calendario:"Calendario", diario:"Diario",
    facultad:"Facultad", cocina:"Cocina", finanzas:"Finanzas", ocio:"Ocio"
  }
  const subsLabel: Record<string,string> = {
    heladera:"Heladera 🧊", almacen:"Almacén 📦", freezer:"Freezer ❄️", compras:"Lista de compras 🛒",
    nueva_materia:"Nueva materia", tp:"Trabajo Práctico", nota_materia:"Anotación", progreso:"Progreso", fecha_materia:"Fecha/evento"
  }

  let details = `<b>${data.title as string || "Item"}</b>`
  if (data.subject) details += `\n📚 Materia: ${data.subject}`
  if (data.subseccion) details += `\n📁 ${subsLabel[data.subseccion as string] || data.subseccion}`
  if (data.desc) details += `\n📝 ${data.desc}`
  if (data.date) details += `\n📅 ${data.date}`
  if (data.priority === "high") details += "\n🔴 Prioridad alta"
  if (data.xp) details += `\n⚡ +${data.xp} XP`
  if (data.amount) details += `\n💰 $${data.amount} (${data.type || "gasto"})`
  if (data.pct) details += `\n📊 ${data.pct}% de progreso`

  return `${emoji[section]||"📌"} <b>${name[section]||section}</b>\n\n${details}\n\n¿Guardamos esto?`
}

const CONFIRM_KEYBOARD = {
  inline_keyboard: [[
    { text: "✅ Sí, guardar", callback_data: "confirm_yes" },
    { text: "❌ No", callback_data: "confirm_no" },
    { text: "📁 Cambiar sección", callback_data: "change_section" },
  ]]
}

// ─── Handler principal ────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    const body = await req.json()
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!
    const geminiKey = Deno.env.get("GEMINI_API_KEY")!

    // ── Callback query (botones inline) ─────────────────────────────────────
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
        const result = await buildAndSave(supabase, state.user_id as string, state.section as string, state.draft as Record<string,unknown>, state.subtasks as string[]|undefined)
        const draftData = ((state.draft as Record<string,unknown>).data || {}) as Record<string,unknown>
        await setState(supabase, chatId, {
          stage: "idle",
          user_id: state.user_id,
          last_action: {
            section: state.section,
            title: (draftData.title as string) || "",
            date: (draftData.date as string) || null,
          }
        })
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
    const text = (message.text || "").trim()
    if (!text) return new Response(JSON.stringify({ ok: true }), { status: 200 })

    // ── Vinculación SH-XXXX (antes del chequeo de vínculo) ──────────────────
    if (/^SH-[A-Z0-9]{4}$/i.test(text)) {
      const code = text.toUpperCase()
      const { data: pendingLink } = await supabase.from("telegram_links").select("user_id").eq("link_code", code).eq("linked", false).maybeSingle()
      if (!pendingLink) {
        await sendMessage(chatId, telegramToken, "❌ Código inválido o ya usado. Generá uno nuevo desde la app.")
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      await supabase.from("telegram_links").update({ linked: true, telegram_chat_id: chatId, updated_at: new Date().toISOString() }).eq("link_code", code)
      await sendMessage(chatId, telegramToken,
        `✅ <b>¡Vinculación exitosa!</b>\n\nAhora podés mandarme cualquier cosa en lenguaje natural:\n\n` +
        `• "hacer ejercicios de álgebra"\n• "parcial de análisis el 15 de julio"\n• "gasté 3000 en fotocopias"\n` +
        `• "nuevo TP de álgebra: práctica 5"\n• "¿qué tareas tengo pendientes?"\n\n` +
        `🎯 Un mensaje a la vez. ¡Empezá!`)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // ── Chequear vínculo ─────────────────────────────────────────────────────
    const { data: link } = await supabase.from("telegram_links").select("user_id, auto_save").eq("telegram_chat_id", chatId).eq("linked", true).maybeSingle()
    if (!link) {
      await sendMessage(chatId, telegramToken, "🔗 <b>Tu cuenta no está vinculada.</b>\n\nAbrí StudyHub → Configuración → Integraciones → Telegram, generá el código y mandámelo acá.")
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    const userId = link.user_id as string

    // ── Estado activo (conversación en curso) ────────────────────────────────
    const state = await getState(supabase, chatId)

    // Extraer contexto del último mensaje guardado (estado "idle")
    const lastAction = state?.stage === "idle"
      ? (state.last_action as { section: string, title: string, date?: string } | null)
      : null

    // Si el estado es "idle" no es una conversación activa, ignorarlo
    if (state && state.stage !== "idle") {
      const stage = state.stage as string
      const draft = state.draft as Record<string,unknown>
      const section = state.section as string

      if (stage === "awaiting_section_change") {
        const valid = ["tareas","misiones","calendario","diario","facultad","cocina","finanzas","ocio"]
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
        let subtasks: string[]|undefined = state.subtasks as string[]|undefined
        const data = (draft.data || {}) as Record<string, unknown>

        if (section === "misiones") {
          if (text.toLowerCase() !== "no") subtasks = text.split(",").map((t: string) => t.trim()).filter(Boolean)
        } else if (section === "tareas" || section === "calendario") {
          if (!["sin fecha","no tengo","nada"].some(s => text.toLowerCase().includes(s))) {
            const parsedDate = parseSpanishDate(text) || text
            updatedDraft = { ...draft, data: { ...data, date: parsedDate } }
          }
        } else if (section === "finanzas") {
          const num = parseFloat(text.replace(/[^\d.,]/g,"").replace(",","."))
          if (!isNaN(num)) updatedDraft = { ...draft, data: { ...data, amount: num } }
        } else if (section === "cocina") {
          const subMap: Record<string,string> = { heladera:"heladera", almacen:"almacen", almacén:"almacen", freezer:"freezer", compras:"compras", "lista":"compras" }
          const sub = Object.keys(subMap).find(k => text.toLowerCase().includes(k))
          if (sub) updatedDraft = { ...draft, data: { ...data, subseccion: subMap[sub] } }
        } else if (section === "facultad") {
          const tText = text.toLowerCase()
          if (tText.includes("tp") || tText.includes("trabajo")) updatedDraft = { ...draft, data: { ...data, subseccion: "tp" } }
          else if (tText.includes("anot") || tText.includes("nota")) updatedDraft = { ...draft, data: { ...data, subseccion: "nota_materia" } }
          else if (tText.includes("nueva") || tText.includes("materia")) updatedDraft = { ...draft, data: { ...data, subseccion: "nueva_materia" } }
          else if (tText.includes("progreso") || tText.includes("%")) updatedDraft = { ...draft, data: { ...data, subseccion: "progreso" } }
          else {
            // Si respondió con el nombre de una materia (para tp/nota que necesitaba subject)
            if (!data.subject) updatedDraft = { ...draft, data: { ...data, subject: text.trim() } }
          }
        }

        // Chequear si necesita otro followup
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
          // Guardar contexto del último item guardado (estado "idle" con TTL normal)
          const draftData = (draft.data || {}) as Record<string, unknown>
          await setState(supabase, chatId, {
            stage: "idle",
            user_id: userId,
            last_action: {
              section,
              title: (draftData.title as string) || "",
              date: (draftData.date as string) || null,
            }
          })
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
      // Si ya está vinculado, dar bienvenida distinta
      const { data: existingLink } = await supabase
        .from("telegram_links").select("linked").eq("telegram_chat_id", chatId).eq("linked", true).maybeSingle()

      if (existingLink) {
        await sendMessage(chatId, telegramToken,
          `👋 <b>¡Ya estás conectado a StudyHub!</b>\n\n` +
          `Mandame cualquier cosa en lenguaje natural y la guardo en tu app.\n\n` +
          `📝 "hacer ejercicios de álgebra"\n` +
          `📅 "parcial de análisis el 20 de julio"\n` +
          `💰 "gasté 3000 en fotocopias"\n` +
          `🔍 "¿qué tareas tengo pendientes?"\n\n` +
          `Escribí /ayuda para ver todos los ejemplos.`)
      } else {
        await sendMessage(chatId, telegramToken,
          `✨ <b>¡Hola! Soy Hubby, tu asistente de StudyHub.</b>\n\n` +
          `Voy a ser tu compañero de estudio en Telegram. Podés mandarme tareas, eventos, gastos, notas y hasta hacerme preguntas sobre tu info — todo se sincroniza directo con la app.\n\n` +
          `🔗 <b>Para empezar, vinculá tu cuenta:</b>\n\n` +
          `1. Abrí StudyHub en el navegador\n` +
          `2. Onboarding paso 3 <b>o</b> Configuración → Integraciones\n` +
          `3. Generá tu código <b>SH-XXXX</b>\n` +
          `4. Mandámelo acá\n\n` +
          `¡En segundos quedamos conectados! 🚀`)
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (text === "/ayuda" || text === "/help") {
      await sendMessage(chatId, telegramToken,
        `🤖 <b>Soy Hubby, asistente de StudyHub.</b>\n\nPodés guardar y consultar cosas:\n\n` +
        `📝 <b>Guardar:</b>\n• "hacer ejercicios de álgebra"\n• "nuevo TP de álgebra: práctica 5"\n• "anotar en filosofía: temas del parcial"\n` +
        `• "parcial de análisis el 20 de julio"\n• "gasté 3000 en fotocopias"\n• "comprar pan y leche"\n• "metí empanadas al freezer"\n\n` +
        `🔍 <b>Consultar:</b>\n• "¿qué tareas tengo pendientes?"\n• "¿cuáles son los temas de filosofía?"\n• "¿cuánto gasté este mes?"\n\n` +
        `⚙️ /cancelar para cancelar una operación`)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (text === "/cancelar") {
      await setState(supabase, chatId, null)
      await sendMessage(chatId, telegramToken, "✅ Operación cancelada.")
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // Comando debug
    if (text === "/debug") {
      const hasGemini = !!geminiKey
      let geminiTest = "no probado"
      if (hasGemini) {
        try {
          const r = await fetch(`${GEMINI_API}?key=${geminiKey}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "Respondé solo con la palabra: ok" }] }],
              generationConfig: { temperature: 0, maxOutputTokens: 500, thinkingConfig: { thinkingBudget: 0 } }
            })
          })
          const j = await r.json()
          if (j.error) geminiTest = `❌ Error ${j.error.code}: ${j.error.message}`
          else if (j.candidates?.[0]?.content?.parts?.[0]?.text) geminiTest = `✅ Funciona: "${j.candidates[0].content.parts[0].text}"`
          else geminiTest = `⚠️ Respuesta rara: ${JSON.stringify(j).slice(0, 200)}`
        } catch (e) { geminiTest = `❌ ${(e as Error).message}` }
      }
      await sendMessage(chatId, telegramToken,
        `🔧 <b>Debug</b>\n\nTELEGRAM_BOT_TOKEN: ${!!telegramToken ? "✅" : "❌"}\nGEMINI_API_KEY: ${hasGemini ? "✅ presente" : "❌ no configurada"}\n\nGemini test: ${geminiTest}`)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // ── Clasificar con Gemini ────────────────────────────────────────────────
    const intent = await classifyWithGemini(text, geminiKey, lastAction)

    // Modo QUERY — responder pregunta
    if (intent.intent_type === "query") {
      const answer = await handleQuery(supabase, userId, intent.section as string, (intent.data || {}) as Record<string,unknown>, geminiKey)
      await sendMessage(chatId, telegramToken, answer)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // Baja confianza
    if (!intent.section || (intent.confidence as number) < 0.5) {
      await sendMessage(chatId, telegramToken,
        `🤔 No entendí bien. Probá:\n• "tarea: estudiar capítulo 4"\n• "nuevo TP de álgebra: práctica 5"\n• "gasto: 3000 en transporte"\n• "¿qué tengo pendiente?"\n\nO escribí <b>/ayuda</b>.`)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (intent.needs_clarification) {
      const q = (intent.data as Record<string,unknown>)?.clarification as string
      await setState(supabase, chatId, { stage: "awaiting_clarification", original_text: text, user_id: userId })
      await sendMessage(chatId, telegramToken, q || "¿Podés ser más específico?")
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    const section = intent.section as string
    const followupQ = getFollowupQuestion(section, intent as Record<string,unknown>)

    if (followupQ) {
      await setState(supabase, chatId, { stage: "awaiting_followup", section, draft: intent, user_id: userId })
      await sendMessage(chatId, telegramToken, `🎯 Entendí: <b>${(intent.data as Record<string,unknown>)?.title || text}</b> → ${section}\n\n${followupQ}`)
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
