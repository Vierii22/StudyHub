import React from 'react';

import { uid, toast } from './store.jsx';
import { syncTaskToCalendar, cleanupPastEvents } from './syncEngine.js';

/* ============================================================
   HOOK REUTILIZABLE — modal de crear/editar tareas
   Usado en: Dashboard, Tareas, Facultad2 (materias), Calendario
   ============================================================ */

const defaultTask = (subjectId = null) => ({
  id: uid(),
  t: "",
  due: "—",
  desc: "",
  subject: subjectId,
  prio: "media",
  xp: 20,
  status: "pendiente",
  done: false,
});

export function useTaskForm(initialTask = null, { subjects = [], onSave = null } = {}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [form, setForm] = React.useState(initialTask ? { ...initialTask } : defaultTask());

  const update = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const save = (data, set) => {
    if (!form.t.trim()) {
      toast("Poné un título para la tarea");
      return;
    }

    if (onSave) {
      onSave(form);
    } else if (set) {
      // Usar con store
      const existing = data?.tasks?.find(t => t.id === form.id);
      if (existing) {
        // Editar
        set(s => Object.assign(s.tasks.find(t => t.id === form.id), form));
      } else {
        // Crear
        set(s => {
          if (!s.tasks) s.tasks = [];
          s.tasks.push(form);
        });
      }

      // Sync con calendario si tiene due date
      if (form.due && form.due !== "—") {
        syncTaskToCalendar(form, data, set);
      }
    }

    toast(initialTask ? "Tarea actualizada" : "Tarea creada");
    close();
  };

  const open = (task = null, subjectId = null) => {
    if (task) {
      setForm({ ...task });
    } else {
      setForm(defaultTask(subjectId));
    }
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
  };

  return {
    isOpen,
    form,
    update,
    save,
    open,
    close,
    subjects,
  };
}

export { defaultTask };
