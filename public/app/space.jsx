/* ============================================================
   MI ESPACIO — workspace personal (páginas + canvas libre,
   listas, hábitos, modo focus). Reusa CanvaBoard y SmartList.
   ============================================================ */

/* íconos de línea que el usuario puede ciclar para cada página */
const SPACE_ICONS = ["file","note","pin","fileText","target","fire","check","idea","book","palette","sparkles","star","gamepad","tv","film","mug","dumbbell","heart","smile","flag"];
/* legado: el usuario puede tener emojis en el store viejo — los renderizamos como texto */
const PageIcon = ({ name, size = 16, style }) => {
  if (name && SPACE_ICONS.includes(name)) return <Icon name={name} size={size} style={style} />;
  // fallback emoji o nombre desconocido
  return <span style={{ fontSize: Math.round(size * 1.1), lineHeight: 1, ...style }}>{name || "📄"}</span>;
};

/* —— editor de documento por bloques (estilo Notion) —— */
const DOC_TYPES = [
  { t: "text", label: "Texto", icon: "pen" },
  { t: "h1", label: "Título", icon: "type" },
  { t: "h2", label: "Subtítulo", icon: "type" },
  { t: "todo", label: "Tarea", icon: "check" },
  { t: "bullet", label: "Lista", icon: "list" },
  { t: "table", label: "Tabla", icon: "table" },
  { t: "callout", label: "Aviso", icon: "idea" },
  { t: "quote", label: "Cita", icon: "chat" },
  { t: "code", label: "Código", icon: "fileText" },
  { t: "divider", label: "Divisor", icon: "minus" },
];
const CALLOUT_SET = [["💡","#e8b04e"],["⚠️","#f0764e"],["✅","#3ecf9a"],["📌","#8b6dff"],["ℹ️","#4ec5e8"]];

