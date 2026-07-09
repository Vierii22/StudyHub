import React from 'react';

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

const SubjectView = ({ subjectId, onBack }) => {
  const [data, set] = useStore();
  const s = data.subjects.find(x => x.id === subjectId);
  const [editModal, setEditModal] = React.useState(false);
  const [folder, setFolder] = React.useState("material");
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

  const link = s.link && (s.link.startsWith("http") ? s.link : "https://" + s.link);
  const folderFiles = files.filter(f => (f.folder || "material") === folder);
  const onFolderChange = (v) => setFiles([
    ...files.filter(f => (f.folder || "material") !== folder),
    ...v.map(f => ({ ...f, folder: f.folder || folder })),
  ]);

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
        <CardTitle icon="target" right={<button className="btn-soft" onClick={() => toast("Planificador de la semana — próximamente")}><Icon name="calendar" size={14} /> Planificar la semana</button>}>Temario del parcial</CardTitle>
        <div style={{ fontSize: 11.5, color: "var(--tx-3)", marginBottom: 4 }}>Marcá <span style={{ color: "var(--org-deep)" }}>resumido / estudiado</span> o el <span style={{ color: "#3B6D11" }}>↻ repaso</span> de cada tema.</div>
        {temas.length === 0 && <div style={{ fontSize: 13, color: "var(--tx-3)", padding: "6px 0" }}>Cargá los temas del parcial acá abajo.</div>}
        {temas.map((it, i) => (
          <div key={it.id || i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderBottom: "1px solid #eee4d4" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: stateColor(it), flex: "0 0 auto" }} />
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, color: "var(--ink)" }}>{it.t}</span>
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
