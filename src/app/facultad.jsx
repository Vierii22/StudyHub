import React from 'react';

import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, COLORS, DEFAULT_EVAL, deriveEstado, subjectPromedio } from './store.jsx';
import { Btn, Chip, MonoLabel, PageHead, Empty, Modal, Field } from './ui.jsx';
import { supabase } from '../supabase.js';

/* ── subida de archivos a Supabase Storage (para archivos grandes, hasta 100 MB) ── */
const FILES_BUCKET = "materiales";
const FILE_MAX_MB = 100;
async function uploadToStorage(file) {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("no-session");
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/${uid()}-${safe}`;
  const { error } = await supabase.storage.from(FILES_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  const { data } = supabase.storage.from(FILES_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

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
  if (f.url) { window.open(f.url, "_blank", "noopener"); return; } /* archivo en Storage */
  const a = document.createElement("a");
  a.href = f.data; a.download = f.name;
  document.body.appendChild(a); a.click(); a.remove();
};

/* ---------- gestor de archivos de la materia ---------- */
const SubjectFiles = ({ files = [], onChange, accent = "#D9551F" }) => {
  const [over, setOver] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const add = async (fileList) => {
    const arr = Array.from(fileList || []);
    if (!arr.length) return;
    setBusy(true);
    const nuevos = [];
    for (const file of arr) {
      if (file.size > FILE_MAX_MB * 1048576) { toast(`"${file.name}" supera ${FILE_MAX_MB} MB`); continue; }
      const date = new Date().toLocaleDateString("es", { day: "numeric", month: "short" });
      try {
        const { path, url } = await uploadToStorage(file);
        nuevos.push({ id: uid(), name: file.name, type: file.type, size: file.size, path, url, date });
      } catch (e) {
        /* sin Storage disponible: guardamos en base64 solo si es chico */
        if (file.size <= 4 * 1048576) {
          try {
            const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
            nuevos.push({ id: uid(), name: file.name, type: file.type, size: file.size, data: dataUrl, date });
          } catch { toast(`No se pudo guardar "${file.name}"`); }
        } else {
          toast(`No se pudo subir "${file.name}" — falta el bucket "materiales" en Supabase`);
        }
      }
    }
    if (nuevos.length) onChange([...nuevos, ...(files || [])]);
    setBusy(false);
  };
  return (
    <div>
      <label
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        style={{ display: "flex", alignItems: "center", gap: 13, padding: "16px 18px", borderRadius: "var(--r-lg)", border: "1.5px dashed " + (over ? accent : "var(--line-2)"), background: over ? accent + "12" : "var(--surface-2)", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1, transition: "all .15s ease" }}>
        <span style={{ width: 40, height: 40, borderRadius: 11, background: accent + "22", color: accent, display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name={busy ? "clock" : "upload"} size={19} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{busy ? "Subiendo…" : "Subir material"}</div>
          <div className="small" style={{ fontSize: 11.5 }}>Arrastrá o hacé click — PDF, videos, presentaciones… hasta {FILE_MAX_MB} MB</div>
        </div>
        <input type="file" multiple disabled={busy} style={{ display: "none" }} onChange={e => { add(e.target.files); e.target.value = ""; }} />
      </label>
      {files.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {files.map((f, i) => (
            <div key={f.id} className="file-row row" style={{ gap: 12, padding: "10px 13px", borderRadius: 12, background: "var(--card)", border: "1px solid var(--line)", boxShadow: "0 1.5px 0 #e0d5c3", animationDelay: `${i * 45}ms` }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: accent + "1e", color: accent, display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name={fileIcon(f.type, f.name)} size={17} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                <div className="mono" style={{ fontSize: 10, marginTop: 2, color: "var(--tx-3)" }}>{fmtBytes(f.size)}{f.date ? " · " + f.date : ""}</div>
              </div>
              <div className="icon-btn" style={{ width: 32, height: 32 }} title="Descargar" onClick={() => downloadFile(f)}><Icon name="download" size={15} /></div>
              <div className="icon-btn" style={{ width: 32, height: 32 }} title="Eliminar" onClick={() => { if (f.path) supabase.storage.from(FILES_BUCKET).remove([f.path]).catch(() => {}); onChange(files.filter(x => x.id !== f.id)); }}><Icon name="trash" size={15} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ---------- pieza reutilizable: caja cálida (nunca oscura) ---------- */
const warmField = (active) => ({
  width: "100%", background: "var(--field)", color: "var(--soft)",
  border: "1.5px solid " + (active ? "var(--org)" : "var(--line)"),
  borderRadius: 10, padding: "10px 13px", fontFamily: "var(--font-body)", fontSize: 13.5,
});

const SectionHead = ({ icon, label }) => (
  <div className="row" style={{ gap: 9, marginBottom: 12 }}>
    <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--org)", color: "#fff", display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name={icon} size={14} /></span>
    <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{label}</span>
  </div>
);

/* ---------- horarios por día (distintos horarios por día) ---------- */
const DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const ScheduleEditor = ({ rows = [], onChange }) => {
  const upd = (i, patch) => onChange(rows.map((r, j) => j === i ? { ...r, ...patch } : r));
  const add = () => onChange([...rows, { day: "lun", from: "18:00", to: "20:00" }]);
  const remove = (i) => onChange(rows.filter((_, j) => j !== i));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((r, i) => (
        <div key={i} className="row" style={{ gap: 8 }}>
          <select value={r.day} onChange={e => upd(i, { day: e.target.value })} style={{ ...warmField(false), flex: "0 0 90px" }}>
            {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <input type="time" value={r.from} onChange={e => upd(i, { from: e.target.value })} style={warmField(false)} />
          <span style={{ color: "var(--tx-3)", flex: "0 0 auto" }}>—</span>
          <input type="time" value={r.to} onChange={e => upd(i, { to: e.target.value })} style={warmField(false)} />
          <span className="icon-btn" style={{ width: 32, height: 32, flex: "0 0 auto" }} onClick={() => remove(i)}><Icon name="trash" size={14} /></span>
        </div>
      ))}
      <button type="button" className="btn-soft" style={{ justifyContent: "center" }} onClick={add}><Icon name="plus" size={14} />Agregar horario</button>
    </div>
  );
};

/* ---------- temario inicial (con tirador para ordenar) ---------- */
const TemarioEditor = ({ items = [], onChange }) => {
  const [draft, setDraft] = React.useState("");
  const add = () => { const t = draft.trim(); if (!t) return; onChange([...items, { id: uid(), t, resumido: false, estudiado: false, repasos: 0 }]); setDraft(""); };
  const remove = (i) => onChange(items.filter((_, j) => j !== i));
  const move = (i, dir) => { const j = i + dir; if (j < 0 || j >= items.length) return; const arr = [...items]; [arr[i], arr[j]] = [arr[j], arr[i]]; onChange(arr); };
  return (
    <div>
      {items.length > 0 && (
        <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          {items.map((it, i) => (
            <div key={it.id} className="row" style={{ gap: 8, alignItems: "center", background: "var(--field)", borderRadius: 9, padding: "8px 10px" }}>
              <span style={{ color: "var(--tx-3)", flex: "0 0 auto", display: "flex" }}><Icon name="dots" size={14} /></span>
              <span style={{ flex: 1, fontSize: 13.5, color: "var(--soft)" }}>{it.t}</span>
              <span onClick={() => move(i, -1)} style={{ cursor: "pointer", color: "var(--tx-3)", display: "flex" }}><Icon name="chevL" size={13} style={{ transform: "rotate(90deg)" }} /></span>
              <span onClick={() => move(i, 1)} style={{ cursor: "pointer", color: "var(--tx-3)", display: "flex" }}><Icon name="chevL" size={13} style={{ transform: "rotate(-90deg)" }} /></span>
              <span onClick={() => remove(i)} style={{ cursor: "pointer", color: "var(--tx-3)", display: "flex" }}><Icon name="x" size={14} /></span>
            </div>
          ))}
        </div>
      )}
      <form className="row" style={{ gap: 8 }} onSubmit={e => { e.preventDefault(); add(); }}>
        <input style={warmField(false)} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Agregar tema y enter…" />
        <span className="icon-btn" style={{ width: 38, height: 38, flex: "0 0 auto" }} onClick={add}><Icon name="plus" size={16} /></span>
      </form>
    </div>
  );
};

/* ---------- Modal nueva/editar materia (DESIGN.md punto 7) ---------- */
const SubjectModal = ({ subject, preset, onClose }) => {
  const [, set] = useStore();
  const [f, setF] = React.useState(subject
    ? { files: [], schedule: [], ...subject }
    : { name: "", year: "", commission: "", link: "", color: COLORS[0], files: [], schedule: [], lists: {}, ...(preset || {}) });
  const up = (k, v) => setF(x => ({ ...x, [k]: v }));
  const upList = (k, v) => setF(x => ({ ...x, lists: { ...(x.lists || {}), [k]: v } }));
  const save = () => {
    if (!f.name.trim()) return toast("Poné un nombre");
    set(s => {
      if (subject) Object.assign(s.subjects.find(x => x.id === subject.id), f);
      else s.subjects.push({ id: uid(), ...f, pct: 0, board: null, boardMode: false, showDots: true, lists: f.lists || {}, eval: { ...DEFAULT_EVAL }, grades: {}, promoManual: false });
    });
    toast(subject ? "Materia actualizada" : "Materia creada");
    onClose();
  };
  return (
    <Modal title={subject ? "Editar materia" : "Nueva materia"} icon="book" onClose={onClose} wide
      footer={<><span className="link" style={{ color: "var(--tx-3)" }} onClick={onClose}>Cancelar</span>
        <button className="btnC-crear" onClick={save}><span className="btnC-chip"><Icon name="plus" size={13} /></span>{subject ? "Guardar cambios" : "Crear materia"}</button></>}>
      <div style={{ display: "grid", gap: 22, maxHeight: "64vh", overflowY: "auto", paddingRight: 4 }}>

        <div>
          <SectionHead icon="book" label="Datos" />
          <div style={{ display: "grid", gap: 12 }}>
            <label>
              <div className="mono" style={{ marginBottom: 6, fontSize: 10 }}>NOMBRE *</div>
              <input style={warmField(true)} value={f.name} onChange={e => up("name", e.target.value)} placeholder="Ej: Álgebra" autoFocus />
            </label>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <label>
                <div className="mono" style={{ marginBottom: 6, fontSize: 10 }}>AÑO</div>
                <input style={warmField(false)} value={f.year} onChange={e => up("year", e.target.value)} placeholder="1°, 2°…" />
              </label>
              <label>
                <div className="mono" style={{ marginBottom: 6, fontSize: 10 }}>PRÓXIMO EVENTO</div>
                <input style={warmField(false)} value={f.next || ""} onChange={e => up("next", e.target.value)} placeholder="Parcial · lun 18hs" />
              </label>
            </div>
            <div>
              <div className="mono" style={{ marginBottom: 8, fontSize: 10 }}>COLOR DE LA MATERIA</div>
              <div className="swatches">{COLORS.map(c => <div key={c} className={`swatch${f.color === c ? " sel" : ""}`} style={{ background: c }} onClick={() => up("color", c)} />)}</div>
            </div>
          </div>
        </div>

        <div>
          <SectionHead icon="clock" label="Horarios" />
          <ScheduleEditor rows={f.schedule} onChange={v => up("schedule", v)} />
        </div>

        <div>
          <SectionHead icon="layers" label="Comisión y aula virtual" />
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <label>
              <div className="mono" style={{ marginBottom: 6, fontSize: 10 }}>COMISIÓN</div>
              <input style={warmField(false)} value={f.commission} onChange={e => up("commission", e.target.value)} placeholder="Ej: Comisión 4" />
            </label>
            <label>
              <div className="mono" style={{ marginBottom: 6, fontSize: 10 }}>AULA VIRTUAL</div>
              <input style={warmField(false)} value={f.link} onChange={e => up("link", e.target.value)} placeholder="https://classroom.google.com/…" />
            </label>
          </div>
        </div>

        <div>
          <SectionHead icon="list" label="Temario" />
          <TemarioEditor items={f.lists?.temas || []} onChange={v => upList("temas", v)} />
        </div>

        <div>
          <div className="row between" style={{ marginBottom: 9 }}><div className="mono" style={{ fontSize: 10 }}>ARCHIVOS</div>{f.files.length > 0 && <span className="mono mono-accent" style={{ fontSize: 10 }}>{f.files.length} archivo{f.files.length !== 1 ? "s" : ""}</span>}</div>
          <SubjectFiles files={f.files} onChange={v => up("files", v)} accent={f.color} />
        </div>
      </div>
    </Modal>
  );
};

/* ---------- Card de materia (grid, editorial) ---------- */
const SubjectGridCard = ({ s, idx, onOpen, onEdit, onDelete }) => {
  const num = String(idx + 1).padStart(2, "0");
  const estado = deriveEstado(s);
  const terminada = estado === "aprobada" || estado === "promocionada";
  const promedio = terminada ? subjectPromedio(s) : null;
  return (
    <div className={`subj-ed${terminada ? " subj-ed-done" : ""}`} onClick={onOpen}>
      <div className="row between" style={{ marginBottom: 11 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--org)" }}>{num}</span>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }}></span>
        </span>
        {terminada
          ? <span style={{ fontSize: 11.5, fontWeight: 600, color: "#2f5e10", background: "var(--green-bg)", padding: "4px 11px", borderRadius: 20, display: "flex", alignItems: "center", gap: 5 }}><Icon name="check" size={12} />{promedio != null ? `${estado === "promocionada" ? "Promocionada" : "Aprobada"} · ${promedio}` : (estado === "promocionada" ? "Promocionada" : "Aprobada")}</span>
          : <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--org-deep)", background: "#F7E4D3", padding: "4px 11px", borderRadius: 20 }}>cursando</span>}
      </div>
      <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-.5px", color: "var(--ink)", lineHeight: 1.08, marginBottom: 9 }}>{s.name}</div>
      <div style={{ fontSize: 13, color: "var(--tx-2)", fontWeight: 500, minHeight: 18 }}>
        {s.next || "Sin eventos próximos"}
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

const Facultad = ({ onOpenSubject, onNav }) => {
  const [data, set] = useStore();
  const [modal, setModal] = React.useState(null); // 'new' | subject
  return (
    <div className="page page-cozy">
      <PageHead title="Mis materias" meta={`${data.subjects.length} materias · cuatrimestre en curso`}>
        <Btn variant="secondary" icon="space" onClick={() => onNav && onNav("correlatividades")}>Correlatividades</Btn>
      </PageHead>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))", gap: 16 }}>
        {data.subjects.map((s, i) => (
          <SubjectGridCard key={s.id} s={s} idx={i}
            onOpen={() => onOpenSubject(s.id)}
            onEdit={() => setModal(s)}
            onDelete={() => { set(st => st.subjects = st.subjects.filter(x => x.id !== s.id)); toast("Materia eliminada"); }} />
        ))}
        <div className="subj-new" onClick={() => setModal("new")}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--card)", border: "1px solid var(--line)", display: "grid", placeItems: "center", color: "var(--org)", boxShadow: "0 2px 0 #e0d5c3" }}><Icon name="plus" size={20} /></span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Nueva materia</span>
        </div>
      </div>
      {modal && <SubjectModal subject={modal === "new" ? null : modal} onClose={() => setModal(null)} />}
    </div>
  );
};

export { Facultad, SubjectModal, SubjectFiles, downloadFile, fmtBytes, fileIcon };