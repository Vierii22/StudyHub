import React from 'react';

import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, ALL_WIDGETS, getAllTasks, getPomoWeekMins } from './store.jsx';
import { Btn, Chip, MonoLabel, Modal, Field } from './ui.jsx';
import { WIDGET_COMP, greetingTime } from './dashboard.jsx';
import { CoachCard, CaptureBar, TodayTimeline } from './coach.jsx';

/* ============================================================
   DASHBOARD SHELL — grilla 12 col, modo edición, 3 variantes
   ============================================================ */
const HubbyBanner = ({ data, onConnect }) => {
  const [closed, setClosed] = React.useState(false);
  if (data.profile.hubby || closed) return null;
  return (
    <div className="card hoverable" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 14, padding: "13px 16px" }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--violet-soft)", border: "1px solid var(--violet-line)", display: "grid", placeItems: "center", flex: "0 0 auto", fontSize: 18 }}>🤖</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Conectá a Hubby</div>
        <div className="small" style={{ fontSize: 12.5 }}>Guardá tareas, gastos y notas desde Telegram.</div>
      </div>
      <button className="btn btn-secondary btn-sm" onClick={onConnect}>Conectar</button>
      <div style={{ cursor: "pointer", color: "var(--tx-3)", display: "flex" }} onClick={() => setClosed(true)}><Icon name="x" size={16} /></div>
    </div>
  );
};

const SPANS = { xp:3, tareas:8, agenda:4, materias:7, racha:3, horas:5, completas:3, ring:3, semana:7, reloj:3, nota:4, proximo:3, habitos:3, frase:6 };
const SPAN_OPTS = [["¼", 3], ["⅓", 4], ["½", 6], ["⅔", 8], ["1", 12]];

