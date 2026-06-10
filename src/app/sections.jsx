import React from 'react';

import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, COLORS, PRIO } from './store.jsx';
import { Btn, Chip, Modal, Field, PageHead, Empty, MonoLabel, TerminalCorners } from './ui.jsx';
import { cleanupPastEvents, syncEventToTask } from './syncEngine.js';

/* ============================================================
   MISIONES + CALENDARIO (con .ics import/export)
   ============================================================ */

/* ── MISIONES ───────────────────────────────────────────── */
const MissionModal = ({ mission, onClose }) => {
  const [, set] = useStore();
  const [f, setF] = React.useState(mission || { t: "", desc: "", prio: "media", xp: 1000, subtasks: [] });
  const [sub, setSub] = React.useState("");
  const up = (k, v) => setF(x => ({ ...x, [k]: v }));
  const save = () => {
    if (!f.t.trim()) return toast("Poné un título");
    set(s => {
      if (mission) Object.assign(s.missions.find(m => m.id === mission.id), f);
      else s.missions.push({ id: uid(), expanded: true, ...f });
    });
    toast(mission ? "Misión actualizada" : "Misión creada");
    onClose();
  };
  return (
    <Modal title={mission ? "Editar misión" : "Nueva misión"} icon="target" onClose={onClose}
      footer={<><span className="link" style={{ color: "var(--tx-3)" }} onClick={onClose}>Cancelar</span><Btn variant="primary" onClick={save}>Guardar misión</Btn></>}>
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="Título *"><input className="input" value={f.t} onChange={e => up("t", e.target.value)} autoFocus /></Field>
        <Field label="Descripción"><input className="input" value={f.desc} onChange={e => up("desc", e.target.value)} /></Field>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Prioridad"><select className="sel-input" style={{ width: "100%" }} value={f.prio} onChange={e => up("prio", e.target.value)}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></Field>
          <Field label="XP"><input className="input" type="number" value={f.xp} onChange={e => up("xp", +e.target.value)} /></Field>
        </div>
        <Field label="Subtareas">
          <div style={{ display: "grid", gap: 8 }}>
            {f.subtasks.map((st, i) => (
              <div className="row" key={i} style={{ gap: 8 }}>
                <div className={`cbox${st.done ? " on" : ""}`} onClick={() => up("subtasks", f.subtasks.map((x, j) => j === i ? { ...x, done: !x.done } : x))}>{st.done && <Icon name="check" size={13} color="#fff" />}</div>
                <input className="input" value={st.t} onChange={e => up("subtasks", f.subtasks.map((x, j) => j === i ? { ...x, t: e.target.value } : x))} />
                <div className="icon-btn" onClick={() => up("subtasks", f.subtasks.filter((_, j) => j !== i))}><Icon name="x" size={14} /></div>
              </div>
            ))}
            <form className="row" style={{ gap: 8 }} onSubmit={e => { e.preventDefault(); if (sub.trim()) { up("subtasks", [...f.subtasks, { t: sub.trim(), done: false }]); setSub(""); } }}>
              <input className="input" value={sub} onChange={e => setSub(e.target.value)} placeholder="Agregar subtarea…" />
              <Btn variant="secondary" icon="plus" style={{ flex: "0 0 auto" }}></Btn>
            </form>
          </div>
        </Field>
      </div>
    </Modal>
  );
};

