import React from 'react';

import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, COLORS, PRIO } from './store.jsx';
import { Btn, Chip, Modal, Field, PageHead, Empty, MonoLabel, TerminalCorners } from './ui.jsx';

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
  /* Filtrar las misiones "Objetivos de hoy" — se muestran solo en el widget del dashboard */
  const missions = (data.missions || []).filter(m => !m.todayKey);
  const earned = missions.reduce((a, m) => a + Math.round(m.xp * m.subtasks.filter(s => s.done).length / Math.max(1, m.subtasks.length)), 0);
  const avail  = missions.reduce((a, m) => a + m.xp, 0);
  const byPrio = (p) => missions.filter(m => m.prio === p);
  return (
    <div className="page page-wide">
      <PageHead title="Misiones" meta={`${missions.length} activas`}>
        <Btn variant="primary" icon="plus" onClick={() => setModal("new")}>Nueva misión</Btn>
      </PageHead>
      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 28 }}>
        <div className="card card-hero tcorners"><TerminalCorners /><MonoLabel>XP ganado</MonoLabel><div className="display" style={{ fontSize: 56, color: "#fff", marginTop: 10 }}>{earned.toLocaleString("es")}</div></div>
        <div className="card"><MonoLabel>XP disponible</MonoLabel><div className="stat" style={{ fontSize: 48, marginTop: 10 }}>{avail.toLocaleString("es")}</div><div className="small" style={{ marginTop: 8 }}>Al completar todo</div></div>
        <div className="card"><MonoLabel>Completadas</MonoLabel><div className="stat" style={{ fontSize: 48, marginTop: 10 }}>0 / {missions.length}</div><div className="small" style={{ marginTop: 8 }}>Este cuatrimestre</div></div>
      </div>
      {missions.length === 0 && <Empty icon="target" title="Sin misiones" sub="Creá tu primera misión con el botón de arriba." />}
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


export { Misiones, MissionModal, parseDate, todayISO, evDay, evMonth, evYear, parseICS, exportToICS, MONTHS_ES, DOW_ES };