function DocEditor({ blocks, onChange, focus }) {
  const list = (blocks && blocks.length) ? blocks : [{ id: "b0", type: "text", text: "" }];
  const refs = React.useRef({});
  const [slash, setSlash] = React.useState(null);
  const drag = React.useRef(null);
  const set = (id, patch) => onChange(list.map(b => b.id === id ? { ...b, ...patch } : b));
  const autosize = (el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } };
  const addAfter = (id, type = "text") => {
    const i = list.findIndex(b => b.id === id);
    const nb = { id: uid(), type, text: "", ...(type === "callout" ? { emoji: "💡", accent: "#e8b04e" } : {}), ...(type === "code" ? { lang: "js" } : {}), ...(type === "todo" ? { checked: false } : {}), ...(type === "table" ? newTableData() : {}) };
    onChange([...list.slice(0, i + 1), nb, ...list.slice(i + 1)]);
    setTimeout(() => refs.current[nb.id]?.focus(), 25);
  };
  const removeBlock = (id) => {
    if (list.length <= 1) { set(id, { type: "text", text: "" }); return; }
    const i = list.findIndex(b => b.id === id), prev = list[i - 1];
    onChange(list.filter(b => b.id !== id));
    if (prev) setTimeout(() => refs.current[prev.id]?.focus(), 25);
  };
  const onKey = (e, b) => {
    if (e.key === "Enter" && !e.shiftKey && b.type !== "code") { e.preventDefault(); setSlash(null); addAfter(b.id, (b.type === "todo" || b.type === "bullet") ? b.type : "text"); }
    else if (e.key === "Backspace" && !b.text) { e.preventDefault(); removeBlock(b.id); }
  };
  const onText = (b, v) => { set(b.id, { text: v }); setSlash(v === "/" ? b.id : null); };
  const pickType = (b, t) => { set(b.id, { type: t, text: "", ...(t === "callout" ? { emoji: "💡", accent: "#e8b04e" } : {}), ...(t === "code" ? { lang: "js" } : {}), ...(t === "table" ? newTableData() : {}) }); setSlash(null); setTimeout(() => refs.current[b.id]?.focus(), 25); };
  const startDrag = (e, id) => {
    e.preventDefault();
    drag.current = id;
    const move = (ev) => {
      const rows = [...document.querySelectorAll(".doc-block")];
      const tgt = rows.find(r => { const rc = r.getBoundingClientRect(); return ev.clientY < rc.top + rc.height / 2; });
      const tid = tgt ? tgt.dataset.id : (rows[rows.length - 1] && rows[rows.length - 1].dataset.id);
      if (!tid || tid === drag.current) return;
      const from = list.findIndex(b => b.id === drag.current), to = list.findIndex(b => b.id === tid);
      if (from < 0 || to < 0) return;
      const next = [...list]; const [m] = next.splice(from, 1); next.splice(to, 0, m); onChange(next);
    };
    const up = () => { drag.current = null; document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
  };

  const inputBase = { width: "100%", background: "none", border: "none", outline: "none", color: "var(--tx-1)", fontFamily: "var(--font-body)", resize: "none", overflow: "hidden", lineHeight: 1.6 };

  const renderField = (b) => {
    const common = { ref: el => { refs.current[b.id] = el; if (el && el.tagName === "TEXTAREA") autosize(el); }, value: b.text, onChange: e => { onText(b, e.target.value); if (e.target.tagName === "TEXTAREA") autosize(e.target); }, onKeyDown: e => onKey(e, b) };
    if (b.type === "h1") return <input {...common} placeholder="Título" style={{ ...inputBase, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 30, letterSpacing: "-.02em" }} />;
    if (b.type === "h2") return <input {...common} placeholder="Subtítulo" style={{ ...inputBase, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 21 }} />;
    if (b.type === "todo") return <div className="row" style={{ gap: 10, flex: 1 }}><div className={`cbox${b.checked ? " on" : ""}`} onClick={() => set(b.id, { checked: !b.checked })}>{b.checked && <Icon name="check" size={13} color="#fff" />}</div><input {...common} placeholder="Tarea" style={{ ...inputBase, fontSize: 15, textDecoration: b.checked ? "line-through" : "none", opacity: b.checked ? .55 : 1 }} /></div>;
    if (b.type === "bullet") return <div className="row" style={{ gap: 10, flex: 1, alignItems: "flex-start" }}><span style={{ color: "var(--violet-hi)", lineHeight: 1.7 }}>•</span><textarea rows={1} {...common} placeholder="Lista" style={{ ...inputBase, fontSize: 15 }} /></div>;
    if (b.type === "quote") return <div style={{ borderLeft: "3px solid var(--violet-line)", paddingLeft: 14 }}><textarea rows={1} {...common} placeholder="Cita…" style={{ ...inputBase, fontSize: 16, fontStyle: "italic", color: "var(--tx-2)" }} /></div>;
    if (b.type === "callout") return <div className="row" style={{ gap: 11, background: "var(--surface-2)", border: "1px solid var(--line)", borderLeft: `3px solid ${b.accent}`, borderRadius: 10, padding: "12px 14px" }}><button onClick={() => { const i = CALLOUT_SET.findIndex(c => c[0] === b.emoji); const n = CALLOUT_SET[(i + 1) % CALLOUT_SET.length]; set(b.id, { emoji: n[0], accent: n[1] }); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 19, lineHeight: 1.3 }}>{b.emoji}</button><textarea rows={1} {...common} placeholder="Escribí el aviso…" style={{ ...inputBase, fontSize: 14.5 }} /></div>;
    if (b.type === "code") return <div style={{ background: "#0f0f15", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}><select value={b.lang || "js"} onChange={e => set(b.id, { lang: e.target.value })} style={{ background: "var(--surface-2)", color: "var(--tx-2)", border: "1px solid var(--line)", borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 10.5, padding: "2px 6px", marginBottom: 8 }}>{["js","python","c","java","sql","bash","html","css"].map(l => <option key={l}>{l}</option>)}</select><textarea rows={2} ref={common.ref} value={b.text} onChange={e => { set(b.id, { text: e.target.value }); autosize(e.target); }} onKeyDown={e => { if (e.key === "Backspace" && !b.text) { e.preventDefault(); removeBlock(b.id); } }} placeholder="// código" spellCheck={false} style={{ ...inputBase, color: "#d8d8e0", fontFamily: "var(--font-mono)", fontSize: 12.5, tabSize: 2 }} /></div>;
    if (b.type === "divider") return <div style={{ padding: "10px 0" }}><div style={{ height: 1, background: "var(--line-2)" }}></div></div>;
    if (b.type === "table") return <TableBlock b={b} onPatch={(p) => set(b.id, p)} />;
    return <textarea rows={1} {...common} placeholder="Escribí algo, o “/” para comandos…" style={{ ...inputBase, fontSize: 15.5 }} />;
  };

  return (
    <div className="doc">
      {list.map(b => (
        <div key={b.id} className="doc-block" data-id={b.id}>
          <div className="doc-handle" onMouseDown={e => startDrag(e, b.id)} title="Arrastrar">⋮⋮</div>
          <div className="doc-plus" title="Agregar bloque" onClick={() => addAfter(b.id)}><Icon name="plus" size={14} /></div>
          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
            {renderField(b)}
            {slash === b.id && (
              <div className="doc-slash">
                {DOC_TYPES.map(d => <button key={d.t} onClick={() => pickType(b, d.t)}><Icon name={d.icon} size={15} /> {d.label}</button>)}
              </div>
            )}
          </div>
          {b.type !== "divider" && <span className="doc-del" title="Eliminar" onClick={() => removeBlock(b.id)}><Icon name="x" size={13} /></span>}
          {b.type === "divider" && <span className="doc-del" title="Eliminar" onClick={() => removeBlock(b.id)}><Icon name="x" size={13} /></span>}
        </div>
      ))}
      <button className="doc-addbtn" onClick={() => addAfter(list[list.length - 1].id)}><Icon name="plus" size={14} /> Agregar bloque</button>
    </div>
  );
}

/* —— tracker de hábitos —— */
function HabitsTracker({ page, onChange }) {
  const habits = page.habits || [];
  const [draft, setDraft] = React.useState("");
  const N = 14;
  const days = Array.from({ length: N }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (N - 1 - i)); return d; });
  const key = (d) => `${d.getMonth() + 1}-${d.getDate()}`;
  const DOW = ["D", "L", "M", "M", "J", "V", "S"];
  const toggle = (hid, k) => onChange(habits.map(h => h.id === hid ? { ...h, done: h.done.includes(k) ? h.done.filter(x => x !== k) : [...h.done, k] } : h));
  const streak = (h) => { let n = 0; for (let i = N - 1; i >= 0; i--) { if (h.done.includes(key(days[i]))) n++; else break; } return n; };
  const add = () => { if (draft.trim()) { onChange([...habits, { id: uid(), name: draft.trim(), emoji: "✅", done: [] }]); setDraft(""); } };
  const remove = (id) => onChange(habits.filter(h => h.id !== id));
  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <div className="row between" style={{ marginBottom: 18 }}>
        <div className="h3">Seguimiento de hábitos</div>
        <span className="mono" style={{ fontSize: 10 }}>últimos {N} días</span>
      </div>
      {habits.length === 0 && <div className="small" style={{ color: "var(--tx-3)", marginBottom: 14 }}>Sin hábitos. Agregá uno abajo.</div>}
      {habits.length > 0 && (
        <table className="habits">
          <thead>
            <tr>
              <th style={{ textAlign: "left", minWidth: 150 }}></th>
              {days.map((d, i) => <th key={i}><div className="mono" style={{ fontSize: 8.5 }}>{DOW[d.getDay()]}</div><div className="mono" style={{ fontSize: 10, color: i === N - 1 ? "var(--violet-hi)" : "var(--tx-3)" }}>{d.getDate()}</div></th>)}
              <th><div className="mono" style={{ fontSize: 8.5 }}>🔥</div></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {habits.map(h => (
              <tr key={h.id}>
                <td style={{ textAlign: "left" }}><span className="row" style={{ gap: 9, fontSize: 14 }}><span>{h.emoji}</span>{h.name}</span></td>
                {days.map((d, i) => { const k = key(d); const on = h.done.includes(k); return (
                  <td key={i}><div className="habit-cell" onClick={() => toggle(h.id, k)} style={{ background: on ? "var(--fill)" : "var(--surface-3)", borderColor: on ? "transparent" : "var(--line)" }}>{on && <Icon name="check" size={12} color="#fff" />}</div></td>
                ); })}
                <td><span className="mono mono-accent" style={{ fontSize: 13 }}>{streak(h)}</span></td>
                <td><span style={{ cursor: "pointer", color: "var(--tx-3)" }} onClick={() => remove(h.id)}><Icon name="x" size={14} /></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form className="addline" style={{ marginTop: 18, maxWidth: 360 }} onSubmit={e => { e.preventDefault(); add(); }}>
        <input className="input" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Nuevo hábito…" style={{ padding: "10px 13px", fontSize: 13.5 }} />
        <Btn variant="primary" icon="plus" style={{ flex: "0 0 auto" }}></Btn>
      </form>
    </div>
  );
}

function MiEspacio() {
  const [data, set] = useStore();
  const sp = data.space;
  const [focus, setFocus] = React.useState(false);
  const active = sp.pages.find(p => p.id === sp.activeId) || sp.pages[0];
  const setActive = (id) => set(s => s.space.activeId = id);
  const patch = (id, p) => set(s => Object.assign(s.space.pages.find(x => x.id === id), p));
  const setItems = (v) => patch(active.id, { items: v });
  const [renamingId, setRenamingId] = React.useState(null);
  const addPage = () => { const id = uid(); set(s => { s.space.pages.push({ id, icon: "file", title: "Nueva página", kind: "doc", blocks: [{ id: uid(), type: "text", text: "" }] }); s.space.activeId = id; }); setTimeout(() => setRenamingId(id), 80); };
  const delPage = (id) => { if (sp.pages.length <= 1) return toast("Tiene que quedar al menos una página"); set(s => { s.space.pages = s.space.pages.filter(p => p.id !== id); if (s.space.activeId === id) s.space.activeId = s.space.pages[0].id; }); };
  const cycleEmoji = () => { const i = SPACE_ICONS.indexOf(active.icon); const next = SPACE_ICONS[(i + 1) % SPACE_ICONS.length]; patch(active.id, { icon: next }); };

  React.useEffect(() => { if (!focus) return; const k = e => { if (e.key === "Escape") setFocus(false); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [focus]);

  const body = (
    <>
      <div className="row between" style={{ marginBottom: 18, gap: 14 }}>
        <div className="row" style={{ gap: 12, flex: 1, minWidth: 0 }}>
          <button onClick={cycleEmoji} title="Cambiar ícono" style={{ width: 44, height: 44, borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--line)", cursor: "pointer", color: "var(--violet-hi)", display: "grid", placeItems: "center", flex: "0 0 44px" }}><PageIcon name={active.icon} size={22} /></button>
          <input value={active.title} onChange={e => patch(active.id, { title: e.target.value })}
            style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: "var(--tx-1)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, letterSpacing: "-.02em" }} />
        </div>
        <div className="wrap-gap">
          <Btn variant={focus ? "primary" : "secondary"} icon={focus ? "minimize" : "maximize"} onClick={() => setFocus(f => !f)}>{focus ? "Salir de focus" : "Modo focus"}</Btn>
        </div>
      </div>
      {active.kind === "doc" && <DocEditor blocks={active.blocks || []} onChange={v => patch(active.id, { blocks: v })} focus={focus} />}
      {active.kind === "canvas" && <DocEditor blocks={active.blocks || []} onChange={v => patch(active.id, { blocks: v })} focus={focus} />}
      {active.kind === "list" && <SmartList title={active.title} icon={active.id === "objetivos" ? "target" : "check"} accent={active.id === "objetivos" ? "#3ecf9a" : "#8b6dff"} crumb="Mi Espacio" viewKey={`v_space_${active.id}`} items={active.items} onChange={setItems} placeholder="Agregar…" />}
      {active.kind === "habits" && <HabitsTracker page={active} onChange={(v) => patch(active.id, { habits: v })} />}
    </>
  );

  if (focus) return <div className="space-focus"><div style={{ width: "min(820px,100%)", margin: "0 auto", padding: "40px 20px 80px" }}>{body}</div></div>;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      {/* rail de páginas */}
      <div className="space-rail">
        <div className="mono" style={{ padding: "4px 8px 12px", fontSize: 9.5 }}>Mi Espacio</div>
        {sp.pages.map(p => (
          <div key={p.id}
            className={`space-pageitem${p.id === active.id ? " on" : ""}`}
            onClick={() => { setActive(p.id); setRenamingId(null); }}
            onDoubleClick={e => { e.stopPropagation(); setActive(p.id); setRenamingId(p.id); }}
            title="Doble click para renombrar">
            <span style={{ display: "grid", placeItems: "center", width: 18, height: 18, flex: "0 0 18px" }}><PageIcon name={p.icon} size={16} /></span>
            {renamingId === p.id ? (
              <input
                autoFocus
                value={p.title}
                onChange={e => patch(p.id, { title: e.target.value })}
                onBlur={() => setRenamingId(null)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setRenamingId(null); }}
                onClick={e => e.stopPropagation()}
                style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "1px solid var(--violet-line)", borderRadius: 4, color: "var(--tx-1)", fontFamily: "var(--font-body)", fontSize: 12.5, padding: "1px 4px" }}
              />
            ) : (
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
            )}
            <span className="space-del" onClick={e => { e.stopPropagation(); delPage(p.id); }}><Icon name="x" size={13} /></span>
          </div>
        ))}
        <button className="addbtn" style={{ marginTop: 8 }} onClick={addPage}><Icon name="plus" size={15} /> Nueva página</button>
      </div>
      {/* contenido */}
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        <div className="page" style={{ maxWidth: 1200, paddingTop: 22 }}>{body}</div>
      </div>
    </div>
  );
}

Object.assign(window, { MiEspacio });