const MissionCard = ({ m, set, onEdit }) => {
  const done = m.subtasks.filter(s => s.done).length, total = m.subtasks.length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const toggleSub = (i) => set(s => { const mm = s.missions.find(x => x.id === m.id); mm.subtasks[i].done = !mm.subtasks[i].done; });
  return (
    <div className="card" style={{ borderLeft: `3px solid ${PRIO[m.prio]}` }}>
      <div className="row between mission-head">
        <div className="row" style={{ gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--surface-2)", display: "grid", placeItems: "center", color: PRIO[m.prio] }}><Icon name="target" size={20} /></div>
          <div>
            <div className="h3">{m.t}</div>
            <div className="mono" style={{ marginTop: 6 }}>{m.desc} · {done}/{total} subtareas</div>
          </div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Chip accent>+{m.xp.toLocaleString("es")} XP</Chip>
          <div className="icon-btn" style={{ width: 34, height: 34 }} onClick={onEdit}><Icon name="edit" size={15} /></div>
          <div className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => { set(s => s.missions = s.missions.filter(x => x.id !== m.id)); toast("Misión eliminada"); }}><Icon name="trash" size={15} /></div>
          <div className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => set(s => { const mm = s.missions.find(x => x.id === m.id); mm.expanded = !mm.expanded; })}><Icon name={m.expanded ? "chevL" : "chevR"} size={15} style={{ transform: m.expanded ? "rotate(90deg)" : "none" }} /></div>
        </div>
      </div>
      <div className="row between" style={{ margin: "18px 0 9px" }}><span className="mono" style={{ fontSize: 11 }}>Progreso</span><span className="mono mono-accent" style={{ fontSize: 11 }}>{pct}%</span></div>
      <div className="bar"><i style={{ width: pct + "%" }}></i></div>
      {m.expanded && (
        <div style={{ marginTop: 18, display: "grid", gap: 2 }}>
          {m.subtasks.map((st, i) => (
            <div key={i} className="row" style={{ gap: 12, padding: "9px 0" }}>
              <div className={`cbox${st.done ? " on" : ""}`} onClick={() => toggleSub(i)}>{st.done && <Icon name="check" size={13} color="#fff" />}</div>
              <span style={{ fontSize: 14, textDecoration: st.done ? "line-through" : "none", opacity: st.done ? .55 : 1 }}>{st.t}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Misiones = () => {
  const [data, set] = useStore();
  const [modal, setModal] = React.useState(null);
  const earned = data.missions.reduce((a, m) => a + Math.round(m.xp * m.subtasks.filter(s => s.done).length / Math.max(1, m.subtasks.length)), 0);
  const avail  = data.missions.reduce((a, m) => a + m.xp, 0);
  const byPrio = (p) => data.missions.filter(m => m.prio === p);
  return (
    <div className="page page-wide">
      <PageHead title="Misiones" meta={`${data.missions.length} activas`}>
        <Btn variant="primary" icon="plus" onClick={() => setModal("new")}>Nueva misión</Btn>
      </PageHead>
      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 28 }}>
        <div className="card card-hero tcorners"><TerminalCorners /><MonoLabel>XP ganado</MonoLabel><div className="display" style={{ fontSize: 56, color: "#fff", marginTop: 10 }}>{earned.toLocaleString("es")}</div></div>
        <div className="card"><MonoLabel>XP disponible</MonoLabel><div className="stat" style={{ fontSize: 48, marginTop: 10 }}>{avail.toLocaleString("es")}</div><div className="small" style={{ marginTop: 8 }}>Al completar todo</div></div>
        <div className="card"><MonoLabel>Completadas</MonoLabel><div className="stat" style={{ fontSize: 48, marginTop: 10 }}>0 / {data.missions.length}</div><div className="small" style={{ marginTop: 8 }}>Este cuatrimestre</div></div>
      </div>
      {data.missions.length === 0 && <Empty icon="target" title="Sin misiones" sub="Creá tu primera misión con el botón de arriba." />}
      {["alta", "media", "baja"].map(p => byPrio(p).length > 0 && (
        <div key={p} style={{ marginBottom: 28 }}>
          <div className="row" style={{ gap: 9, marginBottom: 14 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: PRIO[p] }}></span><span className="mono" style={{ color: PRIO[p] }}>{p} prioridad · {byPrio(p).length}</span></div>
          <div style={{ display: "grid", gap: 16 }}>{byPrio(p).map(m => <MissionCard key={m.id} m={m} set={set} onEdit={() => setModal(m)} />)}</div>
        </div>
      ))}
      {modal && <MissionModal mission={modal === "new" ? null : modal} onClose={() => setModal(null)} />}
    </div>
  );
};

/* ── CALENDARIO ─────────────────────────────────────────── */

/* helper: convierte "YYYY-MM-DD" → { year, month (0-indexed), day } */
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
};

/* helper: retorna "YYYY-MM-DD" de hoy en hora LOCAL (no UTC) */
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* obtiene el "day" de un evento (día del mes) */
const evDay  = (e) => e.date ? parseDate(e.date)?.day   : (e.day  || 0);
const evMonth= (e) => e.date ? parseDate(e.date)?.month : (new Date().getMonth());
const evYear = (e) => e.date ? parseDate(e.date)?.year  : (new Date().getFullYear());

/* parser .ics */
function parseICS(text) {
  const events = [];
  const lines  = text.replace(/\r\n|\r/g, "\n").split("\n");
  let ev = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "BEGIN:VEVENT")  { ev = {}; continue; }
    if (line === "END:VEVENT" && ev) {
      const dtRaw = ev["DTSTART"] || ev["DTSTART;VALUE=DATE"] || "";
      let date = "";
      if (dtRaw) {
        const d = dtRaw.replace(/T.*/, "").replace(/-/g, "");
        if (d.length === 8) date = d.slice(0,4) + "-" + d.slice(4,6) + "-" + d.slice(6,8);
      }
      if (ev["SUMMARY"] && date) {
        events.push({
          id:      uid(),
          title:   ev["SUMMARY"].replace(/\\,/g, ",").replace(/\\n/g, " "),
          date,
          day:     parseInt(date.slice(8,10)),
          desc:    (ev["DESCRIPTION"] || "").slice(0, 100),
          color:   COLORS[events.length % COLORS.length],
          fromICS: true,
        });
      }
      ev = null; continue;
    }
    if (!ev) continue;
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).split(";")[0];
    ev[key] = line.slice(sep + 1);
  }
  return events;
}

