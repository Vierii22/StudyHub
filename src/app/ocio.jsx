import React from 'react';

import { Icon } from './icons.jsx';
import { useStore, uid, toast } from './store.jsx';
import { Modal, Field, Empty } from './ui.jsx';

/* ============================================================
   OCIO — Pelis · Series · Juegos (DESIGN.md punto 9)
   Puntaje numérico ★N/10, estados propios por tipo, juegos con
   horas jugadas + "Mis anotaciones" (diario fechado).
   Carátulas: placeholder cálido por ahora — TMDB/RAWG quedan
   para cuando el usuario tenga las API keys (Fase 8, pendiente).
   ============================================================ */

const TABS = [
  { id: "pelis",  label: "Pelis",  icon: "film" },
  { id: "series", label: "Series", icon: "tv" },
  { id: "juegos", label: "Juegos", icon: "gamepad" },
];

const STATUS_META = {
  pelis:  { quiero_ver: { label: "Quiero ver", color: "var(--tx-2)", bg: "var(--off)" }, viendo: { label: "Viendo", color: "var(--org-deep)", bg: "#F7E4D3" }, visto: { label: "Visto", color: "#2f5e10", bg: "var(--green-bg)" } },
  series: { quiero_ver: { label: "Quiero ver", color: "var(--tx-2)", bg: "var(--off)" }, viendo: { label: "Viendo", color: "var(--org-deep)", bg: "#F7E4D3" }, visto: { label: "Visto", color: "#2f5e10", bg: "var(--green-bg)" } },
  juegos: { a_jugar: { label: "A jugar", color: "var(--tx-2)", bg: "var(--off)" }, jugando: { label: "Jugando", color: "var(--org-deep)", bg: "#F7E4D3" }, terminado: { label: "Terminado", color: "#2f5e10", bg: "var(--green-bg)" } },
};

const NOTE_TAGS = ["Jugando", "Al terminar"];

const PLATFORMS = ["PC", "Xbox", "PlayStation", "Nintendo"];
const YEAR_MIN = 1970;
const CURRENT_YEAR = new Date().getFullYear();

/* ---------- selector de plataforma (chips clickeables) ---------- */
const PlatformPicker = ({ value, onChange }) => (
  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
    {PLATFORMS.map(p => (
      <button key={p} type="button" className={`tab${value === p ? " on" : ""}`} onClick={() => onChange(value === p ? "" : p)}>{p}</button>
    ))}
  </div>
);

/* ---------- puntaje con estrellas (0-10, medios puntos) ---------- */
const StarRating = ({ value = 0, onChange }) => {
  const pick = (e, i) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const half = (e.clientX - rect.left) < rect.width / 2;
    onChange(half ? i * 2 - 1 : i * 2);
  };
  return (
    <div className="star-pick">
      {[1, 2, 3, 4, 5].map(i => {
        const full = value >= i * 2;
        const half = !full && value >= i * 2 - 1;
        return (
          <span key={i} className="star-wrap" onClick={e => pick(e, i)}>
            <Icon name="star" size={24} color="var(--line-2)" />
            {(full || half) && (
              <span style={{ position: "absolute", top: 0, left: 0, overflow: "hidden", width: full ? "100%" : "50%" }}>
                <Icon name="star" size={24} fill="var(--org)" color="var(--org)" />
              </span>
            )}
          </span>
        );
      })}
      <span className="mono" style={{ fontSize: 11, color: "var(--tx-3)", marginLeft: 8 }}>{value > 0 ? `${value}/10` : "Sin puntaje"}</span>
    </div>
  );
};

/* ---------- tarjeta con carátula placeholder ---------- */
const Cover = ({ title, icon }) => (
  <div style={{
    width: "100%", aspectRatio: "2/3", borderRadius: 12, background: "var(--field)",
    display: "grid", placeItems: "center", color: "var(--soft)", overflow: "hidden",
  }}>
    <Icon name={icon} size={30} />
  </div>
);

