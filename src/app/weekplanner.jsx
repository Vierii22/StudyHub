import React from 'react';

import { DndContext, useDraggable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from './icons.jsx';
import { useStore, uid, toast } from './store.jsx';
import { syncTaskToCalendar, formatDateToDue } from './syncEngine.js';
import { Card, CardTitle, PlanCell, FRANJAS, DIAS_PLAN, startOfWeekPlan, isoOfPlan } from './facultad2.jsx';

/* ============================================================
   ORGANIZAR LA SEMANA — planificador general de TAREAS.
   Mismo patrón visual/interacción que "Planificar la semana"
   por materia (facultad2.jsx), pero para todas las tareas
   pendientes sin fecha: arrastrar (o tocar y tocar la celda)
   al día × franja de la semana. Al ubicarla, se guarda la fecha
   en la tarea y se sincroniza sola con el Calendario.
   ============================================================ */

/* tarjeta de tarea arrastrable/tocable — mismo look que PlanChip del planificador por materia */
const TaskChip = ({ task, placedId, selected, onSelect }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: placedId ? `plan-${placedId}` : `pool-${task.id}`, data: { taskId: task.id, placedId } });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 };
  const prioColor = task.prio === "alta" ? "#B8461A" : task.prio === "baja" ? "#7E8A4F" : "#C68A2E";
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onClick={onSelect}
      style={{ ...style, display: "flex", alignItems: "center", gap: 6, background: selected ? "var(--org)" : "var(--field)", border: "1px solid " + (selected ? "var(--org)" : "var(--line)"), borderRadius: 8, padding: "6px 9px", fontSize: 12.5, fontWeight: 600, color: selected ? "#fff" : "var(--ink)", cursor: "grab", touchAction: "none" }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: selected ? "#fff" : prioColor, flex: "0 0 auto" }} />
      {task.t}
    </div>
  );
};

