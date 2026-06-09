import React from 'react';

import ReactDOM from 'react-dom';
import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, COLORS } from './store.jsx';
import { Btn, Chip, MonoLabel, PageHead, Empty, Modal, Toggle, ProgressRing, SubjectDot } from './ui.jsx';
import { SmartList } from './widgets.jsx';
import { CanvaBoard, defaultBoardItem } from './board.jsx';
import { SubjectModal, SubjectFiles } from './facultad.jsx';

const SPAN_OPTS = [["¼", 3], ["⅓", 4], ["½", 6], ["⅔", 8], ["1", 12]];

/* ============================================================
   VISTA INTERNA DE MATERIA — pizarrón Canva ⇄ widgets fijos
   ============================================================ */

/* lista genérica editable (widgets fijos) */
const ListWidget = ({ title, items, onChange, placeholder, accent }) => {
  const [draft, setDraft] = React.useState("");
  const arr = items || [];
  return (
    <div className="card card-flush" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="row between" style={{ padding: "20px 22px 12px" }}><div className="h3">{title}</div>{accent && <span style={{ color: "var(--violet-hi)" }}><Icon name={accent} size={17} /></span>}</div>
      <div style={{ flex: 1, padding: "0 22px", overflow: "auto" }}>
        {arr.length === 0 && <div className="small" style={{ color: "var(--tx-3)", padding: "14px 0" }}>Sin ítems. Agregá uno abajo.</div>}
        {arr.map((it, i) => (
          <div key={i} className="check-row">
            <div className={`cbox${it.done ? " on" : ""}`} onClick={() => onChange(arr.map((x, j) => j === i ? { ...x, done: !x.done } : x))}>{it.done && <Icon name="check" size={13} color="#fff" />}</div>
            <span style={{ flex: 1, fontSize: 14, textDecoration: it.done ? "line-through" : "none", opacity: it.done ? .55 : 1 }}>{it.t}</span>
            <span style={{ cursor: "pointer", color: "var(--tx-3)" }} onClick={() => onChange(arr.filter((_, j) => j !== i))}><Icon name="x" size={14} /></span>
          </div>
        ))}
      </div>
      <form className="row" style={{ gap: 9, padding: "14px 22px" }} onSubmit={e => { e.preventDefault(); if (draft.trim()) { onChange([...arr, { t: draft.trim(), done: false }]); setDraft(""); } }}>
        <input className="input" value={draft} onChange={e => setDraft(e.target.value)} placeholder={placeholder} style={{ padding: "10px 13px", fontSize: 13.5 }} />
        <Btn variant="primary" icon="plus" style={{ flex: "0 0 auto" }}></Btn>
      </form>
    </div>
  );
};

/* BoardDrawer movido a board.jsx como BoardAddPanel (portaleado — funciona en fullscreen) */

const QUICK_SECTIONS = [
  { k: "temas", label: "Temas del parcial" },
  { k: "tps", label: "Trabajos Prácticos" },
  { k: "notas", label: "Anotaciones" },
  { k: "fechas", label: "Fechas importantes" },
  { k: "links", label: "Links útiles" },
];

/* ---- panel de widgets editable (igual que el dashboard) ---- */
const SUBJ_WIDGETS = {
  temas:  { label: "Temas del parcial",   icon: "target",   accent: "#8b6dff", ph: "Agregar tema…" },
  tareas: { label: "Tareas",              icon: "check",    accent: "#4ec5e8", ph: "Agregar tarea…" },
  tps:    { label: "Trabajos Prácticos",  icon: "layers",   accent: "#e8b04e", ph: "Agregar TP…" },
  notas:  { label: "Anotaciones",         icon: "pen",      accent: "#e8639b", ph: "Agregar anotación…" },
  fechas: { label: "Fechas importantes",  icon: "calendar", accent: "#3ecf9a", ph: "Agregar fecha…" },
  links:  { label: "Links útiles",        icon: "link",     accent: "#6d8bff", ph: "Agregar link…" },
};
const SUBJ_META = { ...SUBJ_WIDGETS, resumen: { label: "Resumen", icon: "layers" } };
const SUBJ_DEFAULT = ["temas", "tareas", "tps", "notas", "fechas", "links", "resumen"];
const SUBJ_SPANS = { temas: 6, tareas: 6, tps: 7, notas: 5, fechas: 5, links: 4, resumen: 3 };

const ResumenCard = ({ pct, color, doneCount, total }) => (
  <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: 13 }}>
    <MonoLabel>Resumen</MonoLabel>
    <div className="stat" style={{ fontSize: 40 }}>{pct}%</div>
    <div style={{ width: "100%" }}><div className="bar"><i style={{ width: pct + "%", background: color }}></i></div></div>
    <div className="small">{doneCount} / {total} hecho</div>
  </div>
);

