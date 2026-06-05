/* ============================================================
   BOARD — pizarrón estilo Canva
   Tipos: note|list|postit|image|heading|callout|code|link|divider|table|frame
   Parte A del plan: fix fullscreen, pointer events, tabla, cuadro, favicon
   ============================================================ */

const POSTIT_COLORS = ["#ffe08a","#ffd1dc","#c8f0d0","#bfe3ff","#e3d1ff","#ffd9b3"];
const WIDGET_BGS    = ["#141419","#1b1b22","#201a2e","#1a2420","#241a22","#1a2128"];
const CALLOUT_PRESETS = [
  { emoji: "💡", accent: "#e8b04e" }, { emoji: "⚠️", accent: "#f0764e" },
  { emoji: "✅", accent: "#3ecf9a" }, { emoji: "📌", accent: "#8b6dff" },
  { emoji: "ℹ️", accent: "#4ec5e8" }, { emoji: "🚨", accent: "#e8639b" },
];

function defaultBoardItem(kind, i = 0) {
  const base = { id: uid(), kind, x: 60 + i * 28, y: 60 + i * 28, w: 320, h: 240, bg: "#141419", border: "rgba(255,255,255,.11)", tx: "#f3f3f7", fs: 14 };
  if (kind === "list")    return { ...base, title: "Nueva lista", items: [] };
  if (kind === "note")    return { ...base, title: "Nota", text: "" };
  if (kind === "postit")  return { ...base, kind: "postit", w: 200, h: 190, bg: "#ffe08a", text: "" };
  if (kind === "image")   return { ...base, title: "Imagen", src: null };
  if (kind === "heading") return { ...base, kind: "heading", h: 96, w: 360, text: "Título", fs: 28 };
  if (kind === "callout") return { ...base, kind: "callout", w: 300, h: 140, bg: "#1b1b22", emoji: "💡", accent: "#e8b04e", text: "" };
  if (kind === "code")    return { ...base, kind: "code", bg: "#0f0f15", lang: "js", text: "" };
  if (kind === "link")    return { ...base, kind: "link", w: 290, h: 130, url: "", label: "" };
  if (kind === "divider") return { ...base, kind: "divider", h: 56, w: 380, bg: "transparent", border: "transparent" };
  /* nuevos tipos */
  if (kind === "table")  return { ...base, kind: "table", w: 520, h: 320, title: "Tabla", table: null };
  if (kind === "frame")  return { ...base, kind: "frame", w: 440, h: 300, bg: "rgba(139,109,255,.05)", border: "rgba(139,109,255,.3)", title: "Grupo" };
  return base;
}

