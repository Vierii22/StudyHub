import React from 'react';

import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from './icons.jsx';
import { useStore, uid, toast } from './store.jsx';
import { SubjectModal, SubjectFiles } from './facultad.jsx';

/* ============================================================
   INTERIOR DE UNA MATERIA — rediseño cálido (mockup v5)
   Qué hacer · Anotaciones · Temario con estados · Parciales/TPs · Archivos
   ============================================================ */

/* color del puntito según el estado más avanzado del tema */
const stateColor = (it) => (it.repasos > 0) ? "#639922" : it.estudiado ? "var(--ink)" : it.resumido ? "var(--org)" : "#cfc3ae";

const Card = ({ children, style }) => (
  <div style={{ background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 16, padding: "16px 18px", boxShadow: "0 2px 0 #e0d5c3, 0 6px 14px rgba(58,51,43,.05)", ...style }}>{children}</div>
);

const CardTitle = ({ icon, children, right }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
      {icon && <span style={{ color: "var(--org)", display: "flex" }}><Icon name={icon} size={16} /></span>}{children}
    </div>
    {right}
  </div>
);

const AddInput = ({ placeholder, onAdd }) => {
  const [v, setV] = React.useState("");
  const submit = (e) => { e.preventDefault(); const t = v.trim(); if (t) { onAdd(t); setV(""); } };
  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, marginTop: 11 }}>
      <input value={v} onChange={e => setV(e.target.value)} placeholder={placeholder}
        style={{ flex: 1, background: "var(--field)", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 13.5, color: "var(--tx-1)", fontFamily: "var(--font-body)" }} />
      <button type="submit" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "0 13px", color: "var(--org)", cursor: "pointer", boxShadow: "0 2px 0 #e0d5c3" }}><Icon name="plus" size={16} /></button>
    </form>
  );
};

const FOLDERS = [
  { k: "material",  label: "Material",  icon: "book" },
  { k: "resumenes", label: "Resúmenes", icon: "fileText" },
  { k: "clases",    label: "Clases",    icon: "layers" },
];

/* ============================================================
   DETALLE DE UN TEMA (DESIGN.md punto 4)
   Mi explicación · Videos/links · Material
   ============================================================ */
const TemaDetail = ({ subject, tema, onBack, onUpdate }) => (
  <div className="page page-cozy">
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12.5, color: "var(--tx-3)", fontWeight: 500, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <span onClick={onBack} style={{ cursor: "pointer", color: "var(--org)", fontWeight: 600 }}>← {subject.name}</span>
        <span>·</span><span style={{ width: 8, height: 8, borderRadius: "50%", background: stateColor(tema) }} />
        {tema.repasos > 0 && <span className="rep" style={{ background: "#E4EEDB", color: "#3B6D11" }}><Icon name="refresh" size={11} /> {tema.repasos}</span>}
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-.5px", color: "var(--ink)", margin: 0 }}>{tema.t}</h1>
    </div>

    <Card style={{ marginBottom: 14 }}>
      <CardTitle icon="pen">Mi explicación</CardTitle>
      <textarea
        value={tema.explicacion || ""}
        onChange={e => onUpdate({ explicacion: e.target.value })}
        placeholder="Explicalo con tus palabras — te va a servir para repasar después…"
        rows={6}
        style={{ width: "100%", background: "var(--field)", border: "1px solid var(--line)", borderRadius: 11, padding: "12px 14px", fontSize: 14, color: "var(--soft)", fontFamily: "var(--font-body)", lineHeight: 1.6, resize: "vertical" }} />
    </Card>

    <Card style={{ marginBottom: 14 }}>
      <CardTitle icon="link">Videos / links</CardTitle>
      {(tema.videos || []).length === 0 && <div style={{ fontSize: 13, color: "var(--tx-3)" }}>Sin videos ni links todavía.</div>}
      {(tema.videos || []).map((v, i) => (
        <div key={v.id || i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderBottom: "1px solid #eee4d4" }}>
          <Icon name="play" size={13} color="var(--org)" />
          <a href={v.url?.startsWith("http") ? v.url : "https://" + v.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 13.5, color: "var(--soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.url}</a>
          <span onClick={() => onUpdate({ videos: (tema.videos || []).filter((_, j) => j !== i) })} style={{ cursor: "pointer", color: "var(--tx-3)" }}><Icon name="x" size={13} /></span>
        </div>
      ))}
      <AddInput placeholder="Pegar link y enter…" onAdd={url => onUpdate({ videos: [...(tema.videos || []), { id: uid(), url }] })} />
    </Card>

    <Card>
      <CardTitle icon="paperclip">Material</CardTitle>
      <SubjectFiles files={tema.files || []} onChange={v => onUpdate({ files: v })} accent={subject.color} />
    </Card>
  </div>
);