const EditDrawer = ({ active, onAdd, onRemove, onClose, onReset }) => {
  const pos = React.useRef({ x: window.innerWidth - 340, y: 120 });
  const [, force] = React.useReducer(x => x + 1, 0);
  const dragStart = (e) => {
    const sx = e.clientX, sy = e.clientY, ox = pos.current.x, oy = pos.current.y;
    const mv = ev => { pos.current = { x: ox + ev.clientX - sx, y: oy + ev.clientY - sy }; force(); };
    const up = () => { document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up);
  };
  const available = Object.keys(ALL_WIDGETS).filter(k => !active.includes(k));
  return (
    <div className="drawer" style={{ left: pos.current.x, top: pos.current.y }}>
      <div className="drawer-head" onMouseDown={dragStart}>
        <Icon name="dots" size={15} color="var(--tx-3)" />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Editar dashboard</span>
        <span style={{ marginLeft: "auto", cursor: "pointer", color: "var(--tx-3)" }} onClick={onClose}><Icon name="x" size={16} /></span>
      </div>
      <div className="drawer-body">
        <div className="mono" style={{ marginBottom: 10 }}>Disponibles</div>
        <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
          {available.length === 0 && <div className="small" style={{ color: "var(--tx-3)" }}>Todos los widgets están activos.</div>}
          {available.map(k => <button key={k} className="addbtn" onClick={() => onAdd(k)}><Icon name="plus" size={15} />{ALL_WIDGETS[k].label}</button>)}
        </div>
        <div className="mono" style={{ marginBottom: 10 }}>Activas · {active.length}</div>
        <div style={{ display: "grid", gap: 8 }}>
          {active.map(k => (
            <div key={k} className="row between" style={{ padding: "10px 13px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
              <span className="row" style={{ gap: 9, fontSize: 13.5 }}><Icon name="dots" size={14} color="var(--tx-3)" />{ALL_WIDGETS[k].label}</span>
              <span style={{ cursor: "pointer", color: "var(--tx-3)" }} onClick={() => onRemove(k)}><Icon name="x" size={15} /></span>
            </div>
          ))}
        </div>
        <button className="addbtn" style={{ marginTop: 16, justifyContent: "center", color: "#e8639b" }} onClick={onReset}><Icon name="refresh" size={15} color="#e8639b" /> Restaurar por defecto</button>
      </div>
    </div>
  );
};

const Dashboard = ({ variant, onNav, onConnect }) => {
  const [data, set] = useStore();
  const [edit, setEdit] = React.useState(false);
  const widgets = data.dashWidgets;

  const renderWidget = (k) => {
    const C = WIDGET_COMP[k];
    if (!C) return null;

    const config = data.widgetConfig?.dashboard?.[k] || {};
    const accentColor = config.colorOn ? config.color : null;

    return (
      <div style={{
        height: "100%",
        borderColor: accentColor ? accentColor : undefined,
        borderWidth: accentColor ? "1.5px" : undefined,
        borderStyle: accentColor ? "solid" : undefined,
        borderRadius: "var(--r-lg)",
        background: config.photoOn && config.photos?.length
          ? `linear-gradient(135deg, rgba(0,0,0,.5) 0%, rgba(0,0,0,.3) 100%), url(${config.photos[0]})`
          : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        overflow: "hidden",
      }}>
        <C data={data} set={set} onOpen={onNav} />
      </div>
    );
  };

  // variante foco: solo los 4 esenciales
  const shown = variant === "focus" ? widgets.filter(k => ["xp","tareas","agenda","ring"].includes(k)).slice(0, 4) : widgets;

  const gridFor = (k) => {
    if (variant === "grid") return "span 4";
    if (variant === "focus") return k === "tareas" ? "span 7" : k === "xp" ? "span 5" : "span 6";
    return `span ${(data.dashSpans && data.dashSpans[k]) || SPANS[k] || 6}`;
  };
  const dragK = React.useRef(null);
  const reorder = (k) => { if (dragK.current && dragK.current !== k) set(s => { const a = s.dashWidgets; const from = a.indexOf(dragK.current), to = a.indexOf(k); if (from < 0 || to < 0) return; a.splice(to, 0, a.splice(from, 1)[0]); }); };
  const setSpan = (k, v) => set(s => { s.dashSpans = { ...(s.dashSpans || {}), [k]: v }; });

  const p = data.profile;

  /* ── datos del hero ── */
  const now = new Date();
  const gt = greetingTime();
  const saludo = gt === "mañana" ? "Buen día" : gt === "tarde" ? "Buenas tardes" : "Buenas noches";
  const fecha = now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  /* progreso del día académico: 7:00 → 24:00 */
  const dayPct = Math.min(100, Math.max(0, ((now.getHours() * 60 + now.getMinutes()) - 420) / 1020 * 100));
  const all = getAllTasks(data);
  const activas = all.filter(t => !t.done).length;
  const hechasHoy = all.filter(t => t.done).length;
  const weekHrs = Math.round(getPomoWeekMins() / 6) / 10;

  return (
    <div className="page page-cozy">
      <HubbyBanner data={data} onConnect={onConnect} />

      {/* ── HERO editorial ── */}
      <div className="hoy-hero">
        <div className="hoy-fecha">{fecha}</div>
        <div className="row between" style={{ alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <h1 className="hoy-saludo">{saludo}, <em>{p.name}</em></h1>
          <div className="wrap-gap">
            {edit
              ? <><Btn variant="secondary" icon="refresh" onClick={() => { set(s => { s.dashWidgets = JSON.parse(JSON.stringify(["tareas","agenda","xp","racha","completas","ring","materias","horas"])); s.dashSpans = {}; }); toast("Dashboard restaurado"); }}>Restaurar</Btn>
                  <Btn variant="primary" icon="check" onClick={() => { setEdit(false); toast("Cambios guardados"); }}>Listo</Btn></>
              : <Btn variant="secondary" icon="edit" onClick={() => setEdit(true)}>Editar</Btn>}
          </div>
        </div>
        <div className="hoy-sub">{activas} tareas activas · racha de {data.streak || 0} días</div>
        <div className="hoy-dayline" title={`${Math.round(dayPct)}% del día`}><div style={{ width: `${dayPct}%` }}></div></div>
      </div>

      {/* ── CAPTURA UNIVERSAL ── */}
      <div style={{ margin: "18px 0" }}>
        <CaptureBar data={data} set={set} onOpen={onNav} />
      </div>

      {/* ── COACH + HOY ── */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(12,1fr)", marginBottom: 16 }}>
        <div style={{ gridColumn: "span 7" }} className="dash-col-coach"><CoachCard data={data} onNav={onNav} /></div>
        <div style={{ gridColumn: "span 5" }} className="dash-col-hoy"><TodayTimeline data={data} set={set} onNav={onNav} /></div>
      </div>

      {/* ── STATS STRIP ── */}
      <div className="stat-strip" style={{ marginBottom: 22 }}>
        {[
          [data.streak || 0, "racha · días"],
          [`nv ${data.level || 1}`, `${data.xp || 0} xp`],
          [weekHrs, "hs foco · semana"],
          [hechasHoy, "tareas hechas"],
        ].map(([v, l], i) => (
          <div key={i} className="stat-mini"><div className="v">{v}</div><div className="l">{l}</div></div>
        ))}
      </div>

      {edit && <div className="mono" style={{ marginBottom: 12, color: "var(--violet-hi)", display: "flex", alignItems: "center", gap: 7 }}><Icon name="move" size={13} /> Arrastrá los widgets para reordenar · usá los tamaños de cada uno · agregá desde el panel</div>}
      <div className="grid" style={{ gridTemplateColumns: "repeat(12,1fr)", alignItems: "stretch" }}>
        {shown.map(k => (
          <div key={k}
            draggable={edit}
            onDragStart={() => { dragK.current = k; }}
            onDragOver={e => { if (edit) { e.preventDefault(); reorder(k); } }}
            onDragEnd={() => { dragK.current = null; }}
            style={{ gridColumn: gridFor(k), position: "relative", outline: edit ? "1.5px dashed var(--violet-line)" : "none", outlineOffset: 4, borderRadius: "var(--r-lg)", cursor: edit ? "grab" : "default" }}>
            {renderWidget(k)}
            {edit && <>
              <div onClick={() => set(s => s.dashWidgets = s.dashWidgets.filter(x => x !== k))} style={{ position: "absolute", top: -10, right: -10, width: 26, height: 26, borderRadius: "50%", background: "#e8639b", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", zIndex: 6 }}><Icon name="x" size={14} /></div>
              <div className="dash-resize" onMouseDown={e => e.stopPropagation()}>
                {SPAN_OPTS.map(([lbl, v]) => { const cur = (data.dashSpans && data.dashSpans[k]) || SPANS[k] || 6; return <button key={v} className={cur === v ? "on" : ""} onClick={() => setSpan(k, v)} title={`Ancho ${lbl}`}>{lbl}</button>; })}
              </div>
            </>}
          </div>
        ))}
      </div>

      {edit && <EditDrawer active={widgets}
        onAdd={k => set(s => s.dashWidgets.push(k))}
        onRemove={k => set(s => s.dashWidgets = s.dashWidgets.filter(x => x !== k))}
        onClose={() => setEdit(false)}
        onReset={() => { set(s => { s.dashWidgets = JSON.parse(JSON.stringify(["tareas","agenda","xp","racha","completas","ring","materias","horas"])); s.dashSpans = {}; }); toast("Dashboard restaurado"); }} />}
    </div>
  );
};

export { Dashboard, HubbyBanner };