/* ---------- tarjeta de ítem (grid) ---------- */
const ItemCard = ({ item, kind, onClick }) => {
  const meta = STATUS_META[kind][item.status];
  return (
    <div onClick={onClick} style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 9 }}>
      <Cover title={item.title} icon={kind === "juegos" ? "gamepad" : kind === "series" ? "tv" : "film"} />
      <div>
        <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.25, color: "var(--tx-1)" }}>{item.title}</div>
        {(item.year || item.platform) && <div className="small" style={{ fontSize: 11, marginTop: 2 }}>{[item.year, item.platform].filter(Boolean).join(" · ")}</div>}
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: meta.color, background: meta.bg, padding: "3px 9px", borderRadius: 20 }}>{meta.label}</span>
        {item.rating > 0 && <span className="mono" style={{ fontSize: 10.5, color: "var(--org-deep)" }}>★ {item.rating}/10</span>}
      </div>
      {kind !== "juegos" && item.status === "viendo" && (
        <div className="bar" style={{ height: 5 }}><i style={{ width: `${item.progress || 0}%` }}></i></div>
      )}
      {kind === "juegos" && item.hours > 0 && (
        <div className="mono" style={{ fontSize: 10, color: "var(--tx-3)" }}>{item.hours}h jugadas</div>
      )}
    </div>
  );
};