/* ── contenido interno de cada widget ────────────────────── */
function BoardItemBody({ item, onChange }) {
  if (item.kind === "postit") {
    return (
      <textarea value={item.text} placeholder="Escribí algo…"
        onChange={e => onChange({ ...item, text: e.target.value })} />
    );
  }
  if (item.kind === "image") {
    return (
      <label style={{ display: "grid", placeItems: "center", height: "100%", cursor: "pointer", color: "var(--tx-3)", border: "1px dashed var(--line-2)", borderRadius: 8 }}>
        {item.src
          ? <img src={item.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
          : <div style={{ textAlign: "center" }}><Icon name="image" size={26} /><div className="small" style={{ marginTop: 8 }}>Click para subir</div></div>}
        <input type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = () => onChange({ ...item, src: r.result }); r.readAsDataURL(f); } }} />
      </label>
    );
  }
  if (item.kind === "note") {
    return (
      <textarea value={item.text} placeholder="Escribí tu nota…"
        style={{ width: "100%", height: "calc(100% - 4px)", minHeight: 80, background: "none", border: "none", outline: "none", resize: "none", color: item.tx, fontFamily: "var(--font-body)", fontSize: item.fs, lineHeight: 1.5 }}
        onChange={e => onChange({ ...item, text: e.target.value })} />
    );
  }
  if (item.kind === "heading") {
    return (
      <input value={item.text} placeholder="Título…"
        onChange={e => onChange({ ...item, text: e.target.value })}
        style={{ width: "100%", background: "none", border: "none", outline: "none", color: item.tx, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: item.fs, letterSpacing: "-.02em" }} />
    );
  }
  if (item.kind === "callout") {
    const cycle = () => { const i = CALLOUT_PRESETS.findIndex(p => p.emoji === item.emoji); const n = CALLOUT_PRESETS[(i + 1) % CALLOUT_PRESETS.length]; onChange({ ...item, emoji: n.emoji, accent: n.accent }); };
    return (
      <div style={{ display: "flex", gap: 11, height: "100%", borderLeft: `3px solid ${item.accent}`, paddingLeft: 12 }}>
        <button onClick={cycle} title="Cambiar ícono" style={{ flex: "0 0 auto", fontSize: 22, background: "none", border: "none", cursor: "pointer", lineHeight: 1, height: 30 }}>{item.emoji}</button>
        <textarea value={item.text} placeholder="Escribí el aviso…" onChange={e => onChange({ ...item, text: e.target.value })}
          style={{ flex: 1, background: "none", border: "none", outline: "none", resize: "none", color: item.tx, fontFamily: "var(--font-body)", fontSize: item.fs, lineHeight: 1.5 }} />
      </div>
    );
  }
  if (item.kind === "code") {
    const LANGS = ["js", "python", "c", "java", "sql", "bash", "html", "css"];
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <select value={item.lang} onChange={e => onChange({ ...item, lang: e.target.value })}
            style={{ background: "var(--surface-2)", color: "var(--tx-2)", border: "1px solid var(--line)", borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 10.5, padding: "3px 7px", cursor: "pointer" }}>
            {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <span title="Copiar" style={{ cursor: "pointer", color: "var(--tx-3)" }} onClick={() => { navigator.clipboard?.writeText(item.text || ""); toast("Código copiado"); }}><Icon name="copy" size={14} /></span>
        </div>
        <textarea value={item.text} placeholder="// tu código…" spellCheck={false} onChange={e => onChange({ ...item, text: e.target.value })}
          style={{ flex: 1, width: "100%", background: "none", border: "none", outline: "none", resize: "none", color: "#d8d8e0", fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.6, tabSize: 2 }} />
      </div>
    );
  }
  if (item.kind === "link") {
    const href = item.url ? (item.url.startsWith("http") ? item.url : "https://" + item.url) : null;
    let host = ""; try { host = href ? new URL(href).hostname.replace("www.", "") : ""; } catch {}
    const faviconUrl = host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : null;
    return (
      <div style={{ display: "grid", gap: 9 }}>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          {faviconUrl && <img src={faviconUrl} style={{ width: 20, height: 20, borderRadius: 4, flex: "0 0 20px" }} onError={e => { e.target.style.display = "none"; }} />}
          <input value={item.label} placeholder="Título del link" onChange={e => onChange({ ...item, label: e.target.value })}
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: item.tx, fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 14 }} />
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span style={{ color: "var(--violet-hi)" }}><Icon name="link" size={14} /></span>
          <input value={item.url} placeholder="pegá la URL…" onChange={e => onChange({ ...item, url: e.target.value })}
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--tx-3)", fontFamily: "var(--font-mono)", fontSize: 11.5 }} />
        </div>
        {href && <a href={href} target="_blank" rel="noreferrer" className="link" style={{ fontSize: 12.5 }}>Abrir {host} ↗</a>}
      </div>
    );
  }
  if (item.kind === "divider") {
    return <div style={{ height: "100%", display: "grid", placeItems: "center" }}><div style={{ width: "100%", height: 1, background: "var(--line-2)" }}></div></div>;
  }
  /* ── cuadro/frame ── */
  if (item.kind === "frame") {
    return (
      <input value={item.title || "Grupo"} placeholder="Nombre del grupo"
        onChange={e => onChange({ ...item, title: e.target.value })}
        style={{ background: "none", border: "none", outline: "none", color: "rgba(139,109,255,.7)", fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", width: "100%", padding: "4px 6px" }} />
    );
  }
  /* ── tabla (reutiliza TableBlock de space-table.jsx) ── */
  if (item.kind === "table") {
    const tdata = item.table || (typeof newTableData !== "undefined" ? newTableData() : { cols: [], rows: [] });
    if (typeof TableBlock === "undefined") return <div className="small" style={{ color: "var(--tx-3)", padding: 16 }}>Cargando tabla…</div>;
    return <TableBlock b={tdata} onPatch={p => onChange({ ...item, table: { ...(item.table || tdata), ...p } })} />;
  }
  /* ── list (default) ── */
  const items = item.items || [];
  const setItems = (next) => onChange({ ...item, items: next });
  const [draft, setDraft] = React.useState("");
  return (
    <div>
      {items.length === 0 && <div className="small" style={{ color: "var(--tx-3)", padding: "8px 0" }}>Sin ítems todavía.</div>}
      {items.map((it, idx) => (
        <div className="check-row" key={idx} style={{ padding: "8px 0" }}>
          <div className={`cbox${it.done ? " on" : ""}`} onClick={() => setItems(items.map((x, j) => j === idx ? { ...x, done: !x.done } : x))}>
            {it.done && <Icon name="check" size={13} color="#fff" />}
          </div>
          <span style={{ flex: 1, fontSize: item.fs, textDecoration: it.done ? "line-through" : "none", opacity: it.done ? .55 : 1, color: item.tx }}>{it.t}</span>
          <span style={{ cursor: "pointer", color: "var(--tx-3)" }} onClick={() => setItems(items.filter((_, j) => j !== idx))}><Icon name="x" size={14} /></span>
        </div>
      ))}
      <form className="addline" onSubmit={e => { e.preventDefault(); if (draft.trim()) { setItems([...items, { t: draft.trim(), done: false }]); setDraft(""); } }}>
        <input className="input" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Agregar ítem…" style={{ padding: "9px 12px", fontSize: 13 }} />
      </form>
    </div>
  );
}

/* ── color pop del widget ─────────────────────────────────── */
function ColorPop({ item, onChange, onClose }) {
  return (
    <div className="pop" style={{ width: 250, position: "static", padding: 16 }} onClick={e => e.stopPropagation()}>
      <div className="row between" style={{ marginBottom: 12 }}><div className="mono">Estilo</div><span style={{ cursor: "pointer", color: "var(--tx-3)" }} onClick={onClose}><Icon name="x" size={15} /></span></div>
      <div className="mono" style={{ fontSize: 10, marginBottom: 8 }}>Fondo</div>
      <div className="swatches" style={{ marginBottom: 14 }}>
        {WIDGET_BGS.map(c => <div key={c} className={`swatch${item.bg === c ? " sel" : ""}`} style={{ background: c }} onClick={() => onChange({ ...item, bg: c })} />)}
      </div>
      <div className="mono" style={{ fontSize: 10, marginBottom: 8 }}>Borde</div>
      <div className="swatches" style={{ marginBottom: 14 }}>
        {["rgba(255,255,255,.11)", ...COLORS.map(c => c + "88")].map(c => <div key={c} className={`swatch${item.border === c ? " sel" : ""}`} style={{ background: c }} onClick={() => onChange({ ...item, border: c })} />)}
      </div>
      <div className="row between"><div className="mono" style={{ fontSize: 10 }}>Tamaño texto</div><input type="range" min="12" max="30" value={item.fs} onChange={e => onChange({ ...item, fs: +e.target.value })} /></div>
    </div>
  );
}

/* ── panel para agregar widgets (portaleado — funciona en fullscreen) ── */
const BOARD_WIDGETS = [
  ["note",    "Nota",        "pen"     ],
  ["list",    "Lista",       "check"   ],
  ["postit",  "Post-it",     "note"    ],
  ["heading", "Encabezado",  "type"    ],
  ["callout", "Aviso",       "idea"    ],
  ["code",    "Código",      "fileText"],
  ["link",    "Link",        "link"    ],
  ["image",   "Imagen",      "image"   ],
  ["table",   "Tabla",       "layers"  ],
  ["frame",   "Cuadro",      "box"     ],
  ["divider", "Divisor",     "minus"   ],
];

function BoardAddPanel({ onAdd, quickSections, onAddSection, onClose }) {
  return ReactDOM.createPortal(
    <>
      {/* backdrop — click cierra el panel */}
      <div style={{ position: "fixed", inset: 0, zIndex: 409 }} onPointerDown={onClose} />
      <div className="drawer" style={{ position: "fixed", right: 16, top: "50%", transform: "translateY(-50%)", zIndex: 410, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div className="drawer-head" style={{ cursor: "default" }}>
          <Icon name="plus" size={15} color="var(--violet-hi)" />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Agregar al pizarrón</span>
          <span style={{ marginLeft: "auto", cursor: "pointer", color: "var(--tx-3)" }} onPointerDown={e => { e.stopPropagation(); onClose(); }}><Icon name="x" size={16} /></span>
        </div>
        <div className="drawer-body" style={{ overflowY: "auto" }}>
          <div className="mono" style={{ marginBottom: 10 }}>Widgets</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 18 }}>
            {BOARD_WIDGETS.map(([k, label, icon]) => (
              <button key={k} className="addmini" onPointerDown={e => { e.stopPropagation(); onAdd(k); onClose(); }}>
                <Icon name={icon} size={15} /> {label}
              </button>
            ))}
          </div>
          {quickSections && quickSections.length > 0 && (
            <>
              <div className="mono" style={{ marginBottom: 10 }}>Secciones rápidas</div>
              <div style={{ display: "grid", gap: 8 }}>
                {quickSections.map(sec => (
                  <button key={sec.k} className="addbtn" onPointerDown={e => { e.stopPropagation(); onAddSection(sec); onClose(); }}>
                    <Icon name="plus" size={15} /> {sec.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

/* ── canvas principal ─────────────────────────────────────── */
function CanvaBoard({ items, onChange, editing, showDots, minHeight = 680, onAddItem, quickSections, onAddSection, boardTitle }) {
  const wrapRef = React.useRef(null);
  const [colorFor,    setColorFor]    = React.useState(null);
  const [zoom,        setZoom]        = React.useState(1);
  const [pan,         setPan]         = React.useState({ x: 0, y: 0 });
  const [panning,     setPanning]     = React.useState(false);
  const [expand,      setExpand]      = React.useState(false);
  const [drawerOpen,  setDrawerOpen]  = React.useState(false);
  const drag = React.useRef(null);

  const clamp    = (v, a, b) => Math.max(a, Math.min(b, v));
  const getUiZoom = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-zoom")) || 1;

  const update       = (id, patch) => onChange(items.map(it => it.id === id ? { ...it, ...patch } : it));
  const remove       = (id)        => onChange(items.filter(it => it.id !== id));
  const bringToFront = (id)        => { const it = items.find(i => i.id === id); if (it) onChange([...items.filter(i => i.id !== id), it]); };

  /* Agregar ítem — los frames van al frente del array (se renderizan detrás de todo) */
  const handleAddItem = (kind) => {
    if (!onAddItem) return;
    onAddItem(kind);
    if (kind === "frame") return; /* SubjectView maneja el prepend */
  };

  /* ESC sale de fullscreen */
  React.useEffect(() => {
    if (!expand) return;
    const k = (e) => { if (e.key === "Escape") setExpand(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [expand]);

  /* ── MOVER / REDIMENSIONAR (pointer events → touch + mouse) ── */
  const onDown = (e, item, mode) => {
    if (!editing) return;
    e.preventDefault(); e.stopPropagation();
    const f = getUiZoom() * zoom;
    drag.current = { id: item.id, mode, sx: e.clientX, sy: e.clientY, ox: item.x, oy: item.y, ow: item.w, oh: item.h };
    const move = (ev) => {
      const d = drag.current; if (!d) return;
      const dx = (ev.clientX - d.sx) / f, dy = (ev.clientY - d.sy) / f;
      if (d.mode === "move") update(d.id, { x: d.ox + dx, y: d.oy + dy });
      else update(d.id, { w: Math.max(170, d.ow + dx), h: Math.max(80, d.oh + dy) });
    };
    const up = () => { drag.current = null; document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  /* ── PAN del canvas (pointer events) ── */
  const onCanvasDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest(".board-item") || e.target.closest(".postit") || e.target.closest(".board-tools") || e.target.closest(".board-fs-bar")) return;
    e.preventDefault();
    const f = getUiZoom();
    const sx = e.clientX, sy = e.clientY, ox = pan.x, oy = pan.y;
    setPanning(true);
    const move = (ev) => setPan({ x: ox + (ev.clientX - sx) / f, y: oy + (ev.clientY - sy) / f });
    const up   = () => { setPanning(false); document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  /* ctrl + rueda = zoom alrededor del cursor */
  const onWheel = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const rect = wrapRef.current.getBoundingClientRect();
    const f    = getUiZoom();
    const cx   = (e.clientX - rect.left) / f, cy = (e.clientY - rect.top) / f;
    setZoom(z => {
      const nz = clamp(z * (1 - e.deltaY * 0.0014), 0.3, 2.6);
      setPan(p => ({ x: cx - (cx - p.x) * (nz / z), y: cy - (cy - p.y) * (nz / z) }));
      return nz;
    });
  };

  const zoomBy    = (factor) => { const f = getUiZoom(); const rect = wrapRef.current.getBoundingClientRect(); const cx = (rect.width / f) / 2, cy = (rect.height / f) / 2; setZoom(z => { const nz = clamp(z * factor, 0.3, 2.6); setPan(p => ({ x: cx - (cx - p.x) * (nz / z), y: cy - (cy - p.y) * (nz / z) })); return nz; }); };
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const wrapStyle = expand
    ? { position: "fixed", inset: 0, zIndex: 300, height: "100vh", width: "100vw", borderRadius: 0 }
    : { height: minHeight };

  const boardEl = (
    <div className="board-wrap" ref={wrapRef} style={wrapStyle} onWheel={onWheel} onPointerDown={onCanvasDown}>

      {/* barra superior en fullscreen */}
      {expand && (
        <div className="board-fs-bar">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--tx-1)" }}>
            {boardTitle || "Pizarrón"}
          </span>
          <div style={{ flex: 1 }} />
          <span className="mono" style={{ fontSize: 10.5, color: "var(--tx-3)" }}>ESC para salir</span>
          <button className="bt-btn" onClick={() => setExpand(false)} style={{ marginLeft: 8 }}>
            <Icon name="minimize" size={16} />
          </button>
        </div>
      )}

      <div className="board-viewport" style={{ position: "absolute", top: expand ? 48 : 0, left: 0, right: 0, bottom: 0, overflow: "hidden", cursor: panning ? "grabbing" : "grab" }}>
        <div className="board-pan" style={{ position: "absolute", inset: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
          {showDots && <div className="board-dots" style={{ position: "absolute", left: -3000, top: -3000, width: 9000, height: 9000 }} />}
          <div className="board-canvas" style={{ minHeight, position: "relative" }}>
            {items.map(item => {
              /* ── POST-IT ── */
              if (item.kind === "postit") {
                return (
                  <div key={item.id} className={`postit${editing ? " editing" : ""}`}
                    style={{ left: item.x, top: item.y, width: item.w, height: item.h, background: item.bg }}
                    onPointerDown={editing ? (e => { bringToFront(item.id); if (e.target.tagName !== "TEXTAREA") onDown(e, item, "move"); }) : undefined}>
                    {editing && (
                      <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 4, zIndex: 4 }}>
                        {POSTIT_COLORS.slice(0, 4).map(c => <span key={c} onPointerDown={e => { e.stopPropagation(); update(item.id, { bg: c }); }} style={{ width: 13, height: 13, borderRadius: "50%", background: c, cursor: "pointer", border: "1px solid rgba(0,0,0,.2)" }} />)}
                        <span onPointerDown={e => { e.stopPropagation(); remove(item.id); }} style={{ cursor: "pointer", color: "rgba(0,0,0,.5)" }}><Icon name="x" size={13} /></span>
                      </div>
                    )}
                    <textarea value={item.text} placeholder="Escribí algo…" onChange={e => update(item.id, { text: e.target.value })} />
                    {editing && <div className="resize" onPointerDown={e => { e.stopPropagation(); onDown(e, item, "resize"); }} />}
                  </div>
                );
              }
              /* ── CUADRO / FRAME ── */
              if (item.kind === "frame") {
                return (
                  <div key={item.id} className={`board-item${editing ? " editing" : ""}`}
                    style={{ left: item.x, top: item.y, width: item.w, height: item.h, background: item.bg, borderColor: item.border, borderStyle: "dashed", borderRadius: 16, zIndex: 0 }}
                    onPointerDown={() => editing && bringToFront(item.id)}>
                    {editing && (
                      <div className="ed-bar" onPointerDown={e => { if (!e.target.closest(".no-drag")) onDown(e, item, "move"); }}>
                        <span className="handle"><Icon name="dots" size={14} /></span>
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title || "Cuadro"}</span>
                        <span className="no-drag" style={{ cursor: "pointer" }} onPointerDown={() => remove(item.id)}><Icon name="x" size={14} /></span>
                      </div>
                    )}
                    <div className="board-body" style={{ height: editing ? "calc(100% - 33px)" : "100%", color: item.tx }}>
                      <BoardItemBody item={item} onChange={p => update(item.id, p)} />
                    </div>
                    {editing && <div className="resize" onPointerDown={e => { e.stopPropagation(); onDown(e, item, "resize"); }} />}
                  </div>
                );
              }
              /* ── RESTO DE WIDGETS ── */
              return (
                <div key={item.id} className={`board-item${editing ? " editing" : ""}`}
                  style={{ left: item.x, top: item.y, width: item.w, height: item.h, background: item.bg, borderColor: item.border }}
                  onPointerDown={() => editing && bringToFront(item.id)}>
                  {editing && (
                    <div className="ed-bar" onPointerDown={e => { if (!e.target.closest(".no-drag")) onDown(e, item, "move"); }}>
                      <span className="handle"><Icon name="dots" size={14} /></span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title || item.kind}</span>
                      <span className="no-drag" style={{ cursor: "pointer" }} onPointerDown={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setColorFor(colorFor && colorFor.id === item.id ? null : { id: item.id, x: r.right, y: r.bottom }); }}>
                        <Icon name="palette" size={14} />
                      </span>
                      <span className="no-drag" style={{ cursor: "pointer" }} onPointerDown={() => remove(item.id)}><Icon name="x" size={14} /></span>
                    </div>
                  )}
                  <div className="board-body" style={{ height: editing ? "calc(100% - 33px)" : "100%", color: item.tx }}>
                    {!editing && item.title && item.kind !== "image" && item.kind !== "frame" && <div className="h3" style={{ fontSize: 15, marginBottom: 12, color: item.tx }}>{item.title}</div>}
                    <BoardItemBody item={item} onChange={p => update(item.id, p)} />
                  </div>
                  {editing && <div className="resize" onPointerDown={e => { e.stopPropagation(); onDown(e, item, "resize"); }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* estado vacío */}
      {items.length === 0 && (
        <div className="empty" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div>
            <Icon name="grid" size={34} />
            <div className="h3" style={{ marginTop: 14 }}>Pizarrón vacío</div>
            <div className="small" style={{ marginTop: 6 }}>Activá <b className="tx-1">Personalizar</b> y usá el botón <b className="tx-1">+ Agregar</b> para poner widgets donde quieras.</div>
          </div>
        </div>
      )}

      {/* barra inferior: zoom + agregar + fullscreen */}
      <div className="board-tools" onPointerDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
        <span className="bt-hint">⌘/Ctrl + rueda para zoom · arrastrá el fondo para mover</span>
        {editing && (
          <button className="bt-btn" title="Agregar widget" onClick={() => setDrawerOpen(d => !d)}
            style={{ background: drawerOpen ? "var(--violet-soft)" : "", color: drawerOpen ? "var(--violet-hi)" : "", gap: 6, paddingRight: 10 }}>
            <Icon name="plus" size={16} />
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-body)" }}>Agregar</span>
          </button>
        )}
        <div className="bt-group">
          <button className="bt-btn" title="Alejar"       onClick={() => zoomBy(1 / 1.2)}><Icon name="zoomOut" size={16} /></button>
          <button className="bt-zoom" title="Restablecer" onClick={resetView}>{Math.round(zoom * 100)}%</button>
          <button className="bt-btn" title="Acercar"      onClick={() => zoomBy(1.2)}><Icon name="zoomIn"  size={16} /></button>
        </div>
        <button className="bt-btn" title={expand ? "Salir de pantalla completa" : "Pantalla completa"} onClick={() => setExpand(e => !e)}>
          <Icon name={expand ? "minimize" : "maximize"} size={16} />
        </button>
      </div>

      {/* color pop */}
      {colorFor && (() => {
        const it = items.find(i => i.id === colorFor.id);
        if (!it) return null;
        const left = Math.max(8, Math.min(colorFor.x - 250, window.innerWidth - 262));
        const top  = Math.max(8, Math.min(colorFor.y + 6, window.innerHeight - 290));
        return ReactDOM.createPortal(
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 399 }} onPointerDown={() => setColorFor(null)} />
            <div style={{ position: "fixed", left, top, zIndex: 400 }} onPointerDown={e => e.stopPropagation()}>
              <ColorPop item={it} onChange={p => update(it.id, p)} onClose={() => setColorFor(null)} />
            </div>
          </>, document.body);
      })()}

      {/* panel agregar widgets (portaleado — funciona en fullscreen) */}
      {editing && drawerOpen && (
        <BoardAddPanel
          onAdd={kind => { if (onAddItem) onAddItem(kind); }}
          quickSections={quickSections}
          onAddSection={onAddSection}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );

  return expand ? ReactDOM.createPortal(boardEl, document.body) : boardEl;
}

Object.assign(window, { CanvaBoard, defaultBoardItem, POSTIT_COLORS });
