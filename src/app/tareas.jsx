import React from 'react';

import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, COLORS, PRIO, STATUS } from './store.jsx';
import { Btn, Chip, Modal, Field, PageHead, Empty, MonoLabel } from './ui.jsx';

/* ============================================================
   TAREAS — vistas tabla / cards / materias + modal detalle
   ============================================================ */
const PrioBadge = ({ p }) => <span className="prio" style={{ color: PRIO[p], background: PRIO[p] + "22" }}>{p}</span>;
const StatusBadge = ({ st }) => {
  const c = st === "lista" ? "#3ecf9a" : st === "progreso" ? "#e8b04e" : "var(--tx-2)";
  return <span className="chip" style={{ color: c, borderColor: c + "55", background: c + "15", fontSize: 10 }}>{STATUS[st]}</span>;
};
const DueBadge = ({ due }) => {
  const isToday = due === "Hoy";
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, color: isToday ? "#e8b04e" : "var(--tx-3)" }}>{isToday ? "¡HOY!" : due}</span>;
};

const TaskModal = ({ task, onClose }) => {
  const [data, set] = useStore();
  const [f, setF] = React.useState(task);
  const up = (k, v) => setF(x => ({ ...x, [k]: v }));
  const save = () => { set(s => Object.assign(s.tasks.find(t => t.id === task.id), f)); toast("Tarea guardada"); onClose(); };
  return (
    <Modal title="Detalle de tarea" icon="check" onClose={onClose}
      footer={<><span className="link" style={{ color: "#e8639b" }} onClick={() => { set(s => s.tasks = s.tasks.filter(t => t.id !== task.id)); toast("Tarea eliminada"); onClose(); }}>Eliminar</span><Btn variant="primary" onClick={save}>Guardar</Btn></>}>
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="Nombre"><input className="input" value={f.t} onChange={e => up("t", e.target.value)} /></Field>
        <Field label="Descripción"><textarea className="input" rows={3} value={f.desc} onChange={e => up("desc", e.target.value)} placeholder="Detalles…" /></Field>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Prioridad"><select className="sel-input" style={{ width: "100%" }} value={f.prio} onChange={e => up("prio", e.target.value)}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></Field>
          <Field label="Estado"><select className="sel-input" style={{ width: "100%" }} value={f.status} onChange={e => up("status", e.target.value)}><option value="pendiente">Pendiente</option><option value="progreso">En progreso</option><option value="lista">Lista</option></select></Field>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Materia"><select className="sel-input" style={{ width: "100%" }} value={f.subject || ""} onChange={e => up("subject", e.target.value || null)}><option value="">Sin materia</option>{data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="XP"><input className="input" type="number" value={f.xp} onChange={e => up("xp", +e.target.value)} /></Field>
        </div>
        <Field label="Fecha límite"><input className="input" value={f.due} onChange={e => up("due", e.target.value)} placeholder="Ej: 12 jun / Hoy" /></Field>
      </div>
    </Modal>
  );
};

