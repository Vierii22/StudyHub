/* ============================================================
   CHAT ACTIONS — el "ejecutar" de Hubby (Fase 2)
   Hubby puede emitir acciones estructuradas al final de su
   respuesta, tras el marcador @@ACTIONS@@ + un array JSON.
   Acá las parseamos y las aplicamos al Store.
   Las acciones que BORRAN piden confirmación (needsConfirm).
   ============================================================ */
import { Store, uid, toast } from './store.jsx';
import { syncTaskToCalendar, formatDateToDue } from './syncEngine.js';

/* ── normalización para matching difuso ──────────────────── */
const norm = (s) => String(s || "")
  .toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "") /* saca acentos */
  .replace(/\s+/g, " ")
  .trim();

/* puntaje de similitud entre un valor y la query (0 = nada) */
function scoreMatch(v, q, qTokens) {
  if (!v) return 0;
  if (v === q) return 100;
  let s = 0;
  if (v.includes(q) || q.includes(v)) s = 80;               /* substring contiguo */
  if (qTokens.length) {                                      /* palabras salteadas */
    const matched = qTokens.filter(tok => v.includes(tok)).length;
    s = Math.max(s, (matched / qTokens.length) * 60);
  }
  return s;
}

/* encuentra el mejor match de un texto contra una lista por campo */
function bestMatch(list, field, query) {
  const q = norm(query);
  if (!q || !list?.length) return null;
  const qTokens = q.split(" ").filter(t => t.length >= 2);
  let best = null, bestScore = 0;
  for (const item of list) {
    const sc = scoreMatch(norm(item[field]), q, qTokens);
    if (sc > bestScore) { bestScore = sc; best = item; }
  }
  return bestScore >= 40 ? best : null;                      /* umbral para no matchear cualquier cosa */
}

/* qué acciones necesitan confirmación antes de aplicarse */
const DESTRUCTIVE = new Set(["delete_task", "delete_event", "delete_note"]);
export const needsConfirm = (a) => DESTRUCTIVE.has(a?.type);

/* ── parseo: separa el texto visible de las acciones ─────── */
export function parseActions(reply) {
  const raw = String(reply || "");
  const idx = raw.indexOf("@@ACTIONS@@");
  if (idx === -1) return { text: raw.trim(), actions: [] };

  const text = raw.slice(0, idx).trim();
  let jsonPart = raw.slice(idx + "@@ACTIONS@@".length).trim();
  /* tolerar que venga envuelto en ```json ... ``` */
  jsonPart = jsonPart.replace(/^```(?:json)?/i, "").replace(/```$/,"").trim();

  let actions = [];
  try {
    const parsed = JSON.parse(jsonPart);
    if (Array.isArray(parsed)) actions = parsed;
    else if (parsed && typeof parsed === "object") actions = [parsed];
  } catch { /* si no parsea, no ejecutamos nada */ }

  actions = actions.filter(a => a && typeof a === "object" && a.type);
  return { text: text || "Listo.", actions };
}

/* ── descripción legible de una acción (para chips/confirmación) ── */
export function describeAction(a) {
  switch (a.type) {
    case "add_task":      return `Agregar tarea “${a.t}”${a.due ? ` (${a.due})` : ""}`;
    case "complete_task": return `Completar “${a.match}”`;
    case "edit_task":     return `Editar “${a.match}”`;
    case "delete_task":   return `Borrar tarea “${a.match}”`;
    case "add_event":     return `Agregar al calendario “${a.title}”${a.date ? ` (${a.date})` : ""}`;
    case "delete_event":  return `Borrar del calendario “${a.match}”`;
    case "note_subject":  return `Anotar en ${a.subject}: “${a.text}”`;
    case "delete_note":   return `Borrar anotación “${a.match}”`;
    default:              return a.type;
  }
}