const WeekPlanner = ({ onBack }) => {
  const [data, set] = useStore();
  const [weekStart, setWeekStart] = React.useState(() => startOfWeekPlan(new Date()));
  const [sel, setSel] = React.useState(null); /* id de tarea seleccionada para "tocar y colocar" */
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const tasks = data.tasks || [];
  const pending = tasks.filter(t => !t.done);
  const unlocated = pending.filter(t => !t.dueDate);

  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const weekIsos = weekDays.map(isoOfPlan);
  const placedThisWeek = pending.filter(t => t.dueDate && weekIsos.includes(t.dueDate));

  /* ubicar una tarea en día×franja: guarda fecha en la tarea y sincroniza el evento del calendario */
  const placeTask = (taskId, iso, franja) => {
    set(s => {
      const t = s.tasks.find(x => x.id === taskId);
      if (!t) return;
      t.dueDate = iso;
      t.due = formatDateToDue(iso);
      t.franja = franja;
    });
    /* Store.set muta en el lugar: `data` ya refleja el cambio acá mismo */
    const updated = data.tasks.find(t => t.id === taskId);
    if (updated) syncTaskToCalendar(updated, data, set);
  };

  /* sacar una tarea de la semana: le borra la fecha (vuelve al pool) y limpia el evento vinculado */
  const unplaceTask = (taskId) => set(s => {
    const t = s.tasks.find(x => x.id === taskId);
    if (!t) return;
    t.dueDate = ""; t.due = "—"; t.franja = null;
    const evId = s.taskCalendarMap?.[taskId];
    if (evId) { s.events = (s.events || []).filter(e => e.id !== evId); delete s.taskCalendarMap[taskId]; }
  });

  const onDragEnd = ({ active, over }) => {
    if (!over) return;
    const [, iso, franja] = String(over.id).split("|");
    const { taskId } = active.data.current;
    placeTask(taskId, iso, franja);
  };

  /* tocar-y-colocar: con una tarea seleccionada, tocar la celda la ubica ahí */
  const placeSelected = (iso, franja) => {
    if (!sel) return;
    placeTask(sel, iso, franja);
    setSel(null);
  };

  return (
    <div className="page page-wide">
      <div className="row between planner-head" style={{ marginBottom: 18, alignItems: "flex-end", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: "var(--tx-3)", fontWeight: 500, marginBottom: 8 }}>
            <span onClick={onBack} style={{ cursor: "pointer", color: "var(--org)", fontWeight: 600 }}>← Hoy</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--ink)", margin: 0 }}>Organizar la semana</h1>
        </div>
        <div className="seg" style={{ padding: 3, flex: "0 0 auto" }}>
          <button onClick={() => setWeekStart(d => { const x = new Date(d); x.setDate(x.getDate() - 7); return x; })} style={{ padding: "7px 10px" }}><Icon name="chevL" size={15} /></button>
          <button className="on" style={{ padding: "7px 14px" }}>{weekDays[0].getDate()} — {weekDays[6].getDate()}</button>
          <button onClick={() => setWeekStart(d => { const x = new Date(d); x.setDate(x.getDate() + 7); return x; })} style={{ padding: "7px 10px" }}><Icon name="chevR" size={15} /></button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid" style={{ gridTemplateColumns: "220px 1fr", gap: 18, alignItems: "start" }}>
          <Card>
            <CardTitle icon="target">Tareas sin ubicar</CardTitle>
            {unlocated.length === 0
              ? <div className="small" style={{ color: "var(--tx-3)" }}>{pending.length === 0 ? "No tenés tareas pendientes." : "Todas tus tareas ya tienen día."}</div>
              : <div className="small" style={{ color: sel ? "var(--org-deep)" : "var(--tx-3)", marginBottom: 10, lineHeight: 1.4 }}>{sel ? "Ahora tocá el día y la franja donde va 👇" : "Tocá una tarea y después la celda donde va (o arrastrala)."}</div>}
            <div style={{ display: "grid", gap: 8 }}>
              {unlocated.map(t => <TaskChip key={t.id} task={t} selected={sel === t.id} onSelect={() => setSel(sel === t.id ? null : t.id)} />)}
            </div>
          </Card>

          <Card style={{ overflowX: "auto" }}>
            <div className="grid planner-grid" style={{ gridTemplateColumns: "70px repeat(7,1fr)", gap: 8, minWidth: 720 }}>
              <div></div>
              {DIAS_PLAN.map((d, i) => <div key={d} className="mono" style={{ textAlign: "center", fontSize: 10.5, color: "var(--tx-3)" }}>{d} <span style={{ color: "var(--ink)", fontWeight: 700 }}>{weekDays[i].getDate()}</span></div>)}
              {FRANJAS.map(([fk, flabel]) => (
                <React.Fragment key={fk}>
                  <div className="mono" style={{ fontSize: 10, color: "var(--tx-3)", display: "flex", alignItems: "center" }}>{flabel.toUpperCase()}</div>
                  {weekIsos.map(iso => {
                    const items = placedThisWeek.filter(t => t.dueDate === iso && (t.franja || "m") === fk);
                    return (
                      <PlanCell key={iso + fk} id={`cell|${iso}|${fk}`} onClick={sel ? () => placeSelected(iso, fk) : undefined}>
                        {items.map(t => (
                          <div key={t.id} className="row" style={{ gap: 4 }}>
                            <div style={{ flex: 1, minWidth: 0 }}><TaskChip task={t} placedId={t.id} /></div>
                            <span onClick={(e) => { e.stopPropagation(); unplaceTask(t.id); }} style={{ cursor: "pointer", color: "var(--tx-3)", flex: "0 0 auto" }}><Icon name="x" size={12} /></span>
                          </div>
                        ))}
                      </PlanCell>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </Card>
        </div>
      </DndContext>
    </div>
  );
};

export { WeekPlanner };