const Tareas = ({ onOpenSubject }) => {
  const [data, set] = useStore();
  const [view, setView] = React.useState(() => window.innerWidth < 768 ? "cards" : "tabla");
  const [sort, setSort] = React.useState("creacion");
  const [hideListed, setHideListed] = React.useState(false);
  const [detail, setDetail] = React.useState(null);
  const [draft, setDraft] = React.useState("");

  let tasks = [...data.tasks];
  if (hideListed) tasks = tasks.filter(t => !t.done);
  const order = { alta: 0, media: 1, baja: 2 };
  if (sort === "prioridad") tasks.sort((a, b) => order[a.prio] - order[b.prio]);
  if (sort === "nombre") tasks.sort((a, b) => a.t.localeCompare(b.t));

  const subjOf = (id) => data.subjects.find(s => s.id === id);
  const toggleDone = (id) => set(s => { const t = s.tasks.find(x => x.id === id); t.done = !t.done; t.status = t.done ? "lista" : "pendiente"; });
  const del = (id) => { set(s => s.tasks = s.tasks.filter(t => t.id !== id)); toast("Tarea eliminada"); };
  const add = () => { if (draft.trim()) { set(s => s.tasks.push({ id: uid(), t: draft.trim(), desc: "", subject: null, due: "—", prio: "media", xp: 20, status: "pendiente", done: false })); setDraft(""); toast("Tarea agregada"); } };

  const AddBar = () => (
    <form className="row" style={{ gap: 10, padding: "16px 22px" }} onSubmit={e => { e.preventDefault(); add(); }}>
      <input className="input" placeholder="Agregar nueva tarea y enter…" value={draft} onChange={e => setDraft(e.target.value)} />
      <Btn variant="primary" icon="plus" style={{ flex: "0 0 auto" }}></Btn>
    </form>
  );

  return (
    <div className="page page-wide">
      <PageHead title="Tareas" meta={`${data.tasks.length} en total · ${data.tasks.filter(t => t.done).length} completas`}>
        <select className="sel-input" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="creacion">Creación</option><option value="prioridad">Prioridad</option><option value="nombre">Nombre</option>
        </select>
        <Btn variant={hideListed ? "primary" : "secondary"} icon="check" onClick={() => setHideListed(h => !h)}>Ocultar listas</Btn>
        <div className="seg">
          <button className={view === "tabla" ? "on" : ""} onClick={() => setView("tabla")}><Icon name="list" size={14} /> Tabla</button>
          <button className={view === "cards" ? "on" : ""} onClick={() => setView("cards")}><Icon name="grid" size={14} /> Cards</button>
          <button className={view === "materias" ? "on" : ""} onClick={() => setView("materias")}><Icon name="book" size={14} /> Materias</button>
        </div>
      </PageHead>

      {/* stats */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 24 }}>
        {[["Pendientes", data.tasks.filter(t => !t.done).length, data.tasks.filter(t => t.prio === "alta" && !t.done).length + " de alta prioridad"],
          ["Para hoy", data.tasks.filter(t => t.due === "Hoy").length, "Vencen hoy"],
          ["Completadas", data.tasks.filter(t => t.done).length, "Esta semana"]].map(([l, v, sub]) => (
          <div key={l} className="card"><MonoLabel>{l}</MonoLabel><div className="stat" style={{ fontSize: 48, marginTop: 12 }}>{v}</div><div className="small" style={{ marginTop: 8 }}>{sub}</div></div>
        ))}
      </div>

      {/* VISTA TABLA */}
      {view === "tabla" && (
        <div className="card card-flush">
          {tasks.length === 0 && <div className="empty" style={{ padding: 40 }}><span className="small">No tenés tareas. Agregá una abajo.</span></div>}
          {tasks.map(t => (
            <div key={t.id} className="task-row" style={{ opacity: t.done ? .5 : 1 }}>
              <div className="cbox" onClick={() => toggleDone(t.id)} style={t.done ? { background: "var(--violet)", borderColor: "var(--violet)" } : {}}>{t.done && <Icon name="check" size={13} color="#fff" />}</div>
              <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setDetail(t)}>
                <div style={{ fontSize: 14.5, fontWeight: 500, textDecoration: t.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.t}</div>
                <div className="row" style={{ gap: 7, marginTop: 5, flexWrap: "wrap" }}>
                  {subjOf(t.subject) && <span className="mono" style={{ fontSize: 10, color: subjOf(t.subject).color }}>{subjOf(t.subject).name}</span>}
                  <PrioBadge p={t.prio} />
                  {t.due && t.due !== "—" && <DueBadge due={t.due} />}
                </div>
              </div>
              <div className="row" style={{ gap: 4, flex: "0 0 auto" }}>
                <StatusBadge st={t.status} />
                <div className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setDetail(t)}><Icon name="edit" size={14} /></div>
                <div className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => del(t.id)}><Icon name="trash" size={14} /></div>
              </div>
            </div>
          ))}
          <AddBar />
        </div>
      )}

      {/* VISTA CARDS */}
      {view === "cards" && (
        <>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))", marginBottom: 16 }}>
            {tasks.map(t => (
              <div key={t.id} className="card hoverable" style={{ opacity: t.done ? .55 : 1 }}>
                <div className="row between" style={{ marginBottom: 14 }}>
                  <div className="row" style={{ gap: 11 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-2)", display: "grid", placeItems: "center", fontWeight: 700, color: "var(--violet-hi)", fontFamily: "var(--font-display)" }}>{t.t[0]}</div>
                    <span style={{ width: 9, height: 9, borderRadius: 99, background: PRIO[t.prio] }}></span>
                  </div>
                  <StatusBadge st={t.status} />
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 600, cursor: "pointer" }} onClick={() => setDetail(t)}>{t.t}</div>
                {t.desc && <div className="small" style={{ marginTop: 6 }}>{t.desc}</div>}
                <div className="row between" style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                  <DueBadge due={t.due} />
                  <div className="row" style={{ gap: 4 }}>
                    <div className="cbox" onClick={() => toggleDone(t.id)} style={t.done ? { background: "var(--violet)", borderColor: "var(--violet)" } : {}}>{t.done && <Icon name="check" size={13} color="#fff" />}</div>
                    <div className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setDetail(t)}><Icon name="edit" size={14} /></div>
                    <div className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => del(t.id)}><Icon name="trash" size={14} /></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="card card-flush"><AddBar /></div>
        </>
      )}

      {/* VISTA MATERIAS */}
      {view === "materias" && (
        <div style={{ display: "grid", gap: 22 }}>
          {[...data.subjects, { id: null, name: "General", color: "#5d5d68" }].map(sub => {
            const ts = tasks.filter(t => t.subject === sub.id);
            if (ts.length === 0 && sub.id !== null) return null;
            return (
              <div key={sub.id || "gen"} className="card card-flush">
                <div className="row between" style={{ padding: "16px 22px", borderBottom: "1px solid var(--line)" }}>
                  <div className="row" style={{ gap: 12 }}>
                    <span style={{ width: 4, height: 22, borderRadius: 99, background: sub.color }}></span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>{sub.name}</span>
                    <Chip>{ts.length}</Chip>
                  </div>
                  {sub.id && <span className="link" style={{ fontSize: 13 }} onClick={() => onOpenSubject(sub.id)}>Abrir materia →</span>}
                </div>
                {ts.length === 0 && <div className="empty" style={{ padding: 24 }}><span className="small">Sin tareas</span></div>}
                {ts.map(t => (
                  <div key={t.id} className="row" style={{ padding: "13px 22px", borderBottom: "1px solid var(--line)", gap: 14, opacity: t.done ? .5 : 1 }}>
                    <div className="cbox" onClick={() => toggleDone(t.id)} style={t.done ? { background: "var(--violet)", borderColor: "var(--violet)" } : {}}>{t.done && <Icon name="check" size={13} color="#fff" />}</div>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500, textDecoration: t.done ? "line-through" : "none", cursor: "pointer" }} onClick={() => setDetail(t)}>{t.t}</span>
                    <PrioBadge p={t.prio} /><DueBadge due={t.due} />
                  </div>
                ))}
              </div>
            );
          })}
          <div className="card card-flush"><AddBar /></div>
        </div>
      )}

      {detail && <TaskModal task={detail} onClose={() => setDetail(null)} />}
    </div>
  );
};

export { Tareas, TaskModal, PrioBadge, StatusBadge, DueBadge };