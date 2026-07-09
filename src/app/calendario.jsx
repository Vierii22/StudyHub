import React from 'react';

import { Icon } from './icons.jsx';
import { useStore, uid, toast, COLORS } from './store.jsx';
import { Btn, Modal, Field, Seg } from './ui.jsx';
import { cleanupPastEvents, syncEventToTask } from './syncEngine.js';
import { parseDate, todayISO, evDay, evMonth, evYear, parseICS, exportToICS, MONTHS_ES, DOW_ES } from './sections.jsx';

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

/* ---------- vista SEMANA ---------- */
const WeekView = ({ viewDate, events, subjects, onDay, onEvent }) => {
  const start = startOfWeek(viewDate);
  const today = isoOf(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(7,1fr)", gap: 14 }}>
      {days.map(d => {
        const iso = isoOf(d);
        const isToday = iso === today;
        const dayEvents = events.filter(e => e.date === iso).sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
        return (
          <div key={iso} style={{ minHeight: 160 }}>
            <div style={{ marginBottom: 12 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--tx-3)", letterSpacing: ".08em" }}>{DOW_ES[(d.getDay() + 6) % 7]}</div>
              <span
                onClick={() => onDay(iso)}
                style={{
                  fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, cursor: "pointer",
                  color: isToday ? "#fff" : "var(--ink)",
                  background: isToday ? "var(--org)" : "transparent",
                  width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", marginTop: 3,
                }}>{d.getDate()}</span>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {dayEvents.map(e => <EventCard key={e.id} e={e} subj={subjOf(e, subjects)} onClick={() => onEvent(e)} />)}
            </div>
          </div>
        );
      })}
    </div>
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
    <div className="grid" style={{ gridTemplateColumns: "repeat(7,1fr)", gap: 10 }}>
      {DOW_ES.map(d => <div key={d} className="mono" style={{ textAlign: "center", fontSize: 10, color: "var(--tx-3)", paddingBottom: 4 }}>{d}</div>)}
      {Array.from({ length: offset }).map((_, i) => <div key={"b" + i} />)}
      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
        const evs = evByDay(d);
        const isToday = d === todayDay;
        const featured = evs.find(e => e.kind === "entrega") || evs.find(e => e.kind === "parcial");
        const rest = evs.filter(e => e !== featured);
        return (
          <div key={d} onClick={() => onDay(d)} className="cal-month-cell">
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
    return { parcial: evs.some(e => e.kind === "parcial"), entrega: evs.some(e => e.kind === "entrega") };
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
                display: "grid", placeItems: "center", color: isToday ? "var(--org)" : meta.parcial ? "#fff" : meta.entrega ? "#fff" : "var(--tx-3)",
                border: isToday ? "1.5px solid var(--org)" : "none",
                background: !isToday && meta.parcial ? "var(--org)" : !isToday && meta.entrega ? "var(--ink)" : "transparent",
                fontWeight: (meta.parcial || meta.entrega || isToday) ? 700 : 400,
              }}>{d}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const YearView = ({ year, events, onOpenMonth }) => (
  <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
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
        <div className="row" style={{ gap: 10 }}>
          <Seg opts={[{ id: "semana", label: "Semana" }, { id: "mes", label: "Mes" }, { id: "año", label: "Año" }]} value={vista} onChange={setVista} />
          {vista !== "año" && (
            <div className="seg" style={{ padding: 3 }}>
              <button onClick={prev} style={{ padding: "7px 9px" }}><Icon name="chevL" size={14} /></button>
              <button onClick={next} style={{ padding: "7px 9px" }}><Icon name="chevR" size={14} /></button>
            </div>
          )}
          <input ref={icsRef} type="file" accept=".ics,text/calendar" style={{ display: "none" }} onChange={importICS} />
          <div className="icon-btn" title="Importar .ics" onClick={() => icsRef.current?.click()}><Icon name="upload" size={16} /></div>
          <div className="icon-btn" title="Exportar .ics" onClick={doExport}><Icon name="download" size={16} /></div>
          <div className="icon-btn" title="Nuevo evento" onClick={() => setModal({ day: today.getDate(), month: viewDate.getMonth(), year: viewDate.getFullYear() })}><Icon name="plus" size={16} /></div>
        </div>
      </div>

      {vista === "semana" && <WeekView viewDate={viewDate} events={events} subjects={data.subjects} onDay={(iso) => setModal({ day: parseInt(iso.slice(8, 10)), month: parseInt(iso.slice(5, 7)) - 1, year: parseInt(iso.slice(0, 4)) })} onEvent={onEventClick} />}
      {vista === "mes" && <MonthView viewDate={viewDate} events={events} subjects={data.subjects} onDay={(d) => setModal({ day: d, month: viewDate.getMonth(), year: viewDate.getFullYear() })} onEvent={onEventClick} />}
      {vista === "año" && <YearView year={viewDate.getFullYear()} events={events} onOpenMonth={(m) => { setView(new Date(viewDate.getFullYear(), m, 1)); setVista("mes"); }} />}

      {modal && <EventModal day={modal.day} month={modal.month} year={modal.year} event={modal.event} onClose={() => setModal(null)} />}
    </div>
  );
};

export { Calendario };
