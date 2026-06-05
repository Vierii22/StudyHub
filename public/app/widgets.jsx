/* ============================================================
   SMART LIST — ítems con propiedades + vistas (lista/kanban/tabla)
   + Side peek (panel lateral). Minimalista: las opciones aparecen
   al pasar el mouse o al abrir el ítem, no saturan la vista.
   ============================================================ */

const SL_STATUS = [
  { id: "pend",  label: "Pendiente", color: "#e8b04e" },
  { id: "curso", label: "En curso",  color: "#4ec5e8" },
  { id: "listo", label: "Listo",     color: "#3ecf9a" },
];
const SL_PRIO = [
  { id: "alta",  label: "Alta",  color: "#e8639b" },
  { id: "media", label: "Media", color: "#e8b04e" },
  { id: "baja",  label: "Baja",  color: "#3ecf9a" },
];
const slStatus = (id) => SL_STATUS.find(s => s.id === id) || SL_STATUS[0];
const slPrio   = (id) => SL_PRIO.find(p => p.id === id);

const normItem = (it) => ({
  id: it.id || uid(),
  t: it.t || "",
  done: !!it.done,
  status: it.status || (it.done ? "listo" : "pend"),
  prio: it.prio || null,
  due: it.due || "",
  progress: (it.progress ?? null),
  tags: Array.isArray(it.tags) ? it.tags : [],
  notes: it.notes || "",
});

/* —— chips inline —— */
const StatusChip = ({ id, onClick }) => {
  const s = slStatus(id);
  return <span className="sl-pill" onClick={onClick} style={{ color: s.color, borderColor: s.color + "55", background: s.color + "18" }}><span style={{ width: 6, height: 6, borderRadius: 99, background: s.color }}></span>{s.label}</span>;
};
const PrioChip = ({ id }) => { const p = slPrio(id); return p ? <span className="sl-pill" style={{ color: p.color, borderColor: p.color + "55" }}>{p.label}</span> : null; };

