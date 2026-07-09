import React from 'react';

import { Icon } from './icons.jsx';
import { useStore, uid, toast } from './store.jsx';
import { Btn, Chip, Modal, Field, PageHead, Empty, MonoLabel } from './ui.jsx';

/* ============================================================
   OCIO — pelis / series / juegos / libros
   NOTA: implementación heredada, sólo con colores cálidos
   aplicados. El rediseño completo (tabs Pelis/Series/Juegos,
   puntaje ★/10, carátulas por API, diario de juegos) es la
   Fase 8 del plan — todavía no se hizo.
   ============================================================ */

const OCIO_TYPES  = [["Todos","✨"],["Película","🎬"],["Serie","📺"],["Juego","🎮"],["Libro","📚"]];
const OCIO_EMOJI  = { "Película": "🎬", "Serie": "📺", "Juego": "🎮", "Libro": "📚" };
const OCIO_STATUS = { pendiente: ["Pendiente","var(--org)"], progreso: ["En curso","var(--soft)"], completado: ["Completado","var(--green)"] };

/* Etiqueta de "completado" varía según tipo */
const statusLabel = (st, type) => {
  if (st !== "completado") return OCIO_STATUS[st]?.[0] || st;
  if (type === "Juego") return "Jugado";
  if (type === "Libro") return "Leído";
  return "Visto";
};

/* Estrellas 1-5 */
const StarRating = ({ value, onChange, size = 18 }) => (
  <div className="row" style={{ gap: 1, flexShrink: 0 }}>
    {[1,2,3,4,5].map(n => (
      <span key={n}
        style={{ fontSize: size, cursor: onChange ? "pointer" : "default", color: n <= value ? "var(--org)" : "var(--line-2)", lineHeight: 1, transition: "color .1s", userSelect: "none" }}
        onClick={() => onChange?.(n === value ? 0 : n)}>★</span>
    ))}
  </div>
);

const OcioModal = ({ item, onClose }) => {
  const [, set] = useStore();
  const [f, setF] = React.useState(() => item
    ? { title: item.title, type: item.type || "Película", status: item.status || "pendiente", score: Math.min(5, item.score || 0), note: item.note || "" }
    : { title: "", type: "Película", status: "pendiente", score: 0, note: "" });
  const up = (k, v) => setF(x => ({ ...x, [k]: v }));
  const emoji = OCIO_EMOJI[f.type] || "✨";
  const save = () => {
    if (!f.title.trim()) return toast("Poné un título");
    set(s => {
      if (item) Object.assign(s.ocio.find(o => o.id === item.id), { ...f, emoji });
      else s.ocio.push({ id: uid(), ...f, emoji });
    });
    toast("Guardado");
    onClose();
  };
  return (
    <Modal title={item ? "Editar" : "Agregar"} icon="sparkles" onClose={onClose}
      footer={<><span className="link" style={{ color: item ? "var(--org-deep)" : "var(--tx-3)" }}
        onClick={() => { if (item) { set(s => s.ocio = s.ocio.filter(o => o.id !== item.id)); toast("Eliminado"); } onClose(); }}>
        {item ? "Eliminar" : "Cancelar"}</span><Btn variant="primary" onClick={save}>Guardar</Btn></>}>
      <div style={{ display: "grid", gap: 14 }}>
        <div className="row" style={{ gap: 12, alignItems: "flex-end" }}>
          <span style={{ fontSize: 38, lineHeight: 1, flexShrink: 0, paddingBottom: 2 }}>{emoji}</span>
          <div style={{ flex: 1 }}><Field label="Título *"><input className="input" value={f.title} onChange={e => up("title", e.target.value)} autoFocus /></Field></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Tipo"><select className="input" style={{ width: "100%" }} value={f.type} onChange={e => up("type", e.target.value)}>
            {OCIO_TYPES.slice(1).map(([t, e]) => <option key={t} value={t}>{e} {t}</option>)}
          </select></Field>
          <Field label="Estado"><select className="input" style={{ width: "100%" }} value={f.status} onChange={e => up("status", e.target.value)}>
            {Object.keys(OCIO_STATUS).map(k => <option key={k} value={k}>{statusLabel(k, f.type)}</option>)}
          </select></Field>
        </div>
        <Field label="Puntuación"><div style={{ paddingTop: 6 }}><StarRating value={f.score} onChange={v => up("score", v)} size={26} /></div></Field>
        <Field label="Nota"><input className="input" value={f.note} onChange={e => up("note", e.target.value)} placeholder="Breve comentario…" /></Field>
      </div>
    </Modal>
  );
};

