/* ============================================================
   SYNC ENGINE — lógica pura para sincronizar tareas ↔ calendario
   Funciones sin side effects, para testear fácilmente
   ============================================================ */

const uid = () => Math.random().toString(36).slice(2, 9);

/* Formatear due string ("hoy", "12/6", "12-06-2025") → YYYY-MM-DD */
function formatDueToDate(dueStr) {
  if (!dueStr || dueStr === "—") return new Date().toISOString().split('T')[0];

  const today = new Date();
  const match = dueStr.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?/);

  if (!match) {
    if (dueStr.toLowerCase() === "hoy") return today.toISOString().split('T')[0];
    if (dueStr.toLowerCase() === "mañana") {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    return today.toISOString().split('T')[0];
  }

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year = match[3] ? parseInt(match[3], 10) : today.getFullYear();

  return new Date(year, month, day).toISOString().split('T')[0];
}

/* Formatear YYYY-MM-DD → due string para mostrar */
function formatDateToDue(dateStr) {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}`;
}

/* Sincronizar tarea → calendario */
export function syncTaskToCalendar(task, data, set) {
  if (!task.due || task.due === "—") return;

  const eventDate = formatDueToDate(task.due);
  const existing = data.taskCalendarMap?.[task.id];

  if (existing) {
    // Actualizar evento existente
    set(s => {
      const evt = s.events?.find(e => e.id === existing);
      if (evt) evt.date = eventDate;
    });
  } else {
    // Crear nuevo evento
    const newEvent = {
      id: uid(),
      title: task.t,
      date: eventDate,
      color: task.prio === "alta" ? "#e8639b" : task.prio === "baja" ? "#3ecf9a" : "#e8b04e",
      taskId: task.id,
    };
    set(s => {
      if (!s.events) s.events = [];
      s.events.push(newEvent);
      if (!s.taskCalendarMap) s.taskCalendarMap = {};
      s.taskCalendarMap[task.id] = newEvent.id;
    });
  }
}

/* Sincronizar evento → tarea */
export function syncEventToTask(event, data, set) {
  if (!event.title) return;

  const taskId = event.taskId || uid();
  const existing = data.tasks?.find(t => t.id === taskId);

  if (existing) {
    // Actualizar tarea existente
    set(s => {
      const tsk = s.tasks.find(t => t.id === taskId);
      if (tsk) tsk.due = formatDateToDue(event.date);
    });
  } else {
    // Crear nueva tarea
    const newTask = {
      id: taskId,
      t: event.title,
      due: formatDateToDue(event.date),
      desc: "",
      subject: null,
      prio: "media",
      xp: 20,
      status: "pendiente",
      done: false,
    };
    set(s => {
      if (!s.tasks) s.tasks = [];
      s.tasks.push(newTask);
      if (!s.taskCalendarMap) s.taskCalendarMap = {};
      s.taskCalendarMap[newTask.id] = event.id;
    });
  }
}

/* Limpiar eventos pasados automáticamente */
export function cleanupPastEvents(set) {
  const today = new Date().toISOString().split('T')[0];

  set(s => {
    if (!s.events) return;

    // Identificar eventos a borrar
    const toDelete = s.events.filter(e => {
      const eDate = e.date || new Date().toISOString().split('T')[0];
      return eDate < today;
    });

    // Limpiar mappings de tareas sincronizadas
    toDelete.forEach(e => {
      if (!s.taskCalendarMap) return;
      const taskIds = Object.keys(s.taskCalendarMap).filter(k => s.taskCalendarMap[k] === e.id);
      taskIds.forEach(tId => delete s.taskCalendarMap[tId]);
    });

    // Remover eventos
    s.events = s.events.filter(e => {
      const eDate = e.date || new Date().toISOString().split('T')[0];
      return eDate >= today;
    });
  });
}

export { formatDueToDate, formatDateToDue };