function exportToICS(events) {
  const toD = (s) => (s || "").replace(/-/g, "");
  let out = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//StudyHub//v3//ES","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
  for (const ev of events) {
    const d = ev.date ? toD(ev.date) : "";
    if (!d) continue;
    out.push("BEGIN:VEVENT");
    out.push("UID:" + ev.id + "@studyhub");
    out.push("DTSTART;VALUE=DATE:" + d);
    out.push("DTEND;VALUE=DATE:"   + d);
    out.push("SUMMARY:" + (ev.title || "").replace(/,/g, "\\,"));
    if (ev.desc) out.push("DESCRIPTION:" + ev.desc.replace(/,/g, "\\,"));
    out.push("END:VEVENT");
  }
  out.push("END:VCALENDAR");
  return out.join("\r\n");
}

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DOW_ES    = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

const EventModal = ({ day, month, year, event, onClose }) => {
  const [data, set] = useStore();
  /* fecha por defecto: parámetro day/month/year o fecha del evento o hoy */
  const defaultDate = event?.date ||
    (day && month != null && year ? `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}` : todayISO());
  const [f, setF]           = React.useState(event || { date: defaultDate, title: "", color: COLORS[0], desc: "" });
  const [syncTask, setSyncTask] = React.useState(false);
  const up = (k, v) => setF(x => ({ ...x, [k]: v }));

  /* ¿Ya tiene tarea vinculada? */
  const existingTaskId = event && Object.keys(data.taskCalendarMap || {}).find(k => data.taskCalendarMap[k] === event.id);
  const hasLinkedTask  = !!existingTaskId;

  const save = () => {
    if (!f.title.trim()) return toast("Poné un título");
    if (!f.date)         return toast("Elegí una fecha");
    const savedId = event?.id || uid();
    const ev = { ...f, id: savedId, day: parseInt(f.date.slice(8,10)) };
    set(s => { if (event) Object.assign(s.events.find(e => e.id === event.id), ev); else s.events.push(ev); });
    toast("Evento guardado");
    /* Sync al guardar si se marcó el checkbox (solo eventos nuevos) */
    if (syncTask && !hasLinkedTask) {
      syncEventToTask(ev, data, set);
      toast("Tarea creada desde el evento ✓");
    }
    onClose();
  };
  const del = () => {
    if (event) {
      set(s => {
        s.events = s.events.filter(e => e.id !== event.id);
        /* limpiar mapeo y tarea vinculada */
        if (existingTaskId) {
          s.tasks = (s.tasks || []).filter(t => t.id !== existingTaskId);
          if (s.taskCalendarMap) delete s.taskCalendarMap[existingTaskId];
        }
      });
      toast("Evento eliminado");
    }
    onClose();
  };
  return (
    <Modal title={event ? "Editar evento" : "Nuevo evento"} icon="calendar" onClose={onClose}
      footer={<><span className="link" style={{ color: event ? "#e8639b" : "var(--tx-3)" }} onClick={del}>{event ? "Eliminar" : "Cancelar"}</span><Btn variant="primary" onClick={save}>Guardar evento</Btn></>}>
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="Título *"><input className="input" value={f.title} onChange={e => up("title", e.target.value)} autoFocus /></Field>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Fecha"><input className="input" type="date" value={f.date || ""} onChange={e => up("date", e.target.value)} style={{ colorScheme: "dark" }} /></Field>
          <Field label="Color"><div className="swatches">{COLORS.slice(0, 6).map(c => <div key={c} className={`swatch${f.color === c ? " sel" : ""}`} style={{ background: c }} onClick={() => up("color", c)} />)}</div></Field>
        </div>
        <Field label="Descripción"><textarea className="input" rows={2} value={f.desc} onChange={e => up("desc", e.target.value)} /></Field>
        {/* Sync a tareas */}
        {!event && (
          <div className="row" style={{ gap: 10, padding: "10px 14px", borderRadius: 10, background: syncTask ? "var(--violet-soft)" : "var(--surface-2)", cursor: "pointer", transition: "background .15s" }} onClick={() => setSyncTask(v => !v)}>
            <div className={`cbox${syncTask ? " on" : ""}`} style={{ flexShrink: 0 }}>{syncTask && <Icon name="check" size={13} color="#fff" />}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Agregar también a Tareas</div>
              <div className="mono" style={{ fontSize: 10, marginTop: 2, color: "var(--tx-3)" }}>Se crea una tarea vinculada a este evento</div>
            </div>
          </div>
        )}
        {event && hasLinkedTask && (
          <div className="mono" style={{ fontSize: 11, color: "var(--violet-hi)", background: "var(--violet-soft)", padding: "8px 12px", borderRadius: 8 }}>
            ✓ Este evento tiene una tarea vinculada
          </div>
        )}
      </div>
    </Modal>
  );
};

