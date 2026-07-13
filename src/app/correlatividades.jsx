import React from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

import { Icon } from './icons.jsx';
import { useStore, uid, toast, deriveCourseStatus, deriveEstado } from './store.jsx';
import { Btn, Modal, Field, Seg, PageHead } from './ui.jsx';

/* estado de una materia de Facultad → estado base del plan */
const estadoToBase = (e) => (e === "aprobada" || e === "promocionada") ? "aprobada" : e === "regular" ? "regularizada" : e === "cursando" ? "cursando" : "no_cursada";

/* ============================================================
   MAPA DE CORRELATIVIDADES — BETA (Fase 10, DESIGN.md "Pendientes")
   Un solo lienzo zoomeable (pan/zoom con react-zoom-pan-pinch).
   Lo único que debe andar perfecto: "¿puedo cursarla?" con motivo
   (deriveCourseStatus, en store.jsx).
   ============================================================ */

const BASE_OPTS = [
  { id: "no_cursada",   label: "No cursada" },
  { id: "cursando",     label: "Cursando" },
  { id: "regularizada", label: "Regularizada" },
  { id: "aprobada",     label: "Aprobada" },
];
const SEM_OPTS = [{ id: "1", label: "1º cuat." }, { id: "2", label: "2º cuat." }, { id: "anual", label: "Anual" }];

const STATUS_META = {
  aprobada:     { label: "Aprobada",      color: "#2f5e10", bg: "var(--green-bg)", border: "var(--green)" },
  regularizada: { label: "Regularizada",  color: "var(--org-deep)", bg: "#F7E4D3", border: "var(--org)" },
  cursando:     { label: "Cursando",      color: "var(--org-deep)", bg: "#F7E4D3", border: "var(--org)" },
  disponible:   { label: "Podés cursarla",color: "var(--ink)",  bg: "var(--card)", border: "var(--line-2)" },
  bloqueada:    { label: "Bloqueada",     color: "var(--tx-3)", bg: "var(--off)", border: "var(--line)" },
};

const COL_W = 200, ROW_H = 92, YEAR_PAD = 40;

/* posiciona cada materia: x por año, y apilado dentro del año */
function layout(subjects) {
  const byYear = {};
  subjects.forEach(s => { (byYear[s.year] ||= []).push(s); });
  const pos = {};
  Object.entries(byYear).forEach(([year, list]) => {
    list.forEach((s, i) => {
      pos[s.id] = { x: (Number(year) - 1) * (COL_W + YEAR_PAD) + YEAR_PAD, y: i * ROW_H + 70 };
    });
  });
  return pos;
}

