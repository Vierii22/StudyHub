import React from 'react';

import { DndContext, DragOverlay, useDraggable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from './icons.jsx';
import { useStore, uid, toast, getAllTasks } from './store.jsx';
import { syncTaskToCalendar, formatDateToDue } from './syncEngine.js';
import { Card, CardTitle, PlanCell, HORAS, horaDe, fmtHora, periodoDe, PERIODO_ICON, DIAS_PLAN, startOfWeekPlan, isoOfPlan } from './facultad2.jsx';

/* ============================================================
   ORGANIZAR LA SEMANA — planificador general de TAREAS.
   Mismo patrón visual/interacción que "Planificar la semana"
   por materia (facultad2.jsx), pero para TODAS las tareas
   pendientes sin fecha — las generales Y las que viven adentro
   de cada materia ("Qué tengo que hacer", getAllTasks) — arrastrar
   (o tocar y tocar la celda) al día × franja de la semana. Al
   ubicarla se guarda la fecha en la tarea REAL (donde sea que
   viva) y se sincroniza sola con el Calendario, así se ve igual
   acá y en la materia — es el mismo dato, no una copia.
   ============================================================ */

/* encuentra dónde vive de verdad una tarea (global o adentro de una materia) */
function findTaskLocation(s, taskId) {
  if ((s.tasks || []).some(t => t.id === taskId)) return { kind: "global" };
  for (const sub of (s.subjects || [])) {
    if ((sub.lists?.tareas || []).some(t => t.id === taskId)) return { kind: "subject", subjectId: sub.id };
  }
  return null;
}

/* apariencia de la tarjeta — separada del "agarre" arrastrable para
   poder reusarla también en el DragOverlay (el fantasma que sigue al
   dedo/mouse). Antes el chip que se arrastraba era el elemento REAL de
   la lista, con el ancho de la columna angosta de origen (220px en el
   sidebar, o mucho menos adentro de una celda del calendario) — un
   título largo quedaba cortado o desbordado mientras lo arrastrabas.
   El DragOverlay dibuja una copia aparte con ancho fijo, prolija sin
   importar de dónde salió. */
const TaskChipVisual = ({ task, subj, selected }) => {
  const prioColor = task.prio === "alta" ? "#B8461A" : task.prio === "baja" ? "#7E8A4F" : "#C68A2E";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: selected ? "var(--org)" : "var(--field)", border: "1px solid " + (selected ? "var(--org)" : "var(--line)"), borderRadius: 8, padding: "6px 9px", fontSize: 12.5, fontWeight: 600, color: selected ? "#fff" : "var(--ink)", overflow: "hidden", maxWidth: "100%" }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: selected ? "#fff" : prioColor, flex: "0 0 auto" }} />
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.t}</span>
      {subj && <span className="mono" style={{ fontSize: 9, color: selected ? "#fff" : "var(--tx-3)", flex: "0 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {subj.name}</span>}
    </div>
  );
};

/* tarjeta de tarea arrastrable/tocable */
const TaskChip = ({ task, subj, placedId, selected, onSelect }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: placedId ? `plan-${placedId}` : `pool-${task.id}`, data: { taskId: task.id, placedId } });
  /* minWidth:0 es necesario ACÁ, no solo en el texto de adentro: este
     div es a su vez un ítem de grid/flex del padre, y por default esos
     ítems no se achican por debajo del ancho de su contenido aunque el
     texto de adentro sí sepa truncar — sin esto, el chip entero se
     queda con su ancho natural y se sale del contenedor angosto. */
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.3 : 1, cursor: "grab", touchAction: "none", minWidth: 0 };
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onClick={onSelect} style={style}>
      <TaskChipVisual task={task} subj={subj} selected={selected} />
    </div>
  );
};

