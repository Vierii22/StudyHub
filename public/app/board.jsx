/* ============================================================
   BOARD — pizarrón estilo Canva
   Widgets de posición y tamaño libres, grid de puntos opcional.
   Ítems: list | note | postit | image
   ============================================================ */

const POSTIT_COLORS = ["#ffe08a","#ffd1dc","#c8f0d0","#bfe3ff","#e3d1ff","#ffd9b3"];
const WIDGET_BGS = ["#141419","#1b1b22","#201a2e","#1a2420","#241a22","#1a2128"];
const CALLOUT_PRESETS = [
  { emoji: "💡", accent: "#e8b04e" }, { emoji: "⚠️", accent: "#f0764e" },
  { emoji: "✅", accent: "#3ecf9a" }, { emoji: "📌", accent: "#8b6dff" },
  { emoji: "ℹ️", accent: "#4ec5e8" }, { emoji: "🚨", accent: "#e8639b" },
];

function defaultBoardItem(kind, i = 0) {
  const base = { id: uid(), kind, x: 60 + i * 28, y: 60 + i * 28, w: 320, h: 240, bg: "#141419", border: "rgba(255,255,255,.11)", tx: "#f3f3f7", fs: 14 };
  if (kind === "list") return { ...base, title: "Nueva lista", items: [] };
  if (kind === "note") return { ...base, title: "Nota", text: "" };
  if (kind === "postit") return { ...base, kind: "postit", w: 200, h: 190, bg: "#ffe08a", text: "" };
  if (kind === "image") return { ...base, title: "Imagen", src: null };
  if (kind === "heading") return { ...base, kind: "heading", h: 96, w: 360, text: "Título", fs: 28 };
  if (kind === "callout") return { ...base, kind: "callout", w: 300, h: 140, bg: "#1b1b22", emoji: "💡", accent: "#e8b04e", text: "" };
  if (kind === "code") return { ...base, kind: "code", bg: "#0f0f15", lang: "js", text: "" };
  if (kind === "link") return { ...base, kind: "link", w: 290, h: 120, url: "", label: "" };
  if (kind === "divider") return { ...base, kind: "divider", h: 56, w: 380, bg: "transparent", border: "transparent" };
  return base;
}

/* contenido interno de cada widget del board */
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
    return (
      <div style={{ display: "grid", gap: 8 }}>
        <input value={item.label} placeholder="Título del link" onChange={e => onChange({ ...item, label: e.target.value })}
          style={{ background: "none", border: "none", outline: "none", color: item.tx, fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 14 }} />
        <div className="row" style={{ gap: 8 }}>
          <span style={{ color: "var(--violet-hi)" }}><Icon name="link" size={14} /></span>
          <input value={item.url} placeholder="pegá la URL…" onChange={e => onChange({ ...item, url: e.target.value })}
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--tx-3)", fontFamily: "var(--font-mono)", fontSize: 11.5 }} />
        </div>
        {href && <a href={href} target="_blank" rel="noreferrer" className="link" style={{ fontSize: 12.5, marginTop: 2 }}>Abrir {host} ↗</a>}
      </div>
    );
  }
  if (item.kind === "divider") {
    return <div style={{ height: "100%", display: "grid", placeItems: "center" }}><div style={{ width: "100%", height: 1, background: "var(--line-2)" }}></div></div>;
  }
  // list
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

/* popover de color de un widget (se posiciona vía portal) */
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
      <div className="row between"><div className="mono" style={{ fontSize: 10 }}>Texto</div><input type="range" min="12" max="30" value={item.fs} onChange={e => onChange({ ...item, fs: +e.target.value })} /></div>
    </div>
  );
}