/* ---------- modal de configuración de una materia del plan ---------- */
const PlanSubjectModal = ({ subject, allSubjects, onClose, onSave, onDelete, onLink }) => {
  const [f, setF] = React.useState(subject || { name: "", year: "1", semester: "1", base: "no_cursada", correlativas: { cursar: [], final: [] } });
  const up = (k, v) => setF(x => ({ ...x, [k]: v }));
  const others = allSubjects.filter(s => s.id !== f.id);

  const addCorrel = (kind) => {
    if (!others.length) return toast("Primero cargá otra materia para poder vincularla");
    const cur = f.correlativas[kind] || [];
    up("correlativas", { ...f.correlativas, [kind]: [...cur, { id: others[0].id, req: "regular", tipo: "fuerte" }] });
  };
  const updCorrel = (kind, i, patch) => {
    const cur = [...(f.correlativas[kind] || [])];
    cur[i] = { ...cur[i], ...patch };
    up("correlativas", { ...f.correlativas, [kind]: cur });
  };
  const rmCorrel = (kind, i) => {
    up("correlativas", { ...f.correlativas, [kind]: f.correlativas[kind].filter((_, j) => j !== i) });
  };

  const CorrelList = ({ kind, label }) => (
    <Field label={label}>
      <div style={{ display: "grid", gap: 8 }}>
        {(f.correlativas[kind] || []).map((c, i) => (
          <div key={i} className="row" style={{ gap: 8 }}>
            <select className="input" style={{ flex: 1 }} value={c.id} onChange={e => updCorrel(kind, i, { id: e.target.value })}>
              {others.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <select className="input" style={{ width: 130, flex: "0 0 auto" }} value={c.req} onChange={e => updCorrel(kind, i, { req: e.target.value })}>
              <option value="regular">Regularizada</option>
              <option value="final">Final aprobado</option>
            </select>
            <select className="input" style={{ width: 100, flex: "0 0 auto" }} value={c.tipo} onChange={e => updCorrel(kind, i, { tipo: e.target.value })}>
              <option value="fuerte">Fuerte</option>
              <option value="debil">Débil</option>
            </select>
            <div className="icon-btn" onClick={() => rmCorrel(kind, i)}><Icon name="x" size={14} /></div>
          </div>
        ))}
        <button className="addbtn" onClick={() => addCorrel(kind)}><Icon name="plus" size={15} /> Agregar correlativa</button>
      </div>
    </Field>
  );

  return (
    <Modal title={subject ? "Editar materia del plan" : "Nueva materia del plan"} icon="space" onClose={onClose} wide
      footer={<><span className="link" style={{ color: subject ? "var(--org-deep)" : "var(--tx-3)" }} onClick={() => subject ? onDelete(f.id) : onClose()}>{subject ? "Eliminar" : "Cancelar"}</span><Btn variant="primary" onClick={() => { if (!f.name.trim()) return toast("Poné un nombre"); onSave({ ...f, id: f.id || uid() }); }}>Guardar</Btn></>}>
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="Nombre *"><input className="input" value={f.name} onChange={e => up("name", e.target.value)} autoFocus /></Field>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Año"><Seg opts={[1, 2, 3, 4, 5].map(y => ({ id: String(y), label: String(y) }))} value={f.year} onChange={v => up("year", v)} /></Field>
          <Field label="Cuatrimestre"><Seg opts={SEM_OPTS} value={f.semester} onChange={v => up("semester", v)} /></Field>
        </div>
        <Field label="Estado"><Seg opts={BASE_OPTS} value={f.base} onChange={v => up("base", v)} /></Field>
        {subject && onLink && (
          <button className="btn-soft" style={{ width: "100%", justifyContent: "center" }} onClick={() => onLink(subject.id)}>
            <Icon name="space" size={15} /> Elegir correlativas tocando el mapa
          </button>
        )}
        <CorrelList kind="cursar" label="Correlativas para CURSAR" />
        <CorrelList kind="final" label="Correlativas para RENDIR EL FINAL" />
      </div>
    </Modal>
  );
};

/* ---------- nodo de materia ---------- */
/* linkState: null | "source" | "fuerte" | "debil" — resalta durante el modo vincular */
const SubjectNode = ({ s, computed, pos, onClick, linkState, linkingMode }) => {
  const meta = STATUS_META[computed.status];
  const ring = linkState === "source" ? "0 0 0 3px var(--ink)"
    : linkState === "fuerte" ? "0 0 0 3px var(--org)"
    : linkState === "debil" ? "0 0 0 3px var(--org-2)"
    : "none";
  const dim = linkingMode && !linkState;
  return (
    <div
      onClick={onClick}
      title={linkingMode ? "" : (computed.reason || "")}
      className="plan-node"
      style={{
        position: "absolute", left: pos.x, top: pos.y, width: COL_W - 24,
        background: meta.bg, border: `1.5px solid ${meta.border}`, borderRadius: 12,
        padding: "10px 12px", cursor: "pointer",
        boxShadow: ring === "none" ? "0 2px 0 rgba(58,51,43,.08)" : `${ring}, 0 2px 0 rgba(58,51,43,.08)`,
        opacity: dim ? 0.5 : 1, transition: "box-shadow .14s ease, opacity .14s ease",
      }}
    >
      <div className="row between" style={{ marginBottom: 4 }}>
        <span className="mono" style={{ fontSize: 9, color: "var(--tx-3)" }}>{s.semester === "anual" ? "ANUAL" : `${s.semester}º CUAT.`}</span>
        {linkState === "fuerte" && <span className="mono" style={{ fontSize: 9, fontWeight: 700, color: "var(--org)" }}>FUERTE</span>}
        {linkState === "debil" && <span className="mono" style={{ fontSize: 9, fontWeight: 700, color: "var(--org-deep)" }}>DÉBIL</span>}
        {linkState === "source" && <span className="mono" style={{ fontSize: 9, fontWeight: 700, color: "var(--ink)" }}>ESTA</span>}
        {!linkingMode && computed.status === "bloqueada" && <Icon name="x" size={11} color="var(--tx-3)" />}
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.25, color: "var(--tx-1)" }}>{s.name}</div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: meta.color, marginTop: 5 }}>{meta.label}</div>
    </div>
  );
};

/* ---------- líneas de correlatividad (SVG) ---------- */
const CorrelLines = ({ subjects, positions }) => {
  const lines = [];
  subjects.forEach(s => {
    (s.correlativas?.cursar || []).forEach(c => {
      const from = positions[c.id], to = positions[s.id];
      if (!from || !to) return;
      lines.push({
        key: `${c.id}-${s.id}`,
        x1: from.x + (COL_W - 24) / 2, y1: from.y + 40,
        x2: to.x + (COL_W - 24) / 2, y2: to.y,
        dashed: c.tipo === "debil",
      });
    });
  });
  const maxX = Math.max(600, ...Object.values(positions).map(p => p.x + COL_W));
  const maxY = Math.max(400, ...Object.values(positions).map(p => p.y + ROW_H));
  return (
    <svg width={maxX} height={maxY} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
      {lines.map(l => (
        <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke="var(--soft)" strokeWidth="1.5" strokeDasharray={l.dashed ? "5,4" : "none"} opacity="0.55" />
      ))}
    </svg>
  );
};