const Ocio = () => {
  const [data, set] = useStore();
  const [filter, setFilter] = React.useState("Todos");
  const [modal,  setModal]  = React.useState(null);
  const [view,   setView]   = React.useState("cards");
  const items = data.ocio.filter(o => filter === "Todos" || o.type === filter);
  const count = (st) => data.ocio.filter(o => o.status === st).length;
  return (
    <div className="page page-wide">
      <PageHead title="Pelis" meta={`${data.ocio.length} ${data.ocio.length === 1 ? "entrada" : "entradas"} · ${count("completado")} completados · ${count("pendiente")} pendientes`}>
        <div className="seg">
          <button className={view === "tabla" ? "on" : ""} onClick={() => setView("tabla")}>Tabla</button>
          <button className={view === "cards" ? "on" : ""} onClick={() => setView("cards")}>Cards</button>
        </div>
        <Btn variant="primary" icon="plus" onClick={() => setModal("new")}>Agregar</Btn>
      </PageHead>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 22 }}>
        {Object.keys(OCIO_STATUS).map(st => (
          <div key={st} className="card" style={{ padding: "16px 20px" }}>
            <MonoLabel>{OCIO_STATUS[st][0]}</MonoLabel>
            <div className="stat" style={{ fontSize: 40, marginTop: 8, color: OCIO_STATUS[st][1] }}>{count(st)}</div>
          </div>
        ))}
      </div>

      {/* Filtros por tipo */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {OCIO_TYPES.map(([t, e]) => <button key={t} className={`tab${filter === t ? " on" : ""}`} onClick={() => setFilter(t)}>{e} {t}</button>)}
      </div>

      {items.length === 0
        ? <Empty icon="sparkles" title="Sin entradas" sub="Agregá algo al catálogo." />
        : view === "tabla"
          ? (
            /* ── TABLA ── */
            <div className="card card-flush">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    {[["", 44], ["Título", null], ["Estado", 120], ["Nota", null], ["Puntuación", 130], ["", 44]].map(([h, w], i) => (
                      <th key={i} style={{ padding: "11px 16px", textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--tx-3)", fontWeight: 500, letterSpacing: ".08em", textTransform: "uppercase", width: w || undefined }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(o => (
                    <tr key={o.id} className="hoverable" style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }} onClick={() => setModal(o)}>
                      <td style={{ padding: "12px 16px", fontSize: 22, textAlign: "center", lineHeight: 1 }}>{o.emoji || OCIO_EMOJI[o.type] || "✨"}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, fontSize: 14.5 }}>{o.title}</div>
                        <div className="mono" style={{ fontSize: 10, marginTop: 2, color: "var(--tx-3)" }}>{o.type}</div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className="chip" style={{ fontSize: 9.5, color: OCIO_STATUS[o.status]?.[1], borderColor: (OCIO_STATUS[o.status]?.[1] || "") + "55" }}>
                          {statusLabel(o.status, o.type)}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 13, color: o.note ? "var(--tx-2)" : "var(--tx-3)", fontStyle: o.note ? "normal" : "italic" }}>{o.note || "—"}</span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <StarRating value={Math.min(5, o.score || 0)} size={14} />
                      </td>
                      <td style={{ padding: "12px 16px" }} onClick={e => e.stopPropagation()}>
                        <span style={{ cursor: "pointer", color: "var(--tx-3)" }}
                          onClick={() => { set(s => s.ocio = s.ocio.filter(x => x.id !== o.id)); toast("Eliminado"); }}>
                          <Icon name="x" size={13} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* ── CARDS ── */
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 14 }}>
              {items.map(o => (
                <div key={o.id} className="card hoverable" style={{ cursor: "pointer" }} onClick={() => setModal(o)}>
                  <div className="row between" style={{ marginBottom: 14 }}>
                    <span style={{ fontSize: 30 }}>{o.emoji || OCIO_EMOJI[o.type] || "✨"}</span>
                    <span className="chip" style={{ fontSize: 9.5, color: OCIO_STATUS[o.status]?.[1], borderColor: (OCIO_STATUS[o.status]?.[1] || "") + "55" }}>
                      {statusLabel(o.status, o.type)}
                    </span>
                  </div>
                  <div className="h3">{o.title}</div>
                  <div className="mono" style={{ marginTop: 6 }}>{o.type}</div>
                  {o.note && <div className="small" style={{ marginTop: 10 }}>{o.note}</div>}
                  {(o.score || 0) > 0 && <div style={{ marginTop: 14 }}><StarRating value={Math.min(5, o.score || 0)} size={16} /></div>}
                </div>
              ))}
            </div>
          )}

      {modal && <OcioModal item={modal === "new" ? null : modal} onClose={() => setModal(null)} />}
    </div>
  );
};

export { Ocio };