const WeekPlanner = ({ onBack }) => {
  const [data, set] = useStore();
  const [weekStart, setWeekStart] = React.useState(() => startOfWeekPlan(new Date()));
  const [sel, setSel] = React.useState(null); /* id de tarea seleccionada para "tocar y colocar" */
  const [activeId, setActiveId] = React.useState(null); /* id de tarea que se está arrastrando ahora */
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const subjById = (id) => (data.subjects || []).find(s => s.id === id);
  const tasks = getAllTasks(data); /* generales + las "Qué tengo que hacer" de cada materia */
  const pending = tasks.filter(t => !t.done);
  const unlocated = pending.filter(t => !t.dueDate);

  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const weekIsos = weekDays.map(isoOfPlan);
  const placedThisWeek = pending.filter(t => t.dueDate && weekIsos.includes(t.dueDate));
  const todayISO = isoOfPlan(new Date());

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  /* encuentra y muta la tarea DONDE SEA que viva de verdad (global o adentro de una materia) —
     así queda sincronizada con "Qué tengo que hacer" de esa materia, es el mismo dato */
  const mutateTask = (s, taskId, patch) => {
    const loc = findTaskLocation(s, taskId);
    if (!loc) return;
    const t = loc.kind === "global"
      ? s.tasks.find(x => x.id === taskId)
      : s.subjects.find(x => x.id === loc.subjectId)?.lists?.tareas?.find(x => x.id === taskId);
    if (t) Object.assign(t, patch);
  };

  /* ubicar una tarea en día×franja: guarda fecha en la tarea real y sincroniza el evento del calendario */
  const placeTask = (taskId, iso, franja) => {
    set(s => mutateTask(s, taskId, { dueDate: iso, due: formatDateToDue(iso), franja }));
    /* Store.set muta en el lugar: getAllTasks(data) ya refleja el cambio acá mismo */
    const updated = getAllTasks(data).find(t => t.id === taskId);
    if (updated) syncTaskToCalendar(updated, data, set);
  };

  /* sacar una tarea de la semana: le borra la fecha (vuelve al pool) y limpia el evento vinculado */
  const unplaceTask = (taskId) => set(s => {
    mutateTask(s, taskId, { dueDate: "", due: "—", franja: null });
    const evId = s.taskCalendarMap?.[taskId];
    if (evId) { s.events = (s.events || []).filter(e => e.id !== evId); delete s.taskCalendarMap[taskId]; }
  });

  const onDragStart = ({ active }) => setActiveId(active.data.current?.taskId || null);
  const onDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over) return;
    const [, iso, horaStr] = String(over.id).split("|");
    const { taskId } = active.data.current;
    placeTask(taskId, iso, parseInt(horaStr, 10));
  };

  /* tocar-y-colocar: con una tarea seleccionada, tocar la celda la ubica ahí */
  const placeSelected = (iso, franja) => {
    if (!sel) return;
    placeTask(sel, iso, franja);
    setSel(null);
  };

  return (
    <div className="page">
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

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        {/* Franja angosta con las tareas sueltas — antes era una columna
            lateral que competía en tamaño con el calendario. Ahora es una
            tira horizontal chica arriba: elegís qué ubicar acá, y el
            calendario de abajo (ancho completo) es lo que manda en la
            pantalla, como pediste. */}
        <Card style={{ marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: unlocated.length ? 10 : 0, gap: 10 }}>
            <CardTitle icon="target">Tareas sin ubicar</CardTitle>
            {unlocated.length > 0 && <span className="mono plan-count">{unlocated.length}</span>}
          </div>
          {unlocated.length === 0
            ? <div className="small" style={{ color: "var(--tx-3)" }}>{pending.length === 0 ? "No tenés tareas pendientes." : "Todas tus tareas ya tienen día."}</div>
            : (
              <>
                <div className="small" style={{ color: sel ? "var(--org-deep)" : "var(--tx-3)", marginBottom: 10, lineHeight: 1.4 }}>{sel ? "Ahora tocá el día y la franja donde va 👇" : "Tocá una tarea y después la celda donde va (o arrastrala)."}</div>
                <div className="plan-tray">
                  {unlocated.map(t => <TaskChip key={t.id} task={t} subj={subjById(t.subject)} selected={sel === t.id} onSelect={() => setSel(sel === t.id ? null : t.id)} />)}
                </div>
              </>
            )}
        </Card>

        <Card style={{ overflowX: "auto" }}>
          <div className="grid planner-grid" style={{ gridTemplateColumns: "60px repeat(7,minmax(0,1fr))", gap: 6, minWidth: 900 }}>
              <div></div>
              {DIAS_PLAN.map((d, i) => {
                const esHoy = weekIsos[i] === todayISO;
                return (
                  <div key={d} className="mono" style={{ textAlign: "center", fontSize: 10.5, color: "var(--tx-3)", paddingBottom: 6 }}>
                    {d} <span className={esHoy ? "plan-hoy" : undefined} style={!esHoy ? { color: "var(--ink)", fontWeight: 700 } : undefined}>{weekDays[i].getDate()}</span>
                  </div>
                );
              })}
              {HORAS.map(hora => (
                <React.Fragment key={hora}>
                  <div className={`mono plan-hora-label periodo-${periodoDe(hora)}`}>
                    {hora % 3 === 0 && <Icon name={PERIODO_ICON[periodoDe(hora)]} size={11} />}
                    {fmtHora(hora)}
                  </div>
                  {weekIsos.map(iso => {
                    const items = placedThisWeek.filter(t => t.dueDate === iso && horaDe(t.franja) === hora);
                    return (
                      <PlanCell key={iso + hora} id={`cell|${iso}|${hora}`} periodo={periodoDe(hora)} onClick={sel ? () => placeSelected(iso, hora) : undefined}>
                        {items.map(t => (
                          <div key={t.id} className="row" style={{ gap: 4 }}>
                            <div style={{ flex: 1, minWidth: 0 }}><TaskChip task={t} subj={subjById(t.subject)} placedId={t.id} /></div>
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

        <DragOverlay dropAnimation={{ duration: 160, easing: "ease" }}>
          {activeTask ? <div style={{ width: 210 }}><TaskChipVisual task={activeTask} subj={subjById(activeTask.subject)} /></div> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export { WeekPlanner };