/* ── aplica UNA acción al Store; devuelve { ok, label } ──── */
export function applyAction(a) {
  const data = Store.get();
  try {
    switch (a.type) {
      /* ── TAREAS ─────────────────────────────────────── */
      case "add_task": {
        const t = String(a.t || "").trim();
        if (!t) return { ok: false, label: "No entendí qué tarea agregar" };
        const subj = a.subject ? bestMatch(data.subjects, "name", a.subject) : null;
        const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(a.due || "") ? a.due : "";
        const task = {
          id: uid(), t,
          due: dueDate ? formatDateToDue(dueDate) : "—",
          dueDate,
          desc: String(a.desc || ""),
          subject: subj?.id || null,
          prio: ["alta","media","baja"].includes(a.prio) ? a.prio : "media",
          status: "pendiente",
          done: false,
        };
        Store.set(s => { if (!s.tasks) s.tasks = []; s.tasks.push(task); });
        if (dueDate) syncTaskToCalendar(task, Store.get(), Store.set);
        return { ok: true, label: `Tarea “${t}” agregada` };
      }

      case "complete_task": {
        const hit = bestMatch(data.tasks, "t", a.match);
        if (!hit) return { ok: false, label: `No encontré la tarea “${a.match}”` };
        Store.set(s => {
          const t = s.tasks.find(x => x.id === hit.id);
          if (t) { t.done = true; t.status = "lista"; }
        });
        return { ok: true, label: `“${hit.t}” marcada como lista` };
      }

      case "edit_task": {
        const hit = bestMatch(data.tasks, "t", a.match);
        if (!hit) return { ok: false, label: `No encontré la tarea “${a.match}”` };
        const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(a.due || "") ? a.due : null;
        Store.set(s => {
          const t = s.tasks.find(x => x.id === hit.id);
          if (!t) return;
          if (a.t) t.t = String(a.t).trim();
          if (["alta","media","baja"].includes(a.prio)) t.prio = a.prio;
          if (dueDate) { t.dueDate = dueDate; t.due = formatDateToDue(dueDate); }
        });
        if (dueDate) syncTaskToCalendar(Store.get().tasks.find(x => x.id === hit.id), Store.get(), Store.set);
        return { ok: true, label: `“${hit.t}” actualizada` };
      }

      case "delete_task": {
        const hit = bestMatch(data.tasks, "t", a.match);
        if (!hit) return { ok: false, label: `No encontré la tarea “${a.match}”` };
        Store.set(s => {
          s.tasks = s.tasks.filter(x => x.id !== hit.id);
          const evId = s.taskCalendarMap?.[hit.id];
          if (evId) { s.events = (s.events || []).filter(e => e.id !== evId); delete s.taskCalendarMap[hit.id]; }
        });
        return { ok: true, label: `Tarea “${hit.t}” borrada` };
      }

      /* ── CALENDARIO ─────────────────────────────────── */
      case "add_event": {
        const title = String(a.title || "").trim();
        if (!title) return { ok: false, label: "No entendí qué evento agregar" };
        const date = /^\d{4}-\d{2}-\d{2}$/.test(a.date || "") ? a.date : "";
        if (!date) return { ok: false, label: `Falta la fecha del evento “${title}”` };
        const subj = a.subject ? bestMatch(data.subjects, "name", a.subject) : null;
        const kind = ["parcial","entrega","clase","estudio","evento"].includes(a.kind) ? a.kind : "evento";
        const ev = {
          id: uid(), title, date,
          day: parseInt(date.slice(8, 10), 10),
          time: /^\d{1,2}:\d{2}$/.test(a.time || "") ? a.time : "",
          kind, subjectId: subj?.id || null,
          color: subj?.color || (kind === "parcial" ? "#B8461A" : "#D9551F"),
        };
        Store.set(s => { if (!s.events) s.events = []; s.events.push(ev); });
        return { ok: true, label: `“${title}” agregado al calendario` };
      }

      case "delete_event": {
        const hit = bestMatch(data.events, "title", a.match);
        if (!hit) return { ok: false, label: `No encontré el evento “${a.match}”` };
        Store.set(s => {
          s.events = s.events.filter(e => e.id !== hit.id);
          for (const k of Object.keys(s.taskCalendarMap || {})) {
            if (s.taskCalendarMap[k] === hit.id) delete s.taskCalendarMap[k];
          }
        });
        return { ok: true, label: `Evento “${hit.title}” borrado` };
      }

      /* ── ANOTACIONES EN MATERIA ─────────────────────── */
      case "note_subject": {
        const subj = bestMatch(data.subjects, "name", a.subject);
        if (!subj) return { ok: false, label: `No encontré la materia “${a.subject}”` };
        const text = String(a.text || "").trim();
        if (!text) return { ok: false, label: "No entendí qué anotar" };
        Store.set(s => {
          const sj = s.subjects.find(x => x.id === subj.id);
          if (!sj) return;
          if (!sj.lists) sj.lists = {};
          if (!Array.isArray(sj.lists.notas)) sj.lists.notas = [];
          sj.lists.notas.push({ id: uid(), t: text });
        });
        return { ok: true, label: `Anotado en ${subj.name}` };
      }

      case "delete_note": {
        const subj = a.subject ? bestMatch(data.subjects, "name", a.subject) : null;
        const pool = subj ? [subj] : (data.subjects || []);
        let found = null, foundSubj = null;
        for (const sj of pool) {
          const hit = bestMatch(sj.lists?.notas, "t", a.match);
          if (hit) { found = hit; foundSubj = sj; break; }
        }
        if (!found) return { ok: false, label: `No encontré la anotación “${a.match}”` };
        Store.set(s => {
          const sj = s.subjects.find(x => x.id === foundSubj.id);
          if (sj?.lists?.notas) sj.lists.notas = sj.lists.notas.filter(n => n.id !== found.id);
        });
        return { ok: true, label: `Anotación borrada de ${foundSubj.name}` };
      }

      default:
        return { ok: false, label: `No sé hacer “${a.type}”` };
    }
  } catch (e) {
    return { ok: false, label: "Algo falló al ejecutar la acción" };
  }
}

/* aplica una lista de acciones y devuelve los resultados */
export function applyActions(actions) {
  const results = actions.map(applyAction);
  const okCount = results.filter(r => r.ok).length;
  if (okCount) { toast(okCount === 1 ? "✓ Hecho" : `✓ ${okCount} cambios`); }
  return results;
}
