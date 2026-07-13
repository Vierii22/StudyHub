import React from 'react';

import { Icon } from './icons.jsx';
import { useStore, uid, toast, PRIO, getAllTasks, todayLocal } from './store.jsx';
import { Btn, PageHead, Empty, MonoLabel } from './ui.jsx';
import { useTaskForm, TaskFormModal } from './useTaskForm.jsx';

/* ============================================================
   TAREAS — vista general: por materia → por prioridad
   (toggle a "por fecha"). Junta las tareas globales + las de
   cada materia (getAllTasks). Reusa el modal de useTaskForm.
   ============================================================ */
const PRIO_RANK = { alta: 0, media: 1, baja: 2 };
const sortTasks = (arr) => [...arr].sort((a, b) => (Number(a.done) - Number(b.done)) || (PRIO_RANK[a.prio] - PRIO_RANK[b.prio]));

const PrioBadge  = ({ p })  => <span className="prio" style={{ color: PRIO[p], background: PRIO[p] + "22" }}>{p}</span>;
const StatusBadge = ({ st }) => {
  const c = st === "lista" ? "#3B6D11" : st === "progreso" ? "#C68A2E" : "var(--tx-2)";
  return <span className="chip" style={{ color: c, borderColor: c + "55", background: c + "15", fontSize: 10 }}>{st === "lista" ? "Lista" : st === "progreso" ? "En progreso" : "Pendiente"}</span>;
};
const DueBadge = ({ due }) => {
  const isToday = due === "Hoy";
  if (!due || due === "—") return <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tx-3)", minWidth: 36, textAlign: "right" }}>—</span>;
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? "var(--org-deep)" : "var(--tx-3)", minWidth: 36, textAlign: "right" }}>{isToday ? "HOY" : due}</span>;
};

/* fila de tarea reutilizable */
const TaskLine = ({ t, onToggle, onEdit, onDelete, last }) => (
  <div className="tsk-line" style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: last ? "none" : "1px solid #eee4d4", opacity: t.done ? 0.5 : 1 }}>
    <div className={`cbox${t.done ? " on" : ""}`} onClick={() => onToggle(t)}>{t.done && <Icon name="check" size={13} color="#fff" />}</div>
    <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onEdit(t)}>
      <div style={{ fontSize: 14, fontWeight: 600, textDecoration: t.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.t}</div>
    </div>
    <PrioBadge p={t.prio} />
    <DueBadge due={t.due} />
    <span className="tsk-del" onClick={() => onDelete(t)} title="Eliminar" style={{ cursor: "pointer", color: "var(--tx-3)", flex: "0 0 auto", display: "flex" }}><Icon name="x" size={14} /></span>
  </div>
);