/* ---------- modal de carga rápida (varias materias de una) ---------- */
const BulkAddModal = ({ onClose, onAdd }) => {
  const [text, setText] = React.useState("");
  const [year, setYear] = React.useState("1");
  const submit = () => {
    const names = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (!names.length) return toast("Escribí al menos una materia");
    onAdd(names, year);
  };
  return (
    <Modal title="Cargar varias materias" icon="layers" onClose={onClose}
      footer={<><span className="link" style={{ color: "var(--tx-3)", cursor: "pointer" }} onClick={onClose}>Cancelar</span><Btn variant="primary" onClick={submit}>Agregar</Btn></>}>
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="Año de estas materias"><Seg opts={[1, 2, 3, 4, 5].map(y => ({ id: String(y), label: String(y) }))} value={year} onChange={setYear} /></Field>
        <Field label="Una materia por línea">
          <textarea className="input" rows={8} value={text} onChange={e => setText(e.target.value)}
            placeholder={"Álgebra\nAnálisis Matemático I\nIntroducción a la Programación"}
            style={{ resize: "vertical", fontFamily: "var(--font-body)", lineHeight: 1.7 }} />
        </Field>
        <div className="small" style={{ color: "var(--tx-3)" }}>Después las vinculás tocando cada una en el mapa. Podés repetir esto por cada año.</div>
      </div>
    </Modal>
  );
};