/* ============================================================
   PLANIFICAR LA SEMANA (por materia) — DESIGN.md punto 5
   Temas sin ubicar (solo de esta materia) + grilla Lun-Dom ×
   Mañana/Tarde/Noche, arrastrando con dnd-kit.
   ============================================================ */
const FRANJAS = [["m", "Mañana"], ["t", "Tarde"], ["n", "Noche"]];
const DIAS_PLAN = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const startOfWeekPlan = (d) => { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); x.setHours(0, 0, 0, 0); return x; };
const isoOfPlan = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const PlanChip = ({ tema, planId }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: planId ? `plan-${planId}` : `pool-${tema.id}`, data: { temaId: tema.id, planId } });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 };
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ ...style, display: "flex", alignItems: "center", gap: 6, background: "var(--field)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 9px", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", cursor: "grab", touchAction: "none" }}>
      <Icon name="dots" size={12} color="var(--tx-3)" />{tema.t}
    </div>
  );
};

const PlanCell = ({ id, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} style={{ minHeight: 56, borderRadius: 9, padding: 6, display: "flex", flexDirection: "column", gap: 6, background: isOver ? "var(--field)" : "transparent", border: "1px dashed " + (isOver ? "var(--org)" : "var(--line)"), transition: "background .12s ease" }}>{children}</div>;
};