function CanvaBoard({ items, onChange, editing, showDots, minHeight = 680 }) {
  const wrapRef = React.useRef(null);
  const [colorFor, setColorFor] = React.useState(null);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [panning, setPanning] = React.useState(false);
  const [expand, setExpand] = React.useState(false);
  const drag = React.useRef(null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const getUiZoom = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-zoom")) || 1;

  const update = (id, patch) => onChange(items.map(it => it.id === id ? { ...it, ...patch } : it));
  const remove = (id) => onChange(items.filter(it => it.id !== id));

  // ESC sale de expandido
  React.useEffect(() => {
    if (!expand) return;
    const k = (e) => { if (e.key === "Escape") setExpand(false); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [expand]);

  // mover / redimensionar ítems
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
    const up = () => { drag.current = null; document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
  };

  // pan con mouse sobre el fondo
  const onCanvasDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".board-item") || e.target.closest(".postit") || e.target.closest(".board-tools")) return;
    e.preventDefault();
    const f = getUiZoom();
    const sx = e.clientX, sy = e.clientY, ox = pan.x, oy = pan.y;
    setPanning(true);
    const move = (ev) => setPan({ x: ox + (ev.clientX - sx) / f, y: oy + (ev.clientY - sy) / f });
    const up = () => { setPanning(false); document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
  };

  // ctrl + rueda = zoom alrededor del cursor
  const onWheel = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const rect = wrapRef.current.getBoundingClientRect();
    const f = getUiZoom();
    const cx = (e.clientX - rect.left) / f, cy = (e.clientY - rect.top) / f;
    setZoom(z => {
      const nz = clamp(z * (1 - e.deltaY * 0.0014), 0.3, 2.6);
      setPan(p => ({ x: cx - (cx - p.x) * (nz / z), y: cy - (cy - p.y) * (nz / z) }));
      return nz;
    });
  };

  const zoomBy = (factor) => {
    const f = getUiZoom();
    const rect = wrapRef.current.getBoundingClientRect();
    const cx = (rect.width / f) / 2, cy = (rect.height / f) / 2;
    setZoom(z => { const nz = clamp(z * factor, 0.3, 2.6); setPan(p => ({ x: cx - (cx - p.x) * (nz / z), y: cy - (cy - p.y) * (nz / z) })); return nz; });
  };
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const wrapStyle = expand
    ? { position: "fixed", inset: 0, zIndex: 300, height: "100vh", width: "100vw", borderRadius: 0 }
    : { height: minHeight };

  const boardEl = (
    <div className="board-wrap" ref={wrapRef} style={wrapStyle} onWheel={onWheel} onMouseDown={onCanvasDown}>
      <div className="board-viewport" style={{ position: "absolute", inset: 0, overflow: "hidden", cursor: panning ? "grabbing" : "grab" }}>
        <div className="board-pan" style={{ position: "absolute", inset: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
          {showDots && <div className="board-dots" style={{ position: "absolute", left: -3000, top: -3000, width: 9000, height: 9000 }} />}
          <div className="board-canvas" style={{ minHeight, position: "relative" }}>
            {items.map(item => {
              if (item.kind === "postit") {
                return (
                  <div key={item.id} className={`postit${editing ? " editing" : ""}`}
                    style={{ left: item.x, top: item.y, width: item.w, height: item.h, background: item.bg }}
                    onMouseDown={editing ? (e => { if (e.target.tagName !== "TEXTAREA") onDown(e, item, "move"); }) : undefined}>
                    {editing && <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 4, zIndex: 4 }}>
                      {POSTIT_COLORS.slice(0, 4).map(c => <span key={c} onClick={() => update(item.id, { bg: c })} style={{ width: 13, height: 13, borderRadius: "50%", background: c, cursor: "pointer", border: "1px solid rgba(0,0,0,.2)" }} />)}
                      <span onClick={() => remove(item.id)} style={{ cursor: "pointer", color: "rgba(0,0,0,.5)" }}><Icon name="x" size={13} /></span>
                    </div>}
                    <textarea value={item.text} placeholder="Escribí algo…" onChange={e => update(item.id, { text: e.target.value })} />
                    {editing && <div className="resize" onMouseDown={e => onDown(e, item, "resize")} />}
                  </div>
                );
              }
              return (
                <div key={item.id} className={`board-item${editing ? " editing" : ""}`}
                  style={{ left: item.x, top: item.y, width: item.w, height: item.h, background: item.bg, borderColor: item.border }}>
                  {editing && (
                    <div className="ed-bar" onMouseDown={e => { if (!e.target.closest(".no-drag")) onDown(e, item, "move"); }}>
                      <span className="handle"><Icon name="dots" size={14} /></span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title || item.kind}</span>
                      <span className="no-drag" style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setColorFor(colorFor && colorFor.id === item.id ? null : { id: item.id, x: r.right, y: r.bottom }); }}>
                        <Icon name="palette" size={14} />
                      </span>
                      <span className="no-drag" style={{ cursor: "pointer" }} onClick={() => remove(item.id)}><Icon name="x" size={14} /></span>
                    </div>
                  )}
                  <div className="board-body" style={{ height: editing ? "calc(100% - 33px)" : "100%", color: item.tx }}>
                    {!editing && item.title && item.kind !== "image" && <div className="h3" style={{ fontSize: 15, marginBottom: 12, color: item.tx }}>{item.title}</div>}
                    <BoardItemBody item={item} onChange={p => update(item.id, p)} />
                  </div>
                  {editing && <div className="resize" onMouseDown={e => onDown(e, item, "resize")} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* estado vacío (fijo, sin transformar) */}
      {items.length === 0 && (
        <div className="empty" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div>
            <Icon name="grid" size={34} />
            <div className="h3" style={{ marginTop: 14 }}>Pizarrón vacío</div>
            <div className="small" style={{ marginTop: 6 }}>Activá <b className="tx-1">Personalizar</b> y agregá widgets, post-its o imágenes donde quieras.</div>
          </div>
        </div>
      )}

      {/* barra de herramientas: zoom + pantalla completa */}
      <div className="board-tools" onMouseDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
        <span className="bt-hint">⌘/Ctrl + rueda para zoom · arrastrá el fondo para mover</span>
        <div className="bt-group">
          <button className="bt-btn" title="Alejar" onClick={() => zoomBy(1 / 1.2)}><Icon name="zoomOut" size={16} /></button>
          <button className="bt-zoom" title="Restablecer vista" onClick={resetView}>{Math.round(zoom * 100)}%</button>
          <button className="bt-btn" title="Acercar" onClick={() => zoomBy(1.2)}><Icon name="zoomIn" size={16} /></button>
        </div>
        <button className="bt-btn" title={expand ? "Salir de pantalla completa" : "Pantalla completa"} onClick={() => setExpand(e => !e)}><Icon name={expand ? "minimize" : "maximize"} size={16} /></button>
      </div>

      {colorFor && (() => {
        const it = items.find(i => i.id === colorFor.id);
        if (!it) return null;
        const left = Math.max(8, Math.min(colorFor.x - 250, window.innerWidth - 262));
        const top = Math.max(8, Math.min(colorFor.y + 6, window.innerHeight - 290));
        return ReactDOM.createPortal(
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 399 }} onMouseDown={() => setColorFor(null)} />
            <div style={{ position: "fixed", left, top, zIndex: 400 }} onMouseDown={e => e.stopPropagation()}>
              <ColorPop item={it} onChange={p => update(it.id, p)} onClose={() => setColorFor(null)} />
            </div>
          </>, document.body);
      })()}
    </div>
  );
  return expand ? ReactDOM.createPortal(boardEl, document.body) : boardEl;
}

Object.assign(window, { CanvaBoard, defaultBoardItem, POSTIT_COLORS });
