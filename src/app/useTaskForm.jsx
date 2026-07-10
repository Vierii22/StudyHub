import React from 'react';

import { useStore, uid, toast } from './store.jsx';
import { Modal, Btn, Field } from './ui.jsx';
import { syncTaskToCalendar } from './syncEngine.js';

/* ============================================================
   HOOK + MODAL — crear/editar tareas, reutilizable en cualquier contexto
   Uso:
     const tf = useTaskForm();
     <button onClick={() => tf.open()}>+ Nueva</button>
     <button onClick={() => tf.open(task)}>Editar</button>
     <TaskFormModal hook={tf} />
   ============================================================ */

const defaultTask = (subjectId = null) => ({
  id: uid(),
  t: "",
  due: "—",
  dueDate: "",
  desc: "",
  subject: subjectId,
  prio: "media",
  xp: 20,
  status: "pendiente",
  done: false,
});

export function useTaskForm({ subjectId = null, onAfterSave } = {}) {
  const [data, set] = useStore();
  const [isOpen, setIsOpen] = React.useState(false);
  const [form, setForm]     = React.useState(() => defaultTask(subjectId));

  const isEdit = !!data.tasks?.find(t => t.id === form.id);
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const open = (task = null) => {
    setForm(task ? { ...task } : defaultTask(subjectId));
    setIsOpen(true);
  };

  const close = () => setIsOpen(false);

  const save = () => {
    const title = form.t?.trim();
    if (!title) return toast("Poné un título");

    const taskToSave = { ...form, t: title };

    if (isEdit) {
      set(s => {
        const idx = s.tasks.findIndex(t => t.id === taskToSave.id);
        if (idx !== -1) s.tasks[idx] = { ...s.tasks[idx], ...taskToSave };
      });
    } else {
      set(s => { if (!s.tasks) s.tasks = []; s.tasks.push(taskToSave); });
    }

    // Sync con calendario si tiene fecha válida
    if (taskToSave.due && taskToSave.due !== "—" && taskToSave.due !== "") {
      syncTaskToCalendar(taskToSave, data, set);
    }

    toast(isEdit ? "Tarea guardada" : "Tarea creada");
    onAfterSave?.();
    close();
  };

  const remove = () => {
    set(s => s.tasks = s.tasks.filter(t => t.id !== form.id));
    // Limpiar mapeo de calendario si existe
    set(s => {
      const evId = s.taskCalendarMap?.[form.id];
      if (evId) {
        s.events = (s.events || []).filter(e => e.id !== evId);
        delete s.taskCalendarMap[form.id];
      }
    });
    toast("Tarea eliminada");
    close();
  };

  return {
    isOpen, form, update, save, remove, open, close,
    subjects: data.subjects,
    isEdit,
  };
}

/* ── Modal visual ───────────────────────────────────────────── */
export function TaskFormModal({ hook }) {
  const { isOpen, form, update, save, remove, close, subjects, isEdit } = hook;
  if (!isOpen) return null;

  const handleDateChange = (raw) => {
    update("dueDate", raw);
    if (raw) {
      const [, m, d] = raw.split("-");
      update("due", `${parseInt(d)}/${parseInt(m)}`);
    } else {
      update("due", "—");
    }
  };

  return (
    <Modal
      title={isEdit ? "Editar tarea" : "Nueva tarea"}
      icon="check"
      onClose={close}
      footer={
        <>
          <span
            className="link"
            style={{ color: isEdit ? "var(--org-deep)" : "var(--tx-3)", cursor: "pointer" }}
            onClick={isEdit ? remove : close}
          >
            {isEdit ? "Eliminar" : "Cancelar"}
          </span>
          <Btn variant="primary" onClick={save}>Guardar</Btn>
        </>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="Título *">
          <input
            className="input"
            value={form.t}
            onChange={e => update("t", e.target.value)}
            autoFocus
            onKeyDown={e => e.key === "Enter" && save()}
          />
        </Field>
        <Field label="Descripción">
          <textarea
            className="input"
            rows={3}
            value={form.desc}
            onChange={e => update("desc", e.target.value)}
            placeholder="Detalles opcionales…"
            style={{ resize: "vertical" }}
          />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Prioridad">
            <select className="sel-input" style={{ width: "100%" }} value={form.prio} onChange={e => update("prio", e.target.value)}>
              <option value="alta">🔴 Alta</option>
              <option value="media">🟡 Media</option>
              <option value="baja">🟢 Baja</option>
            </select>
          </Field>
          <Field label="Estado">
            <select className="sel-input" style={{ width: "100%" }} value={form.status} onChange={e => update("status", e.target.value)}>
              <option value="pendiente">Pendiente</option>
              <option value="progreso">En progreso</option>
              <option value="lista">Lista</option>
            </select>
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Materia">
            <select
              className="sel-input"
              style={{ width: "100%" }}
              value={form.subject || ""}
              onChange={e => update("subject", e.target.value || null)}
            >
              <option value="">Sin materia</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="XP">
            <input
              className="input"
              type="number"
              value={form.xp}
              onChange={e => update("xp", +e.target.value)}
              min={0}
            />
          </Field>
        </div>
        <Field label="Fecha límite">
          <input
            className="input"
            type="date"
            value={form.dueDate || ""}
            onChange={e => handleDateChange(e.target.value)}
            style={{ colorScheme: "dark" }}
          />
          {form.due && form.due !== "—" && form.due !== "" && (
            <div className="mono" style={{ fontSize: 10, marginTop: 5, color: "var(--violet-hi)" }}>
              🗓 Se va a crear un evento en el Calendario
            </div>
          )}
        </Field>
      </div>
    </Modal>
  );
}

export { defaultTask };