/* —— SIDE PEEK —— */
function SidePeek({ item, accent = "#8b6dff", crumb, onChange, onClose, onDelete }) {
  React.useEffect(() => { const k = e => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  const up = (k, v) => onChange({ ...item, [k]: v });
  const [tag, setTag] = React.useState("");
  return ReactDOM.createPortal(
    <>
      <div className="sp-scrim" onMouseDown={onClose}></div>
      <div className="sp-panel" onMouseDown={e => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 18 }}>
          <div className="mono" style={{ fontSize: 10 }}>{crumb}</div>
          <div className="icon-btn" style={{ width: 30, height: 30 }} onClick={onClose}><Icon name="x" size={15} /></div>
        </div>
        <input className="sp-title" value={item.t} onChange={e => up("t", e.target.value)} placeholder="Sin título" autoFocus />

        <div className="sp-row">
          <div className="sp-key"><Icon name="target" size={14} /> Estado</div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {SL_STATUS.map(s => <button key={s.id} className="sl-pick" onClick={() => up("status", s.id)} style={{ color: item.status === s.id ? "#fff" : s.color, background: item.status === s.id ? s.color : s.color + "16", borderColor: s.color + (item.status === s.id ? "" : "55") }}>{s.label}</button>)}
          </div>
        </div>
        <div className="sp-row">
          <div className="sp-key"><Icon name="bolt" size={14} /> Prioridad</div>
          <div className="row" style={{ gap: 6 }}>
            {SL_PRIO.map(p => <button key={p.id} className="sl-pick" onClick={() => up("prio", item.prio === p.id ? null : p.id)} style={{ color: item.prio === p.id ? "#fff" : p.color, background: item.prio === p.id ? p.color : p.color + "16", borderColor: p.color + (item.prio === p.id ? "" : "55") }}>{p.label}</button>)}
          </div>
        </div>
        <div className="sp-row">
          <div className="sp-key"><Icon name="calendar" size={14} /> Fecha límite</div>
          <input type="date" className="input" value={item.due} onChange={e => up("due", e.target.value)} style={{ width: "auto", padding: "8px 11px", colorScheme: "dark" }} />
        </div>
        <div className="sp-row">
          <div className="sp-key"><Icon name="layout" size={14} /> Progreso</div>
          <div className="row" style={{ gap: 12, flex: 1 }}>
            <input type="range" min="0" max="100" value={item.progress ?? 0} onChange={e => up("progress", +e.target.value)} style={{ flex: 1, accentColor: accent }} />
            <span className="mono" style={{ fontSize: 12, width: 38, textAlign: "right", color: accent }}>{item.progress ?? 0}%</span>
          </div>
        </div>
        <div className="sp-row" style={{ alignItems: "flex-start" }}>
          <div className="sp-key"><Icon name="bolt" size={14} /> Etiquetas</div>
          <div style={{ flex: 1 }}>
            <div className="chiprow" style={{ marginBottom: item.tags.length ? 8 : 0 }}>
              {item.tags.map((tg, i) => <span key={i} className="chip" style={{ paddingRight: 6 }}>{tg}<span style={{ cursor: "pointer", color: "var(--tx-3)", display: "inline-flex" }} onClick={() => up("tags", item.tags.filter((_, j) => j !== i))}><Icon name="x" size={12} /></span></span>)}
            </div>
            <form onSubmit={e => { e.preventDefault(); if (tag.trim()) { up("tags", [...item.tags, tag.trim()]); setTag(""); } }}>
              <input className="input" value={tag} onChange={e => setTag(e.target.value)} placeholder="Agregar etiqueta y enter…" style={{ padding: "8px 11px", fontSize: 12.5 }} />
            </form>
          </div>
        </div>
        <div style={{ marginTop: 6 }}>
          <div className="sp-key" style={{ marginBottom: 8 }}><Icon name="pen" size={14} /> Notas</div>
          <textarea className="input" rows={5} value={item.notes} onChange={e => up("notes", e.target.value)} placeholder="Notas rápidas sobre este ítem…" style={{ resize: "vertical" }} />
        </div>
        <div className="row between" style={{ marginTop: 22, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          <span className="link" style={{ color: "#e8639b", fontSize: 13 }} onClick={onDelete}>Eliminar ítem</span>
          <Btn variant="secondary" onClick={onClose}>Listo</Btn>
        </div>
      </div>
    </>, document.body);
}

/* —— SMART LIST —— */
function SmartList({ title, icon = "list", accent = "#8b6dff", items, onChange, placeholder = "Agregar ítem…", viewKey, crumb }) {
  const arr = (items || []).map(normItem);
  const [view, setView] = React.useState(() => (viewKey && localStorage.getItem(viewKey)) || "lista");
  const [openId, setOpenId] = React.useState(null);
  const [draft, setDraft] = React.useState("");
  const setView2 = (v) => { setView(v); if (viewKey) localStorage.setItem(viewKey, v); };
  const update = (id, patch) => onChange(arr.map(x => x.id === id ? { ...x, ...patch } : x));
  const replace = (next) => onChange(next);
  const add = () => { if (draft.trim()) { onChange([...arr, normItem({ t: draft.trim() })]); setDraft(""); } };
  const remove = (id) => { onChange(arr.filter(x => x.id !== id)); setOpenId(null); };
  const done = arr.filter(x => x.status === "listo").length;
  const pct = arr.length ? Math.round(done / arr.length * 100) : 0;
  const barCol = pct < 30 ? "#e8639b" : pct < 70 ? "#e8b04e" : "#3ecf9a";
  const open = arr.find(x => x.id === openId);
  const VIEWS = [["lista", "list"], ["kanban", "columns"], ["tabla", "grid"]];

  const meta = (it) => (
    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
      {it.prio && <PrioChip id={it.prio} />}
      {it.due && <span className="sl-pill" style={{ color: "var(--tx-2)" }}><Icon name="calendar" size={11} />{it.due.slice(5)}</span>}
      {it.tags.slice(0, 2).map((t, i) => <span key={i} className="sl-pill" style={{ color: "var(--tx-3)" }}>#{t}</span>)}
    </div>
  );

  return (
    <div className="card card-flush sl" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ height: 3, background: accent }}></div>
      <div style={{ padding: "16px 18px 10px" }}>
        <div className="row between">
          <div className="row" style={{ gap: 11 }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: accent + "22", color: accent, display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name={icon} size={17} /></span>
            <div className="h3" style={{ fontSize: 15 }}>{title}</div>
          </div>
          <div className="sl-tabs">
            {VIEWS.map(([v, ic]) => <button key={v} className={view === v ? "on" : ""} title={v} onClick={() => setView2(v)} style={view === v ? { color: accent } : null}><Icon name={ic} size={14} /></button>)}
          </div>
        </div>
        {arr.length > 0 && <div className="row" style={{ gap: 9, marginTop: 12 }}>
          <div className="bar" style={{ flex: 1, height: 4 }}><i style={{ width: pct + "%", background: barCol }}></i></div>
          <span className="mono" style={{ fontSize: 9.5 }} title={`${done} de ${arr.length} completados`}>{pct}%</span>
        </div>}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "2px 14px 8px" }}>
        {arr.length === 0 && <div className="small" style={{ color: "var(--tx-3)", padding: "12px 4px" }}>Sin ítems. Agregá uno abajo.</div>}

        {view === "lista" && arr.map(it => (
          <div key={it.id} className="sl-row" onClick={() => setOpenId(it.id)}>
            <div className={`cbox${it.status === "listo" ? " on" : ""}`} onClick={e => { e.stopPropagation(); update(it.id, { status: it.status === "listo" ? "pend" : "listo", done: it.status !== "listo" }); }}>{it.status === "listo" && <Icon name="check" size={13} color="#fff" />}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, textDecoration: it.status === "listo" ? "line-through" : "none", opacity: it.status === "listo" ? .5 : 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.t}</div>
              {(it.prio || it.due || it.tags.length > 0) && <div style={{ marginTop: 5 }}>{meta(it)}</div>}
            </div>
            <StatusChip id={it.status} onClick={e => { e.stopPropagation(); const i = SL_STATUS.findIndex(s => s.id === it.status); update(it.id, { status: SL_STATUS[(i + 1) % SL_STATUS.length].id }); }} />
          </div>
        ))}

        {view === "kanban" && (
          <div className="sl-kanban">
            {SL_STATUS.map(col => (
              <div key={col.id} className="sl-col">
                <div className="row between" style={{ marginBottom: 8 }}>
                  <span className="sl-pill" style={{ color: col.color, borderColor: col.color + "55", background: col.color + "18" }}><span style={{ width: 6, height: 6, borderRadius: 99, background: col.color }}></span>{col.label}</span>
                  <span className="mono" style={{ fontSize: 10 }}>{arr.filter(x => x.status === col.id).length}</span>
                </div>
                {arr.filter(x => x.status === col.id).map(it => (
                  <div key={it.id} className="sl-card" onClick={() => setOpenId(it.id)} style={{ borderLeft: `3px solid ${col.color}` }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{it.t}</div>
                    {(it.prio || it.due) && <div style={{ marginTop: 7 }}>{meta(it)}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {view === "tabla" && (
          <table className="sl-table">
            <thead><tr><th style={{ width: "44%" }}>Ítem</th><th>Estado</th><th>Prio</th><th>Fecha</th></tr></thead>
            <tbody>
              {arr.map(it => (
                <tr key={it.id} onClick={() => setOpenId(it.id)}>
                  <td style={{ color: "var(--tx-1)" }}>{it.t}</td>
                  <td><StatusChip id={it.status} onClick={e => { e.stopPropagation(); const i = SL_STATUS.findIndex(s => s.id === it.status); update(it.id, { status: SL_STATUS[(i + 1) % SL_STATUS.length].id }); }} /></td>
                  <td>{it.prio ? <PrioChip id={it.prio} /> : <span className="tx-3">—</span>}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{it.due ? it.due.slice(5) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <form className="row" style={{ gap: 9, padding: "12px 16px", borderTop: "1px solid var(--line)" }} onSubmit={e => { e.preventDefault(); add(); }}>
        <input className="input" value={draft} onChange={e => setDraft(e.target.value)} placeholder={placeholder} style={{ padding: "10px 13px", fontSize: 13.5 }} />
        <button className="btn" type="submit" style={{ flex: "0 0 auto", background: accent, color: "#fff", padding: "10px 13px" }}><Icon name="plus" size={15} /></button>
      </form>

      {open && <SidePeek item={open} accent={accent} crumb={`${crumb || title} › ${open.t || "Ítem"}`} onChange={p => update(open.id, p)} onClose={() => setOpenId(null)} onDelete={() => remove(open.id)} />}
    </div>
  );
}

Object.assign(window, { SmartList, SidePeek, SL_STATUS, SL_PRIO, normItem });
