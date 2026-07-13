import React from 'react';

import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from './icons.jsx';
import { useStore, uid, toast, COLORS } from './store.jsx';
import { Btn, Modal, Field, Seg } from './ui.jsx';
import { cleanupPastEvents, syncEventToTask } from './syncEngine.js';

/* helper: convierte "YYYY-MM-DD" → { year, month (0-indexed), day } */
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
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

/* helper: retorna "YYYY-MM-DD" de hoy en hora LOCAL (no UTC) */
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ============================================================
   CALENDARIO — Semana · Mes · Año (DESIGN.md punto 6)
   Fuentes de eventos: data.events (manuales + import .ics) +
   bloques "Estudiar · materia" derivados de subject.studyPlan.
   Pendiente: clases derivadas de subject.schedule (Fase 4 sólo
   guarda el horario; falta generarlas como eventos acá).
   ============================================================ */

/* ---------- modal de evento (con hora, tipo y materia) ---------- */
const EventModal = ({ day, month, year, event, onClose }) => {
  const [data, set] = useStore();
  const defaultDate = event?.date ||
    (day && month != null && year ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : todayISO());
  const [f, setF] = React.useState(event || { date: defaultDate, time: "", title: "", color: COLORS[0], desc: "", kind: "evento", subjectId: null });
  const [syncTask, setSyncTask] = React.useState(false);
  const up = (k, v) => setF(x => ({ ...x, [k]: v }));

  const existingTaskId = event && Object.keys(data.taskCalendarMap || {}).find(k => data.taskCalendarMap[k] === event.id);
  const hasLinkedTask = !!existingTaskId;

  const save = () => {
    if (!f.title.trim()) return toast("Poné un título");
    if (!f.date) return toast("Elegí una fecha");
    const savedId = event?.id || uid();
    const ev = { ...f, id: savedId, day: parseInt(f.date.slice(8, 10)) };
    set(s => { if (event) Object.assign(s.events.find(e => e.id === event.id), ev); else s.events.push(ev); });
    toast("Evento guardado");
    if (syncTask && !hasLinkedTask) { syncEventToTask(ev, data, set); toast("Tarea creada desde el evento ✓"); }
    onClose();
  };
  const del = () => {
    if (event) {
      set(s => {
        s.events = s.events.filter(e => e.id !== event.id);
        if (existingTaskId) { s.tasks = (s.tasks || []).filter(t => t.id !== existingTaskId); if (s.taskCalendarMap) delete s.taskCalendarMap[existingTaskId]; }
      });
      toast("Evento eliminado");
    }
    onClose();
  };

  return (
    <Modal title={event ? "Editar evento" : "Nuevo evento"} icon="calendar" onClose={onClose}
      footer={<><span className="link" style={{ color: event ? "var(--org-deep)" : "var(--tx-3)" }} onClick={del}>{event ? "Eliminar" : "Cancelar"}</span><Btn variant="primary" onClick={save}>Guardar evento</Btn></>}>
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="Título *"><input className="input" value={f.title} onChange={e => up("title", e.target.value)} autoFocus /></Field>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <Field label="Fecha"><input className="input" type="date" value={f.date || ""} onChange={e => up("date", e.target.value)} /></Field>
          <Field label="Hora"><input className="input" type="time" value={f.time || ""} onChange={e => up("time", e.target.value)} /></Field>
          <Field label="Color"><div className="swatches">{COLORS.map(c => <div key={c} className={`swatch${f.color === c ? " sel" : ""}`} style={{ background: c }} onClick={() => up("color", c)} />)}</div></Field>
        </div>
        <Field label="Tipo">
          <Seg opts={[{ id: "evento", label: "Evento" }, { id: "clase", label: "Clase" }, { id: "estudio", label: "Estudiar" }, { id: "parcial", label: "Parcial" }, { id: "entrega", label: "Entrega" }]}
            value={f.kind || "evento"} onChange={v => up("kind", v)} />
        </Field>
        <div className="row" style={{ gap: 10, padding: "10px 14px", borderRadius: 10, background: f.important ? "var(--violet-soft)" : "var(--surface-2)", cursor: "pointer", transition: "background .15s", border: "1px solid " + (f.important ? "var(--violet-line)" : "transparent") }} onClick={() => up("important", !f.important)}>
          <div className={`cbox${f.important ? " on" : ""}`} style={{ flexShrink: 0 }}>{f.important && <Icon name="check" size={13} color="#fff" />}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Icon name="star" size={13} color="var(--org)" /> Destacar el día</div>
            <div className="mono" style={{ fontSize: 10, marginTop: 2, color: "var(--tx-3)" }}>Para parciales o finales importantes — el día se resalta con borde naranja</div>
          </div>
        </div>
        {data.subjects?.length > 0 && (
          <Field label="Materia" hint="opcional">
            <select className="input" value={f.subjectId || ""} onChange={e => up("subjectId", e.target.value || null)}>
              <option value="">— sin materia —</option>
              {data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Descripción"><textarea className="input" rows={2} value={f.desc} onChange={e => up("desc", e.target.value)} /></Field>
        {!event && (
          <div className="row" style={{ gap: 10, padding: "10px 14px", borderRadius: 10, background: syncTask ? "var(--field)" : "var(--surface-2)", cursor: "pointer", transition: "background .15s" }} onClick={() => setSyncTask(v => !v)}>
            <div className={`cbox${syncTask ? " on" : ""}`} style={{ flexShrink: 0 }}>{syncTask && <Icon name="check" size={13} color="#fff" />}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Agregar también a Tareas</div>
              <div className="mono" style={{ fontSize: 10, marginTop: 2, color: "var(--tx-3)" }}>Se crea una tarea vinculada a este evento</div>
            </div>
          </div>
        )}
        {event && hasLinkedTask && (
          <div className="mono" style={{ fontSize: 11, color: "var(--org-deep)", background: "var(--field)", padding: "8px 12px", borderRadius: 8 }}>
            ✓ Este evento tiene una tarea vinculada
          </div>
        )}
      </div>
    </Modal>
  );
};

/* ---------- helpers de fecha ---------- */
const startOfWeek = (d) => { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const subjOf = (e, subjects) => e.subjectId && (subjects || []).find(s => s.id === e.subjectId);

/* ---------- tarjeta de evento (reutilizada en semana y detalle) ---------- */
const EventCard = ({ e, subj, onClick }) => {
  const isEstudio = e.kind === "estudio";
  const isClase = e.kind === "clase";
  const isEntrega = e.kind === "entrega";
  return (
    <div onClick={onClick} className="cal-ev-card">
      {isEntrega && <div className="cal-ev-flag"><Icon name="flag" size={11} /> ENTREGA</div>}
      <div className="row" style={{ gap: 6 }}>
        {e.time && <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: isEstudio ? "var(--org)" : "var(--ink)" }}>{e.time}</span>}
        {isClase && <span className="cal-ev-chip"><Icon name="book" size={11} /></span>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", lineHeight: 1.25, marginTop: 2 }}>{e.title}</div>
      {subj && (
        <div className="row" style={{ gap: 5, alignItems: "center", marginTop: 3 }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: subj.color, flex: "0 0 auto" }} />
          <span className="small" style={{ fontSize: 10.5 }}>{subj.name}</span>
        </div>
      )}
    </div>
  );
};

/* ---------- vista SEMANA (con arrastre de eventos) ---------- */
const timeNum = (e) => { if (!e.time) return 9000; const [h, m] = e.time.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
/* orden dentro de un día: por 'order' manual si existe, si no por hora */
const sortDay = (evs) => [...evs].sort((a, b) => {
  const ao = a.order != null ? a.order : 10000 + timeNum(a);
  const bo = b.order != null ? b.order : 10000 + timeNum(b);
  return ao - bo;
});

/* tarjeta de evento arrastrable (real, no derivada del planificador) */
const DraggableEvent = ({ e, subj, onClick }) => {
  const { attributes, listeners, setNodeRef: dragRef, transform, isDragging } = useDraggable({ id: e.id });
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: `evdrop|${e.id}` });
  const ref = (node) => { dragRef(node); dropRef(node); };
  return (
    <div ref={ref} {...attributes} {...listeners}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1, position: "relative", touchAction: "none", cursor: "grab", zIndex: isDragging ? 50 : "auto" }}>
      {isOver && <div className="cal-drop-line" />}
      <EventCard e={e} subj={subj} onClick={onClick} />
    </div>
  );
};