/* ---------- modal de edición ---------- */
const ItemModal = ({ item, kind, onClose, onSave, onDelete }) => {
  const [f, setF] = React.useState(item || { title: "", year: "", platform: "", status: kind === "juegos" ? "a_jugar" : "quiero_ver", rating: 0, progress: 0, hours: 0, notes: [] });
  const [noteText, setNoteText] = React.useState("");
  const [noteTag, setNoteTag] = React.useState(NOTE_TAGS[0]);
  const up = (k, v) => setF(x => ({ ...x, [k]: v }));
  const statuses = Object.keys(STATUS_META[kind]);

  const addNote = () => {
    if (!noteText.trim()) return;
    up("notes", [{ date: new Date().toISOString().slice(0, 10), tag: noteTag, text: noteText.trim() }, ...(f.notes || [])]);
    setNoteText("");
  };

  const save = () => {
    if (!f.title.trim()) return toast("Poné un título");
    onSave({ ...f, id: f.id || uid() });
  };

  return (
    <Modal title={item ? "Editar" : "Agregar"} icon={kind === "juegos" ? "gamepad" : kind === "series" ? "tv" : "film"} onClose={onClose} wide={kind === "juegos"}
      footer={<><span className="link" style={{ color: item ? "var(--org-deep)" : "var(--tx-3)" }} onClick={() => { if (item) onDelete(f.id); else onClose(); }}>{item ? "Eliminar" : "Cancelar"}</span><button className="btn btn-primary" onClick={save}>Guardar</button></>}>
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="Título *"><input className="input" value={f.title} onChange={e => up("title", e.target.value)} autoFocus /></Field>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Año" hint={f.year ? String(f.year) : "sin definir"}>
            <input type="range" className="range-slider" min={YEAR_MIN} max={CURRENT_YEAR + 1}
              value={f.year || CURRENT_YEAR} onChange={e => up("year", Number(e.target.value))} />
          </Field>
          <Field label={kind === "juegos" ? "Plataforma" : "Dónde"}>
            {kind === "juegos"
              ? <PlatformPicker value={f.platform} onChange={v => up("platform", v)} />
              : <input className="input" value={f.platform} onChange={e => up("platform", e.target.value)} placeholder="Netflix, cine…" />}
          </Field>
        </div>
        <Field label="Estado">
          <div className="seg" style={{ display: "flex", width: "100%" }}>
            {statuses.map(s => <button key={s} className={f.status === s ? "on" : ""} style={{ flex: 1 }} onClick={() => up("status", s)}>{STATUS_META[kind][s].label}</button>)}
          </div>
        </Field>
        <div className="grid" style={{ gridTemplateColumns: kind === "juegos" ? "1fr 1fr" : "1fr 1fr" }}>
          <Field label="Puntaje" hint="sobre 10">
            <StarRating value={f.rating} onChange={v => up("rating", v)} />
          </Field>
          {kind === "juegos"
            ? <Field label="Horas jugadas"><input className="input" type="number" min="0" step="0.5" value={f.hours} onChange={e => up("hours", Number(e.target.value))} /></Field>
            : (f.status === "viendo" && <Field label="Progreso" hint="%"><input className="input" type="number" min="0" max="100" value={f.progress} onChange={e => up("progress", Number(e.target.value))} /></Field>)}
        </div>

        {kind === "juegos" && (
          <Field label="Mis anotaciones" hint="diario mientras jugás o al terminar">
            <div style={{ display: "grid", gap: 10 }}>
              <div className="row" style={{ gap: 8 }}>
                <select className="input" style={{ width: 140, flex: "0 0 auto" }} value={noteTag} onChange={e => setNoteTag(e.target.value)}>
                  {NOTE_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input className="input" value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="¿Qué te pareció hasta ahora?" onKeyDown={e => e.key === "Enter" && addNote()} />
                <button className="btn btn-secondary" style={{ flex: "0 0 auto" }} onClick={addNote}><Icon name="plus" size={15} /></button>
              </div>
              {(f.notes || []).length === 0
                ? <div className="small" style={{ color: "var(--tx-3)" }}>Sin anotaciones todavía.</div>
                : (
                  <div style={{ display: "grid", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                    {f.notes.map((n, i) => (
                      <div key={i} style={{ background: "var(--field)", borderRadius: 10, padding: "10px 12px" }}>
                        <div className="row between" style={{ marginBottom: 4 }}>
                          <span className="mono" style={{ fontSize: 9.5, color: "var(--org-deep)" }}>{n.tag.toUpperCase()}</span>
                          <div className="row" style={{ gap: 8 }}>
                            <span className="mono" style={{ fontSize: 9.5, color: "var(--tx-3)" }}>{n.date}</span>
                            <span style={{ cursor: "pointer", color: "var(--tx-3)" }} onClick={() => up("notes", f.notes.filter((_, j) => j !== i))}><Icon name="x" size={11} /></span>
                          </div>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--tx-1)" }}>{n.text}</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </Field>
        )}
      </div>
    </Modal>
  );
};

/* ---------- pantalla principal ---------- */
const Ocio = () => {
  const [data, set] = useStore();
  const [tab, setTab] = React.useState("pelis");
  const [statusFilter, setStatusFilter] = React.useState("todos");
  const [modal, setModal] = React.useState(null);

  const items = data.ocio[tab] || [];
  const statuses = Object.keys(STATUS_META[tab]);
  const visible = statusFilter === "todos" ? items : items.filter(i => i.status === statusFilter);

  const saveItem = (item) => {
    set(s => {
      const list = s.ocio[tab];
      const idx = list.findIndex(x => x.id === item.id);
      if (idx >= 0) list[idx] = item; else list.push(item);
    });
    toast("Guardado");
    setModal(null);
  };
  const deleteItem = (id) => {
    set(s => { s.ocio[tab] = s.ocio[tab].filter(x => x.id !== id); });
    toast("Eliminado");
    setModal(null);
  };

  return (
    <div className="page page-wide">
      <div className="row between" style={{ marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="h2">Ocio</div>
          <div className="small" style={{ marginTop: 4 }}>{items.length} {items.length === 1 ? "entrada" : "entradas"}</div>
        </div>
        <div className="icon-btn" style={{ width: 40, height: 40, background: "var(--ink)", color: "#fff", boxShadow: "0 3px 0 var(--ink-2)" }} title="Agregar" onClick={() => setModal("new")}>
          <Icon name="plus" size={18} color="var(--org)" />
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab${tab === t.id ? " on" : ""}`} onClick={() => { setTab(t.id); setStatusFilter("todos"); }}>
            <Icon name={t.icon} size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <button className={`tab${statusFilter === "todos" ? " on" : ""}`} onClick={() => setStatusFilter("todos")}>Todos</button>
        {statuses.map(s => <button key={s} className={`tab${statusFilter === s ? " on" : ""}`} onClick={() => setStatusFilter(s)}>{STATUS_META[tab][s].label}</button>)}
      </div>

      {visible.length === 0
        ? <Empty hubby="idle" title="Sin entradas" sub="Agregá algo con el botón de arriba." />
        : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: 18 }}>
            {visible.map(item => <ItemCard key={item.id} item={item} kind={tab} onClick={() => setModal(item)} />)}
          </div>
        )}

      {modal && (
        <ItemModal
          item={modal === "new" ? null : modal}
          kind={tab}
          onClose={() => setModal(null)}
          onSave={saveItem}
          onDelete={deleteItem}
        />
      )}
    </div>
  );
};

export { Ocio };