const Calendario = () => {
  const [data, set] = useStore();
  const [modal,   setModal]   = React.useState(null);
  const [viewDate, setView]   = React.useState(() => new Date());
  const icsRef = React.useRef();

  /* Limpiar eventos pasados al abrir calendario */
  React.useEffect(() => {
    cleanupPastEvents(set);
    const iv = setInterval(() => cleanupPastEvents(set), 1000 * 60 * 60); // hourly
    return () => clearInterval(iv);
  }, [set]);

  const vYear  = viewDate.getFullYear();
  const vMonth = viewDate.getMonth();
  const today  = new Date();
  const isCurrentMonth = vYear === today.getFullYear() && vMonth === today.getMonth();
  const todayDay = isCurrentMonth ? today.getDate() : -1;

  const daysInMonth = new Date(vYear, vMonth + 1, 0).getDate();
  const offset      = (new Date(vYear, vMonth, 1).getDay() + 6) % 7; /* lunes primero */

  /* eventos de este mes/año */
  const monthEvents = (data.events || []).filter(e => evMonth(e) === vMonth && evYear(e) === vYear);
  const evByDay     = (d) => monthEvents.filter(e => evDay(e) === d);
  const upcoming    = [...monthEvents].sort((a, b) => evDay(a) - evDay(b));
  const next        = upcoming.find(e => evDay(e) >= todayDay) || upcoming[0];

  const prevMonth = () => setView(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setView(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  /* importar .ics */
  const importICS = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseICS(ev.target.result);
      if (!parsed.length) { toast("No se encontraron eventos en el archivo"); return; }
      set(s => { s.events = [...(s.events||[]), ...parsed]; });
      toast(`${parsed.length} evento${parsed.length !== 1 ? "s" : ""} importado${parsed.length !== 1 ? "s" : ""} ✓`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  /* exportar .ics */
  const doExport = () => {
    const content = exportToICS(data.events || []);
    const blob = new Blob([content], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "studyhub-eventos.ics";
    a.click();
    toast("Calendario exportado ✓");
  };

  return (
    <div className="page page-wide">
      <PageHead title="Agenda" meta={`${MONTHS_ES[vMonth]} ${vYear}`}>
        <div className="seg" style={{ padding: 3 }}>
          <button onClick={prevMonth} style={{ padding: "7px 10px" }}><Icon name="chevL" size={15} /></button>
          <button className="on" style={{ padding: "7px 14px" }}>{MONTHS_ES[vMonth]}</button>
          <button onClick={nextMonth} style={{ padding: "7px 10px" }}><Icon name="chevR" size={15} /></button>
        </div>
        <input ref={icsRef} type="file" accept=".ics,text/calendar" style={{ display: "none" }} onChange={importICS} />
        <Btn variant="secondary" icon="upload" onClick={() => icsRef.current?.click()}>Importar .ics</Btn>
        <Btn variant="secondary" icon="download" onClick={doExport}>Exportar</Btn>
        <Btn variant="primary"   icon="plus"     onClick={() => setModal({ day: todayDay > 0 ? todayDay : 1, month: vMonth, year: vYear })}>Nuevo evento</Btn>
      </PageHead>

      {/* resumen */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 18 }}>
        <div className="card card-hero tcorners" style={{ minHeight: 0 }}>
          <TerminalCorners />
          <MonoLabel>Próximo evento</MonoLabel>
          {next
            ? <><div className="h2" style={{ color: "#fff", marginTop: 12 }}>{next.title}</div><div style={{ color: "rgba(255,255,255,.82)", fontSize: 13.5, marginTop: 6 }}>{String(evDay(next)).padStart(2,"0")} de {MONTHS_ES[vMonth].toLowerCase()}</div></>
            : <div className="h2" style={{ color: "#fff", marginTop: 12 }}>Sin eventos</div>}
        </div>
        <div className="card"><MonoLabel>Eventos este mes</MonoLabel><div className="stat" style={{ fontSize: 44, marginTop: 10 }}>{monthEvents.length}</div></div>
        <div className="card"><MonoLabel>Esta semana</MonoLabel><div className="stat" style={{ fontSize: 44, marginTop: 10, color: "var(--violet-hi)" }}>{monthEvents.filter(e => evDay(e) >= todayDay && evDay(e) <= todayDay + 7).length}</div><div className="small" style={{ marginTop: 6 }}>próximos 7 días</div></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "2.6fr 1fr" }}>
        {/* grilla del calendario */}
        <div className="card card-flush" style={{ overflow: "hidden" }}>
          <div className="cal-month-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid var(--line)" }}>
            {DOW_ES.map((d, i) => <div key={d} className="mono" style={{ padding: "14px 0", textAlign: "center", fontSize: 10.5, color: i >= 5 ? "var(--violet-hi)" : "var(--tx-3)" }}>{d}</div>)}
          </div>
          <div className="cal-month-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
            {Array.from({ length: offset }).map((_, i) => <div key={"b"+i} style={{ borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "rgba(255,255,255,.012)" }}></div>)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
              const evs      = evByDay(d);
              const isToday  = d === todayDay;
              const isWeekend= ((offset + d - 1) % 7) >= 5;
              return (
                <div key={d} className="cal-day" onClick={() => setModal({ day: d, month: vMonth, year: vYear })} style={{ minHeight: 96, padding: 9, borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: isToday ? "var(--violet-soft)" : isWeekend ? "rgba(255,255,255,.015)" : "transparent", cursor: "pointer", transition: "background .14s" }}>
                  <div style={{ width: 26, height: 26, display: "grid", placeItems: "center", borderRadius: "50%", fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, color: isToday ? "#fff" : "var(--tx-2)", background: isToday ? "var(--violet)" : "transparent", marginBottom: 6 }}>{d}</div>
                  <div style={{ display: "grid", gap: 4 }}>
                    {evs.slice(0, 2).map(e => <div key={e.id} className="cal-event-pill" onClick={ev => { ev.stopPropagation(); setModal({ event: e }); }} style={{ fontSize: 10.5, fontWeight: 600, color: "#fff", background: e.color, padding: "3px 7px", borderRadius: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>)}
                    {evs.length > 2 && <div className="mono" style={{ fontSize: 9.5, color: "var(--tx-3)", paddingLeft: 2 }}>+{evs.length - 2} más</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* timeline lateral */}
        <div className="card" style={{ alignSelf: "start" }}>
          <div className="row between" style={{ marginBottom: 18 }}><div className="h3">Próximos eventos</div><Chip>{upcoming.length}</Chip></div>
          {upcoming.length === 0
            ? <Empty icon="calendar" title="Sin eventos" sub="Tocá un día para agregar uno." />
            : (
              <div style={{ display: "grid", gap: 4 }}>
                {upcoming.map(e => {
                  const d = evDay(e);
                  const soon = d >= todayDay && d <= todayDay + 3;
                  return (
                    <div key={e.id} onClick={() => setModal({ event: e })} className="row" style={{ gap: 14, padding: "13px 10px", borderRadius: 10, cursor: "pointer", transition: "background .14s", alignItems: "flex-start" }}
                      onMouseEnter={ev => ev.currentTarget.style.background = "var(--surface-2)"}
                      onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                      <div style={{ textAlign: "center", flex: "0 0 auto", width: 40 }}>
                        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: e.color, lineHeight: 1 }}>{String(d).padStart(2,"0")}</div>
                        <div className="mono" style={{ fontSize: 9, marginTop: 2 }}>{MONTHS_ES[vMonth].slice(0,3).toLowerCase()}</div>
                      </div>
                      <div style={{ width: 3, alignSelf: "stretch", borderRadius: 99, background: e.color }}></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{e.title}</div>
                        {soon && <span className="chip" style={{ marginTop: 7, fontSize: 9, color: "var(--violet-hi)", borderColor: "var(--violet-line)" }}>pronto</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      {modal && (
        <EventModal
          day={modal.day} month={modal.month} year={modal.year}
          event={modal.event}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
};

export { Misiones, Calendario, MissionModal, EventModal };