/* ---------- pantalla principal ---------- */
const Correlatividades = () => {
  const [data, set] = useStore();
  const subjects = data.plan.subjects;
  const [modal, setModal] = React.useState(null);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [linking, setLinking] = React.useState(null); /* { id, kind: 'cursar'|'final' } */
  /* ojo: el store muta data.plan.subjects in-place (misma referencia),
     por eso NO se memoiza en base a `subjects` — un useMemo con esa
     dependencia queda stale después de agregar/editar una materia. */
  const positions = layout(subjects);
  const computedAll = {};
  subjects.forEach(s => { computedAll[s.id] = deriveCourseStatus(s, subjects); });

  const years = [...new Set(subjects.map(s => Number(s.year)))].sort((a, b) => a - b);
  const maxYear = Math.max(5, ...years);

  const saveSubject = (subj) => {
    set(s => {
      const idx = s.plan.subjects.findIndex(x => x.id === subj.id);
      if (idx >= 0) s.plan.subjects[idx] = subj; else s.plan.subjects.push(subj);
    });
    toast("Guardado");
    setModal(null);
  };
  const deleteSubject = (id) => {
    set(s => { s.plan.subjects = s.plan.subjects.filter(x => x.id !== id); });
    if (linking?.id === id) setLinking(null);
    toast("Eliminada");
    setModal(null);
  };

  /* traer las materias que ya existen en Facultad (nombre, año y estado) */
  const importFromFacultad = () => {
    const src = data.subjects || [];
    if (!src.length) return toast("No tenés materias en Facultad todavía");
    let added = 0;
    set(s => {
      const existing = new Set(s.plan.subjects.map(x => (x.name || "").toLowerCase().trim()));
      src.forEach(sub => {
        const key = (sub.name || "").toLowerCase().trim();
        if (!key || existing.has(key)) return;
        existing.add(key);
        s.plan.subjects.push({ id: uid(), name: sub.name, year: String(sub.year || "1"), semester: "1", base: estadoToBase(deriveEstado(sub)), correlativas: { cursar: [], final: [] } });
        added++;
      });
    });
    toast(added ? `${added} materia${added !== 1 ? "s" : ""} traída${added !== 1 ? "s" : ""} ✓` : "Ya estaban todas cargadas");
  };

  /* agregar varias de una (del modal de carga rápida) */
  const addBulk = (names, year) => {
    set(s => {
      const existing = new Set(s.plan.subjects.map(x => (x.name || "").toLowerCase().trim()));
      names.forEach(n => {
        const key = n.toLowerCase().trim();
        if (existing.has(key)) return;
        existing.add(key);
        s.plan.subjects.push({ id: uid(), name: n, year: String(year), semester: "1", base: "no_cursada", correlativas: { cursar: [], final: [] } });
      });
    });
    setBulkOpen(false);
    toast("Materias agregadas ✓");
  };

  /* modo vincular: tocar una materia la cicla fuerte → débil → sacada */
  const cycleCorrel = (targetId) => {
    if (!linking || targetId === linking.id) return;
    set(s => {
      const srcS = s.plan.subjects.find(x => x.id === linking.id);
      if (!srcS) return;
      if (!srcS.correlativas) srcS.correlativas = { cursar: [], final: [] };
      const arr = srcS.correlativas[linking.kind] || (srcS.correlativas[linking.kind] = []);
      const idx = arr.findIndex(c => c.id === targetId);
      if (idx < 0) arr.push({ id: targetId, req: "regular", tipo: "fuerte" });
      else if (arr[idx].tipo === "fuerte") arr[idx] = { ...arr[idx], tipo: "debil" };
      else arr.splice(idx, 1);
    });
  };
  const linkStateFor = (nodeId) => {
    if (!linking) return null;
    if (nodeId === linking.id) return "source";
    const srcS = subjects.find(x => x.id === linking.id);
    const c = (srcS?.correlativas?.[linking.kind] || []).find(c => c.id === nodeId);
    return c ? c.tipo : null;
  };
  const linkingSubj = linking && subjects.find(x => x.id === linking.id);

  return (
    <div className="page page-wide" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PageHead title="Plan de correlatividades" meta="BETA · lienzo con zoom — arrastrá y hacé scroll para acercar">
        <Btn variant="secondary" icon="layers" onClick={importFromFacultad}>Traer de Facultad</Btn>
        <Btn variant="secondary" icon="plus" onClick={() => setBulkOpen(true)}>Cargar varias</Btn>
        <Btn variant="primary" icon="plus" onClick={() => setModal("new")}>Nueva materia</Btn>
      </PageHead>

      {linking && (
        <div className="plan-linkbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
            <Icon name="space" size={16} />
            <span style={{ fontSize: 13 }}>Correlativas de <b>{linkingSubj?.name}</b> para {linking.kind === "final" ? "rendir el FINAL" : "CURSAR"} — tocá las materias que van antes.</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="plan-legend"><i style={{ background: "var(--org)" }} />1 toque fuerte</span>
            <span className="plan-legend"><i style={{ background: "var(--org-2)" }} />2 débil</span>
            <span className="plan-legend"><i style={{ background: "rgba(244,237,224,.3)" }} />3 sacar</span>
            <div className="plan-kind">
              <button className={linking.kind === "cursar" ? "on" : ""} onClick={() => setLinking(l => ({ ...l, kind: "cursar" }))}>Cursar</button>
              <button className={linking.kind === "final" ? "on" : ""} onClick={() => setLinking(l => ({ ...l, kind: "final" }))}>Final</button>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setLinking(null)}>Listo</button>
          </div>
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div className="h3" style={{ marginBottom: 8 }}>Todavía no cargaste tu plan</div>
          <div className="small" style={{ marginBottom: 16, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>Traé las materias que ya tenés en Facultad, cargá varias juntas, o agregá una por una. Después vinculás las correlativas tocándolas en el mapa.</div>
          <div className="row" style={{ gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Btn variant="primary" icon="layers" onClick={importFromFacultad}>Traer de Facultad</Btn>
            <Btn variant="secondary" icon="plus" onClick={() => setBulkOpen(true)}>Cargar varias</Btn>
          </div>
        </div>
      ) : (
        <div className="card card-flush" style={{ flex: 1, overflow: "hidden", position: "relative", minHeight: 480 }}>
          <TransformWrapper minScale={0.3} maxScale={2} initialScale={0.6} limitToBounds={false}>
            <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
              <div style={{ position: "relative", padding: 24 }}>
                {Array.from({ length: maxYear }, (_, i) => i + 1).map(y => (
                  <div key={y} className="mono" style={{ position: "absolute", left: (y - 1) * (COL_W + YEAR_PAD) + YEAR_PAD, top: 20, fontSize: 11, color: "var(--org-deep)", fontWeight: 700 }}>
                    AÑO {y}
                  </div>
                ))}
                <CorrelLines subjects={subjects} positions={positions} />
                {subjects.map(s => (
                  <SubjectNode key={s.id} s={s} computed={computedAll[s.id]} pos={positions[s.id]}
                    linkingMode={!!linking} linkState={linkStateFor(s.id)}
                    onClick={() => linking ? cycleCorrel(s.id) : setModal(s)} />
                ))}
              </div>
            </TransformComponent>
          </TransformWrapper>
        </div>
      )}

      {modal && (
        <PlanSubjectModal
          subject={modal === "new" ? null : modal}
          allSubjects={subjects}
          onClose={() => setModal(null)}
          onSave={saveSubject}
          onDelete={deleteSubject}
          onLink={(id) => { setModal(null); setLinking({ id, kind: "cursar" }); }}
        />
      )}
      {bulkOpen && <BulkAddModal onClose={() => setBulkOpen(false)} onAdd={addBulk} />}
    </div>
  );
};

export { Correlatividades };