const StudyPlanner = ({ subject, onBack, onChangePlan }) => {
  const [weekStart, setWeekStart] = React.useState(() => startOfWeekPlan(new Date()));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const temas = subject.lists?.temas || [];
  const plan = subject.studyPlan || [];
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const weekIsos = weekDays.map(isoOfPlan);
  const placedThisWeek = plan.filter(p => weekIsos.includes(p.date));
  const unlocated = temas.filter(t => !placedThisWeek.some(p => p.temaId === t.id));

  const onDragEnd = ({ active, over }) => {
    if (!over) return;
    const [, iso, franja] = over.id.split("|");
    const { temaId, planId } = active.data.current;
    if (planId) onChangePlan(plan.map(p => p.id === planId ? { ...p, date: iso, franja } : p));
    else onChangePlan([...plan, { id: uid(), temaId, date: iso, franja }]);
  };
  const removeFromPlan = (planId) => onChangePlan(plan.filter(p => p.id !== planId));

  return (
    <div className="page page-wide">
      <div className="row between" style={{ marginBottom: 18, alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 12.5, color: "var(--tx-3)", fontWeight: 500, marginBottom: 8 }}>
            <span onClick={onBack} style={{ cursor: "pointer", color: "var(--org)", fontWeight: 600 }}>← {subject.name}</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--ink)", margin: 0 }}>Planificar la semana</h1>
        </div>
        <div className="seg" style={{ padding: 3 }}>
          <button onClick={() => setWeekStart(d => { const x = new Date(d); x.setDate(x.getDate() - 7); return x; })} style={{ padding: "7px 10px" }}><Icon name="chevL" size={15} /></button>
          <button className="on" style={{ padding: "7px 14px" }}>{weekDays[0].getDate()} — {weekDays[6].getDate()}</button>
          <button onClick={() => setWeekStart(d => { const x = new Date(d); x.setDate(x.getDate() + 7); return x; })} style={{ padding: "7px 10px" }}><Icon name="chevR" size={15} /></button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid" style={{ gridTemplateColumns: "220px 1fr", gap: 18, alignItems: "start" }}>
          <Card>
            <CardTitle icon="target">Temas sin ubicar</CardTitle>
            {unlocated.length === 0 && <div className="small" style={{ color: "var(--tx-3)" }}>Todos los temas están ubicados esta semana.</div>}
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {unlocated.map(t => <PlanChip key={t.id} tema={t} />)}
            </div>
          </Card>

          <Card style={{ overflowX: "auto" }}>
            <div className="grid" style={{ gridTemplateColumns: "70px repeat(7,1fr)", gap: 8, minWidth: 720 }}>
              <div></div>
              {DIAS_PLAN.map((d, i) => <div key={d} className="mono" style={{ textAlign: "center", fontSize: 10.5, color: "var(--tx-3)" }}>{d} <span style={{ color: "var(--ink)", fontWeight: 700 }}>{weekDays[i].getDate()}</span></div>)}
              {FRANJAS.map(([fk, flabel]) => (
                <React.Fragment key={fk}>
                  <div className="mono" style={{ fontSize: 10, color: "var(--tx-3)", display: "flex", alignItems: "center" }}>{flabel.toUpperCase()}</div>
                  {weekIsos.map(iso => {
                    const items = placedThisWeek.filter(p => p.date === iso && p.franja === fk);
                    return (
                      <PlanCell key={iso + fk} id={`cell|${iso}|${fk}`}>
                        {items.map(p => {
                          const tema = temas.find(t => t.id === p.temaId);
                          if (!tema) return null;
                          return (
                            <div key={p.id} className="row" style={{ gap: 4 }}>
                              <div style={{ flex: 1, minWidth: 0 }}><PlanChip tema={tema} planId={p.id} /></div>
                              <span onClick={() => removeFromPlan(p.id)} style={{ cursor: "pointer", color: "var(--tx-3)", flex: "0 0 auto" }}><Icon name="x" size={12} /></span>
                            </div>
                          );
                        })}
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

const SubjectView = ({ subjectId, onBack, autoOpenPlanner, onPlannerConsumed }) => {
  const [data, set] = useStore();
  const s = data.subjects.find(x => x.id === subjectId);
  const [editModal, setEditModal] = React.useState(false);
  const [folder, setFolder] = React.useState("material");
  const [openTemaId, setOpenTemaId] = React.useState(null);
  const [plannerOpen, setPlannerOpen] = React.useState(false);
  React.useEffect(() => {
    if (autoOpenPlanner) { setPlannerOpen(true); onPlannerConsumed && onPlannerConsumed(); }
  }, [autoOpenPlanner]);
  if (!s) return null;

  const lists = s.lists || {};
  const temas = lists.temas || [];
  const tareas = lists.tareas || [];
  const notas = lists.notas || [];
  const fechas = lists.fechas || [];
  const tps = lists.tps || [];
  const files = s.files || [];
  const idx = data.subjects.indexOf(s);
  const num = String(idx + 1).padStart(2, "0");

  const setList = (k, v) => set(st => { const sub = st.subjects.find(x => x.id === subjectId); sub.lists = { ...(sub.lists || {}), [k]: v }; });
  const setFiles = (v) => set(st => { st.subjects.find(x => x.id === subjectId).files = v; });
  const upTema = (i, patch) => setList("temas", temas.map((x, j) => j === i ? { ...x, ...patch } : x));
  const setStudyPlan = (v) => set(st => { st.subjects.find(x => x.id === subjectId).studyPlan = v; });

  const link = s.link && (s.link.startsWith("http") ? s.link : "https://" + s.link);
  const folderFiles = files.filter(f => (f.folder || "material") === folder);
  const onFolderChange = (v) => setFiles([
    ...files.filter(f => (f.folder || "material") !== folder),
    ...v.map(f => ({ ...f, folder: f.folder || folder })),
  ]);

  if (plannerOpen) return <StudyPlanner subject={s} onBack={() => setPlannerOpen(false)} onChangePlan={setStudyPlan} />;

  const openTema = openTemaId && temas.find(t => t.id === openTemaId);
  if (openTema) {
    return (
      <TemaDetail
        subject={s}
        tema={openTema}
        onBack={() => setOpenTemaId(null)}
        onUpdate={patch => setList("temas", temas.map(t => t.id === openTemaId ? { ...t, ...patch } : t))}
      />
    );
  }

  return (
    <div className="page page-cozy">
      {/* ── header ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 12.5, color: "var(--tx-3)", fontWeight: 500, marginBottom: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span onClick={onBack} style={{ cursor: "pointer", color: "var(--org)", fontWeight: 600 }}>← Mis materias</span>
            <span>·</span>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--org)" }}>{num}</span>
            <span>cursando</span>
            {s.next && <><span>·</span><span>{s.next}</span></>}
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-1px", color: "var(--ink)", margin: 0, lineHeight: 1 }}>{s.name}</h1>
        </div>
        <div style={{ display: "flex", gap: 9, flex: "0 0 auto" }}>
          {link && <a href={link} target="_blank" rel="noreferrer" className="btnB-aula"><Icon name="link" size={15} /> Aula virtual</a>}
          <button className="btn-soft" onClick={() => setEditModal(true)}><Icon name="edit" size={14} /> Editar</button>
        </div>
      </div>

      {/* ── fila 1: qué hacer + anotaciones ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <Card>
          <CardTitle icon="check">Qué tengo que hacer</CardTitle>
          {tareas.length === 0 && <div style={{ fontSize: 13, color: "var(--tx-3)" }}>Nada pendiente todavía.</div>}
          {tareas.map((it, i) => (
            <div key={it.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid #eee4d4" }}>
              <span onClick={() => setList("tareas", tareas.map((x, j) => j === i ? { ...x, done: !x.done } : x))} style={{ width: 18, height: 18, borderRadius: 6, border: "2px solid " + (it.done ? "#639922" : "#c3b7a3"), background: it.done ? "#639922" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{it.done && <Icon name="check" size={11} color="#fff" />}</span>
              <span style={{ flex: 1, fontSize: 14, textDecoration: it.done ? "line-through" : "none", color: it.done ? "var(--tx-3)" : "var(--tx-1)" }}>{it.t}</span>
              <span onClick={() => setList("tareas", tareas.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: "var(--tx-3)" }}><Icon name="x" size={13} /></span>
            </div>
          ))}
          <AddInput placeholder="Agregar tarea…" onAdd={t => setList("tareas", [...tareas, { id: uid(), t, done: false }])} />
        </Card>

        <Card>
          <CardTitle icon="pen">Anotaciones</CardTitle>
          {notas.length === 0 && <div style={{ fontSize: 13, color: "var(--tx-3)" }}>Sin anotaciones.</div>}
          {notas.map((it, i) => (
            <div key={it.id || i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", fontSize: 13.5, color: "var(--soft)", lineHeight: 1.5 }}>
              <span style={{ color: "var(--org)", fontWeight: 700 }}>·</span>
              <span style={{ flex: 1 }}>{it.t}</span>
              <span onClick={() => setList("notas", notas.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: "var(--tx-3)" }}><Icon name="x" size={13} /></span>
            </div>
          ))}
          <AddInput placeholder="Agregar anotación…" onAdd={t => setList("notas", [...notas, { id: uid(), t }])} />
        </Card>
      </div>

      {/* ── fila 2: temario ── */}
      <Card style={{ marginBottom: 14 }}>
        <CardTitle icon="target" right={<button className="btn-soft" onClick={() => setPlannerOpen(true)}><Icon name="calendar" size={14} /> Planificar la semana</button>}>Temario del parcial</CardTitle>
        <div style={{ fontSize: 11.5, color: "var(--tx-3)", marginBottom: 4 }}>Marcá <span style={{ color: "var(--org-deep)" }}>resumido / estudiado</span> o el <span style={{ color: "#3B6D11" }}>↻ repaso</span> de cada tema. Entrá a un tema para ver su detalle.</div>
        {temas.length === 0 && <div style={{ fontSize: 13, color: "var(--tx-3)", padding: "6px 0" }}>Cargá los temas del parcial acá abajo.</div>}
        {temas.map((it, i) => (
          <div key={it.id || i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderBottom: "1px solid #eee4d4" }}>
            <span onClick={() => setPlannerOpen(true)} title="Planificar" style={{ cursor: "grab", color: "var(--tx-3)", display: "flex", flex: "0 0 auto" }}><Icon name="dots" size={13} /></span>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: stateColor(it), flex: "0 0 auto" }} />
            <span onClick={() => setOpenTemaId(it.id)} style={{ flex: 1, fontSize: 14.5, fontWeight: 500, color: "var(--ink)", cursor: "pointer" }}>{it.t}</span>
            <span className="ms" style={it.resumido ? { background: "#F7E4D3", color: "var(--org-deep)", borderColor: "#F7E4D3" } : undefined} onClick={() => upTema(i, { resumido: !it.resumido })}>resumido</span>
            <span className="ms" style={it.estudiado ? { background: "var(--ink)", color: "#F4EDE0", borderColor: "var(--ink)" } : undefined} onClick={() => upTema(i, { estudiado: !it.estudiado })}>estudiado</span>
            <span className="rep" style={(it.repasos > 0) ? { background: "#E4EEDB", color: "#3B6D11" } : undefined}>
              <b onClick={() => upTema(i, { repasos: Math.max(0, (it.repasos || 0) - 1) })}>−</b>
              <Icon name="refresh" size={12} /> {it.repasos || 0}
              <b onClick={() => upTema(i, { repasos: (it.repasos || 0) + 1, estudiado: true })}>+</b>
            </span>
            <span onClick={() => setList("temas", temas.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: "var(--tx-3)" }}><Icon name="x" size={14} /></span>
          </div>
        ))}
        <AddInput placeholder="Agregar tema…" onAdd={t => setList("temas", [...temas, { id: uid(), t, resumido: false, estudiado: false, repasos: 0 }])} />
      </Card>

      {/* ── fila 3: parciales/tps + archivos ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: 14 }}>
        <Card>
          <CardTitle icon="calendar">Parciales y TPs</CardTitle>
          {(fechas.length + tps.length) === 0 && <div style={{ fontSize: 13, color: "var(--tx-3)" }}>Sin fechas cargadas.</div>}
          {fechas.map((it, i) => (
            <div key={"f" + i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 13.5, borderBottom: "1px solid #eee4d4" }}><span>{it.t}</span><span onClick={() => setList("fechas", fechas.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: "var(--tx-3)" }}><Icon name="x" size={12} /></span></div>
          ))}
          {tps.map((it, i) => (
            <div key={"t" + i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 13.5, color: "var(--soft)", borderBottom: "1px solid #eee4d4" }}><span>TP · {it.t}</span><span onClick={() => setList("tps", tps.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: "var(--tx-3)" }}><Icon name="x" size={12} /></span></div>
          ))}
          <AddInput placeholder="Agregar parcial o fecha…" onAdd={t => setList("fechas", [...fechas, { id: uid(), t }])} />
        </Card>

        <Card>
          <CardTitle icon="paperclip">Archivos</CardTitle>
          <div style={{ display: "flex", gap: 9, marginBottom: 12 }}>
            {FOLDERS.map(fd => {
              const count = files.filter(f => (f.folder || "material") === fd.k).length;
              const on = folder === fd.k;
              return (
                <div key={fd.k} onClick={() => setFolder(fd.k)} style={{ flex: 1, background: on ? "var(--field)" : "var(--card)", border: "1px solid " + (on ? "var(--org)" : "var(--line)"), borderRadius: 11, padding: "10px 8px", textAlign: "center", cursor: "pointer", boxShadow: on ? "none" : "0 1.5px 0 #e0d5c3" }}>
                  <span style={{ color: "var(--ink)", display: "flex", justifyContent: "center" }}><Icon name={fd.icon} size={18} /></span>
                  <div style={{ fontWeight: 600, fontSize: 12.5, color: "var(--ink)", marginTop: 5 }}>{fd.label}</div>
                  <div style={{ fontSize: 11, color: "var(--tx-3)" }}>{count}</div>
                </div>
              );
            })}
          </div>
          <SubjectFiles files={folderFiles} onChange={onFolderChange} accent={s.color} />
        </Card>
      </div>

      {editModal && <SubjectModal subject={s} onClose={() => setEditModal(false)} />}
    </div>
  );
};

export { SubjectView };