const Tareas = ({ onOpenSubject, autoNew }) => {
  const [data, set] = useStore();
  const [group, setGroup] = React.useState("materia"); /* materia | fecha */
  const tf = useTaskForm();

  React.useEffect(() => { if (autoNew) tf.open(); }, []);

  const allTasks = getAllTasks(data);
  const subjects = data.subjects || [];

  /* toggle done y delete — robustos: sirven para tareas globales y de materia */
  const toggleDone = (task) => set(s => {
    const today = todayLocal();
    const g = s.tasks.find(x => x.id === task.id);
    if (g) { g.done = !g.done; g.status = g.done ? "lista" : "pendiente"; g.completedAt = g.done ? today : null; return; }
    const sub = s.subjects.find(x => x.id === task.subject);
    const it = sub?.lists?.tareas?.find(x => x.id === task.id);
    if (it) { it.done = !it.done; it.completedAt = it.done ? today : null; }
  });
  const del = (task) => set(s => {
    if (s.tasks.some(x => x.id === task.id)) { s.tasks = s.tasks.filter(t => t.id !== task.id); toast("Tarea eliminada"); return; }
    const sub = s.subjects.find(x => x.id === task.subject);
    if (sub?.lists?.tareas) { sub.lists.tareas = sub.lists.tareas.filter(x => x.id !== task.id); toast("Tarea eliminada"); }
  });

  /* ── agrupaciones ── */
  const bySubject = () => {
    const groups = subjects
      .map(sub => ({ sub, tasks: sortTasks(allTasks.filter(t => t.subject === sub.id)) }))
      .filter(g => g.tasks.length > 0);
    const general = sortTasks(allTasks.filter(t => !t.subject || !subjects.some(s => s.id === t.subject)));
    if (general.length) groups.push({ sub: { id: null, name: "General", color: "#8a7f6d" }, tasks: general });
    return groups;
  };
  const byDate = () => ([
    { key: "hoy", label: "Hoy", dot: "var(--org)", tasks: sortTasks(allTasks.filter(t => t.due === "Hoy")) },
    { key: "fecha", label: "Con fecha", dot: "#8a7a3f", tasks: sortTasks(allTasks.filter(t => t.due && t.due !== "—" && t.due !== "Hoy")) },
    { key: "sin", label: "Sin fecha", dot: "#cbbfa8", tasks: sortTasks(allTasks.filter(t => !t.due || t.due === "—")) },
  ].filter(g => g.tasks.length > 0));

  const groups = group === "materia" ? bySubject() : byDate();

  const hoy = todayLocal();
  const pendientes = allTasks.filter(t => !t.done).length;
  const paraHoy    = allTasks.filter(t => t.due === "Hoy").length;
  const completas  = allTasks.filter(t => t.completedAt === hoy).length; /* se reinicia a medianoche */

  return (
    <div className="page page-wide">
      <PageHead title="Tareas" meta={`${allTasks.length} en total · ${paraHoy} para hoy`}>
        <div className="seg">
          <button className={group === "materia" ? "on" : ""} onClick={() => setGroup("materia")}><Icon name="layers" size={14} /> Por materia</button>
          <button className={group === "fecha" ? "on" : ""} onClick={() => setGroup("fecha")}><Icon name="calendar" size={14} /> Por fecha</button>
        </div>
        <Btn variant="primary" icon="plus" onClick={() => tf.open()}>Nueva tarea</Btn>
      </PageHead>

      {/* stats */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 24, gap: 12 }}>
        {[
          ["Pendientes", pendientes, "var(--ink)"],
          ["Para hoy",   paraHoy,    "var(--org-deep)"],
          ["Completadas hoy",completas,  "#3B6D11"],
        ].map(([l, v, c]) => (
          <div key={l} className="card">
            <MonoLabel>{l}</MonoLabel>
            <div className="stat" style={{ fontSize: 40, marginTop: 8, color: c }}>{v}</div>
          </div>
        ))}
      </div>

      {groups.length === 0 && (
        <Empty hubby="idle" title="Sin tareas todavía" sub='Creá una con "Nueva tarea" arriba.' />
      )}

      {groups.map((g, gi) => (
        <div key={g.sub ? (g.sub.id || "gen") : g.key} className="tsk-group" style={{ marginBottom: 18, animationDelay: `${gi * 60}ms` }}>
          <div className="row" style={{ gap: 10, margin: "0 0 8px 4px", alignItems: "center" }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: g.sub ? g.sub.color : g.dot, display: "inline-block", flex: "0 0 auto" }} />
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "var(--ink)" }}>
              {(g.sub ? g.sub.name : g.label).toUpperCase()}
            </span>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--tx-3)" }}>· {g.tasks.filter(t => !t.done).length} pendientes</span>
            {g.sub && g.sub.id && (
              <span className="link" style={{ fontSize: 12, marginLeft: "auto" }} onClick={() => onOpenSubject(g.sub.id)}>Abrir materia →</span>
            )}
          </div>
          <div className="card card-flush">
            {g.tasks.map((t, i) => (
              <TaskLine key={t.id} t={t} last={i === g.tasks.length - 1}
                onToggle={toggleDone} onEdit={tf.open} onDelete={del} />
            ))}
          </div>
        </div>
      ))}

      <TaskFormModal hook={tf} />
    </div>
  );
};

export { Tareas, PrioBadge, StatusBadge, DueBadge };
