import React from 'react';

import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, COLORS, DEFAULT_EVAL } from './store.jsx';
import { Btn, Chip, MonoLabel, PageHead, Empty, Modal, Field } from './ui.jsx';
import { SmartList } from './widgets.jsx';

/* ============================================================
   FACULTAD — grid de materias + vista interna (pizarrón / widgets)
   ============================================================ */
const SWATCH_COLORS = COLORS;

/* ---------- helpers de archivos ---------- */
const fmtBytes = (b) => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB";
const fileIcon = (type = "", name = "") => {
  const n = (type + " " + name).toLowerCase();
  if (n.includes("image") || /\.(png|jpe?g|gif|webp|svg)$/.test(n)) return "image";
  if (n.includes("pdf")) return "fileText";
  if (/\.(ppt|pptx|key)/.test(n)) return "layers";
  if (/\.(doc|docx|txt|md)/.test(n)) return "fileText";
  return "file";
};
const downloadFile = (f) => {
  const a = document.createElement("a");
  a.href = f.data; a.download = f.name;
  document.body.appendChild(a); a.click(); a.remove();
};

/* ---------- gestor de archivos de la materia ---------- */
const SubjectFiles = ({ files = [], onChange, accent = "#8b6dff" }) => {
  const [over, setOver] = React.useState(false);
  const add = (fileList) => {
    const arr = Array.from(fileList || []);
    arr.forEach(file => {
      if (file.size > 4.5 * 1048576) { toast(`"${file.name}" es muy grande (máx 4.5 MB)`); return; }
      const r = new FileReader();
      r.onload = () => onChange([{ id: uid(), name: file.name, type: file.type, size: file.size, data: r.result, date: new Date().toLocaleDateString("es", { day: "numeric", month: "short" }) }, ...(files || [])]);
      r.readAsDataURL(file);
    });
  };
  return (
    <div>
      <label
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        style={{ display: "flex", alignItems: "center", gap: 13, padding: "16px 18px", borderRadius: "var(--r-lg)", border: "1.5px dashed " + (over ? accent : "var(--line-2)"), background: over ? accent + "12" : "var(--surface-2)", cursor: "pointer", transition: "all .15s ease" }}>
        <span style={{ width: 40, height: 40, borderRadius: 11, background: accent + "22", color: accent, display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name="upload" size={19} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Subir material</div>
          <div className="small" style={{ fontSize: 11.5 }}>Arrastrá o hacé click — PDF, presentaciones, resúmenes, TPs…</div>
        </div>
        <input type="file" multiple style={{ display: "none" }} onChange={e => { add(e.target.files); e.target.value = ""; }} />
      </label>
      {files.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {files.map(f => (
            <div key={f.id} className="row" style={{ gap: 12, padding: "10px 13px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--surface-3)", color: "var(--violet-hi)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name={fileIcon(f.type, f.name)} size={16} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                <div className="mono" style={{ fontSize: 10, marginTop: 2 }}>{fmtBytes(f.size)}{f.date ? " · " + f.date : ""}</div>
              </div>
              <div className="icon-btn" style={{ width: 32, height: 32 }} title="Descargar" onClick={() => downloadFile(f)}><Icon name="download" size={15} /></div>
              <div className="icon-btn" style={{ width: 32, height: 32 }} title="Eliminar" onClick={() => onChange(files.filter(x => x.id !== f.id))}><Icon name="trash" size={15} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ---------- editor de profesores (múltiples) ---------- */
const ProfsEditor = ({ profs = [], onChange }) => {
  const [draft, setDraft] = React.useState("");
  const addProf = () => { const v = draft.trim(); if (v) { onChange([...profs, v]); setDraft(""); } };
  return (
    <div>
      {profs.length > 0 && (
        <div className="chiprow" style={{ marginBottom: 10 }}>
          {profs.map((p, i) => (
            <span key={i} className="chip" style={{ paddingRight: 6 }}>
              <Icon name="user" size={12} />{p}
              <span style={{ cursor: "pointer", color: "var(--tx-3)", display: "inline-flex" }} onClick={() => onChange(profs.filter((_, j) => j !== i))}><Icon name="x" size={13} /></span>
            </span>
          ))}
        </div>
      )}
      <form className="row" style={{ gap: 8 }} onSubmit={e => { e.preventDefault(); addProf(); }}>
        <input className="input" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Agregar profesor/a y enter…" />
        <Btn variant="secondary" icon="plus" style={{ flex: "0 0 auto" }}></Btn>
      </form>
    </div>
  );
};

/* ---------- Modal nueva/editar materia ---------- */
const SubjectModal = ({ subject, preset, onClose }) => {
  const [, set] = useStore();
  const [f, setF] = React.useState(subject
    ? { profs: subject.prof && !subject.profs ? [subject.prof] : (subject.profs || []), files: [], photo: null, ...subject }
    : { name: "", profs: [], next: "", link: "", color: COLORS[0], photo: null, files: [], notes: "", lists: {}, ...(preset || {}) });
  const up = (k, v) => setF(x => ({ ...x, [k]: v }));
  const save = () => {
    if (!f.name.trim()) return toast("Poné un nombre");
    set(s => {
      if (subject) Object.assign(s.subjects.find(x => x.id === subject.id), { ...f, prof: f.profs[0] || "" });
      else s.subjects.push({ id: uid(), ...f, prof: f.profs[0] || "", pct: 0, board: null, boardMode: false, showDots: true, lists: f.lists || {}, eval: { ...DEFAULT_EVAL }, grades: {}, promoManual: false });
    });
    toast(subject ? "Materia actualizada" : "Materia creada");
    onClose();
  };
  const uploadPhoto = (e) => { const file = e.target.files[0]; if (file) { const r = new FileReader(); r.onload = () => up("photo", r.result); r.readAsDataURL(file); } };
  return (
    <Modal title={subject ? "Editar materia" : "Nueva materia"} icon="book" onClose={onClose} wide
      footer={<><span className="link" style={{ color: "var(--tx-3)" }} onClick={onClose}>Cancelar</span><Btn variant="primary" onClick={save}>Guardar materia</Btn></>}>
      <div style={{ display: "grid", gap: 16, maxHeight: "64vh", overflowY: "auto", paddingRight: 4 }}>
        {/* foto de portada */}
        <div>
          <div className="mono" style={{ marginBottom: 9 }}>Foto de la materia</div>
          <label style={{ display: "block", position: "relative", height: 124, borderRadius: "var(--r-lg)", overflow: "hidden", cursor: "pointer", border: "1px solid var(--line-2)", background: f.photo ? `url(${f.photo}) center/cover` : `linear-gradient(135deg, ${f.color}, ${f.color}aa)` }}>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,.32)", color: "#fff" }}>
              <div style={{ textAlign: "center" }}><Icon name="camera" size={22} /><div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 5 }}>{f.photo ? "Cambiar foto" : "Subir foto de portada"}</div></div>
            </div>
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={uploadPhoto} />
          </label>
          {f.photo && <span className="link" style={{ fontSize: 12, color: "#e8639b", display: "inline-block", marginTop: 8 }} onClick={() => up("photo", null)}>Quitar foto</span>}
        </div>

        <Field label="Nombre *"><input className="input" value={f.name} onChange={e => up("name", e.target.value)} placeholder="Ej: Álgebra" autoFocus /></Field>

        <Field label="Profesores"><ProfsEditor profs={f.profs} onChange={v => up("profs", v)} /></Field>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Próximo evento"><input className="input" value={f.next} onChange={e => up("next", e.target.value)} placeholder="Parcial · lun 18hs" /></Field>
          <Field label="Color de acento"><div className="swatches">{SWATCH_COLORS.map(c => <div key={c} className={`swatch${f.color === c ? " sel" : ""}`} style={{ background: c }} onClick={() => up("color", c)} />)}</div></Field>
        </div>

        <Field label="Link del aula virtual" hint="Classroom, campus, Moodle…">
          <div className="row" style={{ gap: 0, position: "relative" }}>
            <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--tx-3)" }}><Icon name="link" size={16} /></span>
            <input className="input" style={{ paddingLeft: 38 }} value={f.link} onChange={e => up("link", e.target.value)} placeholder="https://classroom.google.com/…" />
          </div>
        </Field>

        <div>
          <div className="row between" style={{ marginBottom: 9 }}><div className="mono">Material de la materia</div>{f.files.length > 0 && <span className="mono mono-accent" style={{ fontSize: 10 }}>{f.files.length} archivo{f.files.length !== 1 ? "s" : ""}</span>}</div>
          <SubjectFiles files={f.files} onChange={v => up("files", v)} accent={f.color} />
        </div>

        <Field label="Notas personales"><textarea className="input" rows={3} value={f.notes || ""} onChange={e => up("notes", e.target.value)} placeholder="Apuntes rápidos…" /></Field>
      </div>
    </Modal>
  );
};

/* ---------- Card de materia (grid, editorial) ---------- */
const SubjectGridCard = ({ s, idx, onOpen, onEdit, onDelete }) => {
  const num = String(idx + 1).padStart(2, "0");
  const profLine = (s.profs && s.profs.length) ? s.profs.join(" · ") : (s.prof || "");
  return (
    <div className="subj-ed" onClick={onOpen}>
      <div className="row between" style={{ marginBottom: 11 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--org)" }}>{num}</span>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }}></span>
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--org-deep)", background: "#F7E4D3", padding: "4px 11px", borderRadius: 20 }}>cursando</span>
      </div>
      <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-.5px", color: "var(--ink)", lineHeight: 1.08, marginBottom: 9 }}>{s.name}</div>
      <div style={{ fontSize: 13, color: "var(--tx-2)", fontWeight: 500, minHeight: 18 }}>
        {s.next || "Sin eventos próximos"}{profLine ? " · " + profLine : ""}
      </div>
      <div className="row between" style={{ borderTop: "1px solid var(--line)", paddingTop: 13, marginTop: 15 }}>
        <div className="row" style={{ gap: 4 }}>
          <div className="icon-btn" style={{ width: 32, height: 32 }} onClick={e => { e.stopPropagation(); onEdit(); }}><Icon name="edit" size={14} /></div>
          <div className="icon-btn" style={{ width: 32, height: 32 }} onClick={e => { e.stopPropagation(); onDelete(); }}><Icon name="trash" size={14} /></div>
        </div>
        <span className="link" style={{ fontSize: 13, color: "var(--org-deep)", fontWeight: 600 }}>Abrir →</span>
      </div>
    </div>
  );
};

/* ---------- Plantillas de materia ---------- */
const SUBJECT_TEMPLATES = [
  { id: "exactas", icon: "target", label: "Exactas", desc: "Álgebra, Análisis, Física", color: "#8b6dff",
    lists: { temas: [{ id: "x1", t: "Unidad 1", status: "pend" }, { id: "x2", t: "Unidad 2", status: "pend" }], fechas: [{ id: "x3", t: "Primer parcial", status: "pend", prio: "alta" }] } },
  { id: "prog", icon: "layout", label: "Programación", desc: "Algoritmos, Laboratorio", color: "#4ec5e8",
    lists: { tps: [{ id: "p1", t: "TP 1", status: "pend" }, { id: "p2", t: "TP 2", status: "pend" }], links: [{ id: "p3", t: "Repo de la cátedra", status: "pend" }] } },
  { id: "human", icon: "book", label: "Humanidades", desc: "Filosofía, Historia, Derecho", color: "#e8b04e",
    lists: { temas: [{ id: "h1", t: "Lectura obligatoria", status: "pend" }], notas: [{ id: "h2", t: "Resumen de la cátedra", status: "pend" }] } },
  { id: "ciencias", icon: "idea", label: "Ciencias", desc: "Química, Biología, Med", color: "#3ecf9a",
    lists: { tps: [{ id: "c1", t: "Práctica de lab 1", status: "pend" }], temas: [{ id: "c2", t: "Teoría unidad 1", status: "pend" }] } },
  { id: "blank", icon: "plus", label: "En blanco", desc: "Empezá de cero", color: COLORS[0], lists: {} },
];

const TemplatePicker = ({ onClose, onPick }) => (
  <Modal title="¿Qué tipo de materia es?" sub="Elegí una plantilla para arrancar con widgets cargados" icon="book" onClose={onClose} wide>
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 12 }}>
      {SUBJECT_TEMPLATES.map(t => (
        <div key={t.id} className="pickcard" onClick={() => onPick(t)} style={{ padding: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: t.color + "22", color: t.color, display: "grid", placeItems: "center", marginBottom: 14, border: "1px solid " + t.color + "55" }}><Icon name={t.icon} size={21} /></div>
          <div style={{ fontWeight: 700, fontSize: 15.5 }}>{t.label}</div>
          <div className="small" style={{ marginTop: 4, fontSize: 12.5 }}>{t.desc}</div>
        </div>
      ))}
    </div>
  </Modal>
);

const Facultad = ({ onOpenSubject }) => {
  const [data, set] = useStore();
  const [modal, setModal] = React.useState(null); // 'new' | subject
  const [preset, setPreset] = React.useState(null);
  const [picker, setPicker] = React.useState(false);
  return (
    <div className="page page-cozy">
      <PageHead title="Mis materias" meta={`${data.subjects.length} materias · cuatrimestre en curso`} />
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))", gap: 16 }}>
        {data.subjects.map((s, i) => (
          <SubjectGridCard key={s.id} s={s} idx={i}
            onOpen={() => onOpenSubject(s.id)}
            onEdit={() => { setPreset(null); setModal(s); }}
            onDelete={() => { set(st => st.subjects = st.subjects.filter(x => x.id !== s.id)); toast("Materia eliminada"); }} />
        ))}
        <div className="subj-new" onClick={() => setPicker(true)}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--card)", border: "1px solid var(--line)", display: "grid", placeItems: "center", color: "var(--org)", boxShadow: "0 2px 0 #e0d5c3" }}><Icon name="plus" size={20} /></span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Nueva materia</span>
        </div>
      </div>
      {picker && <TemplatePicker onClose={() => setPicker(false)} onPick={(tpl) => { setPreset({ color: tpl.color, lists: JSON.parse(JSON.stringify(tpl.lists || {})), notes: tpl.notes || "" }); setPicker(false); setModal("new"); }} />}
      {modal && <SubjectModal subject={modal === "new" ? null : modal} preset={modal === "new" ? preset : null} onClose={() => { setModal(null); setPreset(null); }} />}
    </div>
  );
};

export { Facultad, SubjectModal, TemplatePicker, SubjectFiles, ProfsEditor, downloadFile, fmtBytes, fileIcon };