/* columna de un día = zona donde soltar */
const DayColumn = ({ iso, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `daydrop|${iso}` });
  return <div ref={setNodeRef} className={`cal-day-drop${isOver ? " over" : ""}`} style={{ display: "grid", gap: 8, minHeight: 60, borderRadius: 10, padding: 2 }}>{children}</div>;
};

const WeekView = ({ viewDate, events, subjects, onDay, onEvent, onMoveEvent }) => {
  const start = startOfWeek(viewDate);
  const today = isoOf(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = ({ active, over }) => {
    if (!over) return;
    const overId = String(over.id);
    let targetIso = null, beforeId = null;
    if (overId.startsWith("daydrop|")) targetIso = overId.slice(8);
    else if (overId.startsWith("evdrop|")) beforeId = overId.slice(7);
    else return;
    if (String(active.id) === beforeId) return;
    onMoveEvent(String(active.id), targetIso, beforeId);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="cal-scroll">
        <div className="grid cal-week-grid" style={{ gridTemplateColumns: "repeat(7,1fr)", gap: 14 }}>
          {days.map(d => {
            const iso = isoOf(d);
            const isToday = iso === today;
            const dayEvents = sortDay(events.filter(e => e.date === iso));
            const important = dayEvents.some(e => e.important);
            return (
              <div key={iso} style={{ minHeight: 160, borderRadius: 12, padding: important ? "8px 8px 10px" : 0, border: "1.5px solid " + (important ? "var(--org)" : "transparent"), background: important ? "rgba(217,85,31,.05)" : "transparent", transition: "background .15s ease" }}>
                <div style={{ marginBottom: 12 }}>
                  <div className="mono" style={{ fontSize: 10, color: important ? "var(--org-deep)" : "var(--tx-3)", letterSpacing: ".08em", display: "flex", alignItems: "center", gap: 4 }}>{DOW_ES[(d.getDay() + 6) % 7]}{important && <Icon name="star" size={10} color="var(--org)" />}</div>
                  <span
                    onClick={() => onDay(iso)}
                    style={{
                      fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, cursor: "pointer",
                      color: isToday ? "#fff" : "var(--ink)",
                      background: isToday ? "var(--org)" : "transparent",
                      border: !isToday && important ? "2px solid var(--org)" : "2px solid transparent",
                      width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", marginTop: 3,
                    }}>{d.getDate()}</span>
                </div>
                <DayColumn iso={iso}>
                  {dayEvents.map(e => e.studyPlanSubjectId
                    ? <EventCard key={e.id} e={e} subj={subjOf(e, subjects)} onClick={() => onEvent(e)} />
                    : <DraggableEvent key={e.id} e={e} subj={subjOf(e, subjects)} onClick={() => onEvent(e)} />
                  )}
                </DayColumn>
              </div>
            );
          })}
        </div>
      </div>
    </DndContext>
  );
};

/* ---------- vista MES ---------- */
const MonthView = ({ viewDate, events, subjects, onDay, onEvent }) => {
  const vYear = viewDate.getFullYear(), vMonth = viewDate.getMonth();
  const today = new Date();
  const isCurrentMonth = vYear === today.getFullYear() && vMonth === today.getMonth();
  const todayDay = isCurrentMonth ? today.getDate() : -1;
  const daysInMonth = new Date(vYear, vMonth + 1, 0).getDate();
  const offset = (new Date(vYear, vMonth, 1).getDay() + 6) % 7;
  const evByDay = (d) => events.filter(e => evMonth(e) === vMonth && evYear(e) === vYear && evDay(e) === d);

  return (
    <div className="cal-scroll">
      <div className="grid cal-month-grid" style={{ gridTemplateColumns: "repeat(7,1fr)", gap: 10 }}>
        {DOW_ES.map(d => <div key={d} className="mono" style={{ textAlign: "center", fontSize: 10, color: "var(--tx-3)", paddingBottom: 4 }}>{d}</div>)}
        {Array.from({ length: offset }).map((_, i) => <div key={"b" + i} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
          const evs = evByDay(d);
          const isToday = d === todayDay;
          const important = evs.some(e => e.important);
          const featured = evs.find(e => e.kind === "entrega") || evs.find(e => e.kind === "parcial");
          const rest = evs.filter(e => e !== featured);
          return (
            <div key={d} onClick={() => onDay(d)} className="cal-month-cell" style={important ? { boxShadow: "inset 0 0 0 2px var(--org)", background: "rgba(217,85,31,.05)" } : undefined}>
              {featured && (
                <div className={`cal-month-chip ${featured.kind}`}>
                  <Icon name={featured.kind === "entrega" ? "flag" : "fire"} size={10} /> {featured.title}
                </div>
              )}
              <div className="cal-month-daynum" style={isToday ? { background: "var(--org)", color: "#fff" } : undefined}>{d}</div>
              <div style={{ display: "grid", gap: 3, marginTop: 4 }}>
                {rest.slice(0, 2).map(e => (
                  <div key={e.id} onClick={ev => { ev.stopPropagation(); onEvent(e); }} className="row" style={{ gap: 4, alignItems: "center", fontSize: 10, overflow: "hidden" }}>
                    <span style={{ width: 5, height: 5, borderRadius: 99, flex: "0 0 auto", background: e.kind === "estudio" ? "var(--org)" : e.kind === "clase" ? "var(--soft)" : e.color }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--tx-2)" }}>{e.title}</span>
                  </div>
                ))}
                {rest.length > 2 && <div className="mono" style={{ fontSize: 9, color: "var(--tx-3)" }}>+{rest.length - 2} más</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ---------- vista AÑO ---------- */
const MiniMonth = ({ year, month, events, onOpen }) => {
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const todayDay = isCurrentMonth ? today.getDate() : -1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const dayMeta = (d) => {
    const evs = events.filter(e => evMonth(e) === month && evYear(e) === year && evDay(e) === d);
    return { parcial: evs.some(e => e.kind === "parcial"), entrega: evs.some(e => e.kind === "entrega"), important: evs.some(e => e.important) };
  };
  return (
    <div className="cal-year-card" onClick={() => onOpen(month)}>
      <div className="mono" style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: "var(--tx-1)", textTransform: "uppercase" }}>{MONTHS_ES[month]}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
        {Array.from({ length: offset }).map((_, i) => <div key={"b" + i} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
          const isToday = d === todayDay;
          const meta = dayMeta(d);
          return (
            <div key={d} style={{ height: 18, display: "grid", placeItems: "center" }}>
              <span style={{
                fontSize: 9, fontFamily: "var(--font-mono)", width: 16, height: 16, borderRadius: "50%",
                display: "grid", placeItems: "center",
                /* destacado o parcial = naranja sólido · entrega = marrón · hoy (si no) = anillo */
                color: (meta.important || meta.parcial || meta.entrega) ? "#fff" : isToday ? "var(--org)" : "var(--tx-3)",
                border: isToday && !(meta.important || meta.parcial || meta.entrega) ? "1.5px solid var(--org)" : "none",
                background: (meta.important || meta.parcial) ? "var(--org)" : meta.entrega ? "var(--ink)" : "transparent",
                boxShadow: meta.important ? "0 0 0 1.5px var(--card), 0 0 0 3px var(--org)" : "none",
                fontWeight: (meta.important || meta.parcial || meta.entrega || isToday) ? 700 : 400,
              }}>{d}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const YearView = ({ year, events, onOpenMonth }) => (
  <div className="grid cal-year-grid" style={{ gap: 14 }}>
    {Array.from({ length: 12 }, (_, m) => <MiniMonth key={m} year={year} month={m} events={events} onOpen={onOpenMonth} />)}
  </div>
);

/* ---------- bloques "Estudiar · materia" derivados del planificador (Fase 5) ---------- */
const FRANJA_TIME = { m: "09:00", t: "15:00", n: "20:00" };
function deriveStudyEvents(subjects) {
  const out = [];
  (subjects || []).forEach(s => {
    (s.studyPlan || []).forEach(p => {
      const tema = (s.lists?.temas || []).find(t => t.id === p.temaId);
      if (!tema) return;
      out.push({ id: `study-${p.id}`, title: `Estudiar · ${tema.t}`, date: p.date, time: FRANJA_TIME[p.franja] || "", kind: "estudio", color: s.color, subjectId: s.id, studyPlanSubjectId: s.id });
    });
  });
  return out;
}

/* ---------- pantalla principal ---------- */
const Calendario = ({ onOpenSubjectPlanner }) => {
  const [data, set] = useStore();
  const [modal, setModal] = React.useState(null);
  const [vista, setVista] = React.useState("mes");
  const [viewDate, setView] = React.useState(() => new Date());
  const icsRef = React.useRef();

  React.useEffect(() => {
    cleanupPastEvents(set);
    const iv = setInterval(() => cleanupPastEvents(set), 1000 * 60 * 60);
    return () => clearInterval(iv);
  }, [set]);

  const events = [...(data.events || []), ...deriveStudyEvents(data.subjects)];
  const onEventClick = (ev) => { if (ev.studyPlanSubjectId) onOpenSubjectPlanner && onOpenSubjectPlanner(ev.studyPlanSubjectId); else setModal({ event: ev }); };
  const today = new Date();

  const label = vista === "año"
    ? String(viewDate.getFullYear())
    : vista === "semana"
      ? (() => { const s = startOfWeek(viewDate), e = addDays(s, 6); return `${s.getDate()} — ${e.getDate()} ${MONTHS_ES[e.getMonth()].toLowerCase()}`; })()
      : `${MONTHS_ES[viewDate.getMonth()].toLowerCase()} ${viewDate.getFullYear()}`;

  const prev = () => setView(d => vista === "año" ? new Date(d.getFullYear() - 1, 0, 1) : vista === "semana" ? addDays(d, -7) : new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const next = () => setView(d => vista === "año" ? new Date(d.getFullYear() + 1, 0, 1) : vista === "semana" ? addDays(d, 7) : new Date(d.getFullYear(), d.getMonth() + 1, 1));

  /* mover un evento arrastrándolo: a otro día (daydrop) o reordenar dentro del día (evdrop) */
  const moveEvent = (activeId, targetIso, beforeId) => {
    set(s => {
      const evs = s.events || [];
      const act = evs.find(e => e.id === activeId);
      if (!act) return; /* los bloques "Estudiar" derivados no se mueven acá */
      if (!targetIso && beforeId) targetIso = evs.find(e => e.id === beforeId)?.date;
      if (!targetIso) return;
      act.date = targetIso;
      act.day = parseInt(targetIso.slice(8, 10));
      /* reconstruir el orden del día destino (solo eventos reales) */
      const dayEvs = sortDay(evs.filter(e => e.date === targetIso && e.id !== activeId && !e.studyPlanSubjectId));
      let insertIdx = dayEvs.length;
      if (beforeId) { const bi = dayEvs.findIndex(e => e.id === beforeId); if (bi >= 0) insertIdx = bi; }
      [...dayEvs.slice(0, insertIdx), act, ...dayEvs.slice(insertIdx)].forEach((e, i) => {
        const ref = evs.find(x => x.id === e.id); if (ref) ref.order = i;
      });
      /* si el evento tiene una tarea vinculada, actualizarle la fecha */
      const taskId = Object.keys(s.taskCalendarMap || {}).find(k => s.taskCalendarMap[k] === activeId);
      if (taskId) { const t = (s.tasks || []).find(x => x.id === taskId); if (t) { const [, m, dd] = targetIso.split("-"); t.dueDate = targetIso; t.due = `${parseInt(dd)}/${parseInt(m)}`; } }
    });
  };

  const importICS = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseICS(ev.target.result);
      if (!parsed.length) { toast("No se encontraron eventos en el archivo"); return; }
      set(s => { s.events = [...(s.events || []), ...parsed]; });
      toast(`${parsed.length} evento${parsed.length !== 1 ? "s" : ""} importado${parsed.length !== 1 ? "s" : ""} ✓`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };
  const doExport = () => {
    const blob = new Blob([exportToICS(events)], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "studyhub-eventos.ics"; a.click();
    toast("Calendario exportado ✓");
  };

  return (
    <div className="page page-wide">
      <div className="cal-head">
        <div>
          <div className="cal-title">Calendario<span className="cal-title-bar" /></div>
          <div className="cal-period">{label}</div>
        </div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Seg opts={[{ id: "semana", label: "Semana" }, { id: "mes", label: "Mes" }, { id: "año", label: "Año" }]} value={vista} onChange={setVista} />
          {vista !== "año" && (
            <>
              <div className="icon-btn" title="Anterior" onClick={prev}><Icon name="chevL" size={16} /></div>
              <div className="icon-btn" title="Siguiente" onClick={next}><Icon name="chevR" size={16} /></div>
            </>
          )}
          <input ref={icsRef} type="file" accept=".ics,text/calendar" style={{ display: "none" }} onChange={importICS} />
          <div className="icon-btn" title="Importar .ics" onClick={() => icsRef.current?.click()}><Icon name="upload" size={16} /></div>
          <div className="icon-btn" title="Exportar .ics" onClick={doExport}><Icon name="download" size={16} /></div>
          <div className="icon-btn" title="Nuevo evento" onClick={() => setModal({ day: today.getDate(), month: viewDate.getMonth(), year: viewDate.getFullYear() })}><Icon name="plus" size={16} /></div>
        </div>
      </div>

      {vista === "semana" && <WeekView viewDate={viewDate} events={events} subjects={data.subjects} onDay={(iso) => setModal({ day: parseInt(iso.slice(8, 10)), month: parseInt(iso.slice(5, 7)) - 1, year: parseInt(iso.slice(0, 4)) })} onEvent={onEventClick} onMoveEvent={moveEvent} />}
      {vista === "mes" && <MonthView viewDate={viewDate} events={events} subjects={data.subjects} onDay={(d) => setModal({ day: d, month: viewDate.getMonth(), year: viewDate.getFullYear() })} onEvent={onEventClick} />}
      {vista === "año" && <YearView year={viewDate.getFullYear()} events={events} onOpenMonth={(m) => { setView(new Date(viewDate.getFullYear(), m, 1)); setVista("mes"); }} />}

      {modal && <EventModal day={modal.day} month={modal.month} year={modal.year} event={modal.event} onClose={() => setModal(null)} />}
    </div>
  );
};

export { Calendario };