const SubjectPanelDrawer = ({ active, onAdd, onRemove, onClose, onReset }) => {
  const pos = React.useRef({ x: window.innerWidth - 340, y: 130 });
  const [, force] = React.useReducer(x => x + 1, 0);
  const dragStart = (e) => {
    const sx = e.clientX, sy = e.clientY, ox = pos.current.x, oy = pos.current.y;
    const mv = ev => { pos.current = { x: ox + ev.clientX - sx, y: oy + ev.clientY - sy }; force(); };
    const up = () => { document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up);
  };
  const available = Object.keys(SUBJ_META).filter(k => !active.includes(k));
  return (
    <div className="drawer" style={{ left: pos.current.x, top: pos.current.y }}>
      <div className="drawer-head" onMouseDown={dragStart}>
        <Icon name="dots" size={15} color="var(--tx-3)" />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Organizar widgets</span>
        <span style={{ marginLeft: "auto", cursor: "pointer", color: "var(--tx-3)" }} onClick={onClose}><Icon name="x" size={16} /></span>
      </div>
      <div className="drawer-body">
        <div className="mono" style={{ marginBottom: 10 }}>Disponibles</div>
        <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
          {available.length === 0 && <div className="small" style={{ color: "var(--tx-3)" }}>Todos los widgets están activos.</div>}
          {available.map(k => <button key={k} className="addbtn" onClick={() => onAdd(k)}><Icon name="plus" size={15} />{SUBJ_META[k].label}</button>)}
        </div>
        <div className="mono" style={{ marginBottom: 10 }}>Activos · {active.length}</div>
        <div style={{ display: "grid", gap: 8 }}>
          {active.map(k => (
            <div key={k} className="row between" style={{ padding: "10px 13px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
              <span className="row" style={{ gap: 9, fontSize: 13.5 }}><Icon name="dots" size={14} color="var(--tx-3)" />{SUBJ_META[k] ? SUBJ_META[k].label : k}</span>
              <span style={{ cursor: "pointer", color: "var(--tx-3)" }} onClick={() => onRemove(k)}><Icon name="x" size={15} /></span>
            </div>
          ))}
        </div>
        <button className="addbtn" style={{ marginTop: 16, justifyContent: "center", color: "#e8639b" }} onClick={onReset}><Icon name="refresh" size={15} color="#e8639b" /> Restaurar por defecto</button>
      </div>
    </div>
  );
};

const SubjectView = ({ subjectId, onBack }) => {
  const [data, set] = useStore();
  const s = data.subjects.find(x => x.id === subjectId);
  const [editName, setEditName] = React.useState(false);
  const [customize, setCustomize] = React.useState(false);
  const [panelEdit, setPanelEdit] = React.useState(false);
  const [editModal, setEditModal] = React.useState(false);
  const [showFiles, setShowFiles] = React.useState(false);
  if (!s) return null;

  const lists = s.lists || {};
  const setList = (k, v) => set(st => { const sub = st.subjects.find(x => x.id === subjectId); sub.lists = { ...(sub.lists || {}), [k]: v }; });
  const setFiles = (v) => set(st => st.subjects.find(x => x.id === subjectId).files = v);
  const profLine = (s.profs && s.profs.length) ? s.profs.join(" · ") : (s.prof || "Sin profesor");
  const board = s.board || [];
  const setBoard = (items) => set(st => st.subjects.find(x => x.id === subjectId).board = items);
  const toggle = (k) => set(st => { const sub = st.subjects.find(x => x.id === subjectId); sub[k] = !sub[k]; });

  // panel de widgets editable (mismo modelo que el dashboard)
  const panel = s.panel || SUBJ_DEFAULT;
  const panelSpans = s.panelSpans || {};
  const dragK = React.useRef(null);
  const spanFor = (k) => `span ${(panelSpans && panelSpans[k]) || SUBJ_SPANS[k] || 6}`;
  const reorder = (k) => { if (dragK.current && dragK.current !== k) set(st => { const sub = st.subjects.find(x => x.id === subjectId); const a = sub.panel || (sub.panel = SUBJ_DEFAULT.slice()); const from = a.indexOf(dragK.current), to = a.indexOf(k); if (from < 0 || to < 0) return; a.splice(to, 0, a.splice(from, 1)[0]); }); };
  const setPanelSpan = (k, v) => set(st => { const sub = st.subjects.find(x => x.id === subjectId); sub.panelSpans = { ...(sub.panelSpans || {}), [k]: v }; });
  const removePanel = (k) => set(st => { const sub = st.subjects.find(x => x.id === subjectId); sub.panel = (sub.panel || SUBJ_DEFAULT).filter(x => x !== k); });
  const addPanel = (k) => set(st => { const sub = st.subjects.find(x => x.id === subjectId); sub.panel = [...(sub.panel || SUBJ_DEFAULT), k]; });
  const resetPanel = () => set(st => { const sub = st.subjects.find(x => x.id === subjectId); sub.panel = SUBJ_DEFAULT.slice(); sub.panelSpans = {}; });

  // resumen progreso
  const allItems = Object.values(lists).flat();
  const doneCount = allItems.filter(i => i.status === "listo" || i.done).length;
  const pct = allItems.length ? Math.round(doneCount / allItems.length * 100) : s.pct;

  const addBoardItem = (kind) => {
    const item = defaultBoardItem(kind, board.length);
    /* frames van al inicio del array → se renderizan detrás de todo */
    if (kind === "frame") setBoard([item, ...board]);
    else setBoard([...board, item]);
    if (!customize) setCustomize(true);
    toast("Agregado al pizarrón");
  };
  const addSectionToBoard = (sec) => {
    const item = { ...defaultBoardItem("list", board.length), title: sec.label };
    setBoard([...board, item]);
    toast(`"${sec.label}" agregada`);
  };

  const renderPanelWidget = (k) => {
    if (k === "resumen") return <ResumenCard pct={pct} color={s.color} doneCount={doneCount} total={allItems.length} />;
    const w = SUBJ_WIDGETS[k];
    if (!w) return null;
    return <SmartList title={w.label} icon={w.icon} accent={w.accent} crumb={s.name} viewKey={`v_${s.id}_${k}`} items={lists[k]} onChange={v => setList(k, v)} placeholder={w.ph} />;
  };

  return (
    <div className="page page-cozy">
      {/* header materia */}
      <div className="page-head" style={{ marginBottom: 24 }}>
        <div className="row" style={{ gap: 16 }}>
          {s.photo
            ? <div style={{ width: 54, height: 54, borderRadius: 14, flex: "0 0 auto", background: `url(${s.photo}) center/cover`, boxShadow: `0 6px 18px -8px ${s.color}` }}></div>
            : <SubjectDot s={s} size={54} />}
          <div>
            {editName
              ? <input className="input" defaultValue={s.name} autoFocus onBlur={e => { set(st => st.subjects.find(x => x.id === subjectId).name = e.target.value); setEditName(false); }} style={{ fontSize: 22, fontWeight: 700 }} />
              : <h1 className="h1" onClick={() => setEditName(true)} style={{ cursor: "text" }}>{s.name}</h1>}
            <div className="mono" style={{ marginTop: 8 }}>
              {profLine} · {s.next || "Sin eventos"}{s.link && <> · <a className="link" href={s.link.startsWith("http") ? s.link : "https://" + s.link} target="_blank" style={{ fontSize: 11.5 }}>Aula virtual ↗</a></>}
            </div>
          </div>
        </div>
        <div className="wrap-gap">
          <Btn variant="secondary" icon="edit" onClick={() => setEditModal(true)}>Editar</Btn>
          {s.boardMode
            ? <Btn variant={customize ? "primary" : "secondary"} icon={customize ? "check" : "sparkles"} onClick={() => { setCustomize(c => !c); if (customize) toast("Pizarrón guardado"); }}>{customize ? "Listo" : "Personalizar"}</Btn>
            : <Btn variant={panelEdit ? "primary" : "secondary"} icon={panelEdit ? "check" : "layout"} onClick={() => { const wasEditing = panelEdit; setPanelEdit(e => !e); if (wasEditing) toast("Widgets guardados"); }}>{panelEdit ? "Listo" : "Organizar"}</Btn>}
          <Btn variant="ghost" icon="chevL" onClick={onBack}>Volver</Btn>
        </div>
      </div>

      {/* MATERIAL DE LA MATERIA */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="row between" style={{ cursor: "pointer" }} onClick={() => setShowFiles(v => !v)}>
          <div className="row" style={{ gap: 12 }}>
            <span style={{ width: 38, height: 38, borderRadius: 11, background: s.color + "22", color: s.color, display: "grid", placeItems: "center" }}><Icon name="paperclip" size={18} /></span>
            <div><div className="h3">Material de la materia</div><div className="small" style={{ fontSize: 12 }}>{(s.files || []).length} archivo{(s.files || []).length !== 1 ? "s" : ""} · PDFs, presentaciones, resúmenes, TPs</div></div>
          </div>
          <div className="icon-btn" style={{ width: 34, height: 34 }}><Icon name={showFiles ? "chevL" : "chevR"} size={15} style={{ transform: showFiles ? "rotate(90deg)" : "none" }} /></div>
        </div>
        {showFiles && <div style={{ marginTop: 18 }}><SubjectFiles files={s.files || []} onChange={setFiles} accent={s.color} /></div>}
      </div>

      {/* barra de controles: modo pizarrón + puntos */}
      <div className="card" style={{ padding: "14px 20px", marginBottom: 22, display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 11 }}>
          <Toggle on={s.boardMode} onChange={() => { toggle("boardMode"); toast(s.boardMode ? "Modo widgets fijos" : "Modo pizarrón activado"); }} />
          <div><div style={{ fontSize: 14, fontWeight: 600 }}>Modo pizarrón</div><div className="small" style={{ fontSize: 12 }}>Arrastrá y redimensioná libremente, estilo Canva</div></div>
        </div>
        {s.boardMode && <>
          <div style={{ width: 1, height: 32, background: "var(--line)" }}></div>
          <div className="row" style={{ gap: 11 }}>
            <Toggle on={s.showDots} onChange={() => toggle("showDots")} />
            <div><div style={{ fontSize: 14, fontWeight: 600 }}>Grilla de puntos</div><div className="small" style={{ fontSize: 12 }}>Mostrar el fondo punteado</div></div>
          </div>
        </>}
        <div style={{ flex: 1 }}></div>
        <div className="row" style={{ gap: 18 }}>
          <div style={{ textAlign: "right" }}><div className="mono" style={{ fontSize: 10 }}>Progreso</div><div className="h3" style={{ color: "var(--violet-hi)" }}>{pct}%</div></div>
          <ProgressRing value={pct} size={52} stroke={5} />
        </div>
      </div>

      {/* CONTENIDO */}
      {s.boardMode ? (
        <CanvaBoard
          items={board}
          onChange={setBoard}
          editing={customize}
          showDots={s.showDots}
          boardTitle={s.name}
          onAddItem={addBoardItem}
          quickSections={QUICK_SECTIONS}
          onAddSection={addSectionToBoard}
        />
      ) : (
        <>
          {panelEdit && <div className="mono" style={{ marginBottom: 12, color: "var(--violet-hi)", display: "flex", alignItems: "center", gap: 7 }}><Icon name="move" size={13} /> Arrastrá los widgets para reordenar · cambiá el tamaño de cada uno · agregá o quitá desde el panel</div>}
          <div className="grid" style={{ gridTemplateColumns: "repeat(12,1fr)", alignItems: "stretch" }}>
            {panel.map(k => (
              <div key={k}
                draggable={panelEdit}
                onDragStart={() => { dragK.current = k; }}
                onDragOver={e => { if (panelEdit) { e.preventDefault(); reorder(k); } }}
                onDragEnd={() => { dragK.current = null; }}
                style={{ gridColumn: spanFor(k), position: "relative", minHeight: k === "resumen" ? undefined : 320, outline: panelEdit ? "1.5px dashed var(--violet-line)" : "none", outlineOffset: 4, borderRadius: "var(--r-lg)", cursor: panelEdit ? "grab" : "default" }}>
                {renderPanelWidget(k)}
                {panelEdit && <>
                  <div onClick={() => removePanel(k)} style={{ position: "absolute", top: -10, right: -10, width: 26, height: 26, borderRadius: "50%", background: "#e8639b", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", zIndex: 6 }}><Icon name="x" size={14} /></div>
                  <div className="dash-resize" onMouseDown={e => e.stopPropagation()}>
                    {SPAN_OPTS.map(([lbl, v]) => { const cur = (panelSpans && panelSpans[k]) || SUBJ_SPANS[k] || 6; return <button key={v} className={cur === v ? "on" : ""} onClick={() => setPanelSpan(k, v)} title={`Ancho ${lbl}`}>{lbl}</button>; })}
                  </div>
                </>}
              </div>
            ))}
          </div>
          {panelEdit && <SubjectPanelDrawer active={panel} onAdd={addPanel} onRemove={removePanel} onClose={() => setPanelEdit(false)} onReset={resetPanel} />}
        </>
      )}

      {/* BoardDrawer movido a board.jsx como BoardAddPanel (portaleado, funciona en fullscreen) */}
      {editModal && <SubjectModal subject={s} onClose={() => setEditModal(false)} />}
    </div>
  );
};

export { SubjectView };