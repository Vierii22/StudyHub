/* ============================================================
   SYNC ENGINE — lógica pura para sincronizar tareas ↔ calendario
   ============================================================ */

const uid = () => Math.random().toString(36).slice(2, 9);

/* ── Validación ──────────────────────────────────────────── */
function isValidTitle(str) {
  return typeof str === "string" && str.trim().length > 0;
}

function isValidDate(str) {
  if (!str) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

/* ── Parsers de fecha ────────────────────────────────────── */

/* Cualquier due string → YYYY-MM-DD */
function formatDueToDate(dueStr) {
  if (!dueStr || dueStr === "—") return null;

  const today = new Date();

  // Ya viene en YYYY-MM-DD (del date picker)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueStr)) return dueStr;

  const s = dueStr.toLowerCase().trim();
  if (s === "hoy") return today.toISOString().split('T')[0];
  if (s === "mañana") {
    const t = new Date(today);
    t.setDate(t.getDate() + 1);
    return t.toISOString().split('T')[0];
  }

  // "12/6" o "12-6" con año opcional
  const match = dueStr.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/);
  if (match) {
    const day   = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year  = match[3] ? parseInt(match[3], 10) : today.getFullYear();
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  // Texto libre (ej: "12 jun")
  const tryParse = new Date(dueStr + " " + today.getFullYear());
  if (!isNaN(tryParse.getTime())) return tryParse.toISOString().split('T')[0];

  return null; // no se pudo parsear
}

/* YYYY-MM-DD → "12/6" para mostrar en tareas */
function formatDateToDue(dateStr) {
  if (!dateStr || !isValidDate(dateStr)) return "—";
  const [, m, d] = dateStr.split('-');
  return `${parseInt(d)}/${parseInt(m)}`;
}

/* ── syncTaskToCalendar ──────────────────────────────────── */
export function syncTaskToCalendar(task, data, set) {
  // Validaciones
  if (!isValidTitle(task?.t)) return;
  if (!task.due || task.due === "—") return;

  const eventDate = task.dueDate || formatDueToDate(task.due);
  if (!eventDate) return; // fecha no parseável

  // Chequear si el mapeo existente sigue apuntando a un evento real
  const mappedEventId = data.taskCalendarMap?.[task.id];
  if (mappedEventId) {
    const exists = data.events?.find(e => e.id === mappedEventId);
    if (exists) {
      // Actualizar evento existente
      set(s => {
        const evt = s.events?.find(e => e.id === mappedEventId);
        if (evt) { evt.date = eventDate; evt.title = task.t; }
      });
      return;
    }
    // Mapeo stale — limpiar y crear nuevo
    set(s => { if (s.taskCalendarMap) delete s.taskCalendarMap[task.id]; });
  }

  // Crear nuevo evento (verificar que no exista evento con mismo título+fecha)
  const dup = data.events?.find(
    e => e.title === task.t && e.date === eventDate && !e.taskId
  );

  const newEvent = {
    id: dup?.id || uid(),
    title: task.t,
    date: eventDate,
    color: task.prio === "alta" ? "#B8461A" : task.prio === "baja" ? "#7E8A4F" : "#C68A2E",
    taskId: task.id,
  };

  set(s => {
    if (!s.events) s.events = [];
    if (!dup) s.events.push(newEvent);
    if (!s.taskCalendarMap) s.taskCalendarMap = {};
    s.taskCalendarMap[task.id] = newEvent.id;
  });
}

/* ── syncEventToTask ─────────────────────────────────────── */
export function syncEventToTask(event, data, set) {
  if (!isValidTitle(event?.title)) return;

  // Si ya está mapeado, solo actualizar la fecha de la tarea existente
  const existingTaskId = Object.keys(data.taskCalendarMap || {})
    .find(k => data.taskCalendarMap[k] === event.id);

  if (existingTaskId) {
    const tsk = data.tasks?.find(t => t.id === existingTaskId);
    if (tsk) {
      set(s => {
        const t = s.tasks.find(x => x.id === existingTaskId);
        if (t) { t.due = formatDateToDue(event.date); t.dueDate = event.date; }
      });
      return;
    }
    // Task fue borrada — limpiar mapeo
    set(s => { if (s.taskCalendarMap) delete s.taskCalendarMap[existingTaskId]; });
  }

  // Crear nueva tarea a partir del evento
  const newId = uid();
  const newTask = {
    id: newId,
    t: event.title,
    due: formatDateToDue(event.date),
    dueDate: event.date || "",
    desc: event.desc || "",
    subject: null,
    prio: "media",
    xp: 20,
    status: "pendiente",
    done: false,
  };

  set(s => {
    if (!s.tasks) s.tasks = [];
    // Evitar duplicado exacto (mismo título + fecha)
    const dup = s.tasks.find(t => t.t === newTask.t && t.due === newTask.due);
    if (!dup) {
      s.tasks.push(newTask);
      if (!s.taskCalendarMap) s.taskCalendarMap = {};
      s.taskCalendarMap[newId] = event.id;
    }
  });
}

/* ── cleanupPastEvents ───────────────────────────────────── */
export function cleanupPastEvents(set) {
  const today = new Date().toISOString().split('T')[0];

  set(s => {
    if (!Array.isArray(s.events)) return;

    const toDelete = s.events.filter(e => {
      const eDate = e.date || "";
      return eDate && eDate < today;
    });

    // Limpiar mappings para eventos eliminados
    toDelete.forEach(e => {
      if (!s.taskCalendarMap) return;
      const mapped = Object.keys(s.taskCalendarMap)
        .filter(k => s.taskCalendarMap[k] === e.id);
      mapped.forEach(k => delete s.taskCalendarMap[k]);
    });

    s.events = s.events.filter(e => {
      const eDate = e.date || "";
      return !eDate || eDate >= today;
    });
  });
}

export { formatDueToDate, formatDateToDue, isValidTitle, isValidDate };
