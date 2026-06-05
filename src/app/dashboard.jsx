import React from 'react';

import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, COLORS, PRIO, STATUS, getPomoWeekMins, getPomoWeekByDay } from './store.jsx';
import { Btn, Chip, MonoLabel, PageHead, Empty, Toggle, ProgressRing, SubjectDot, TerminalCorners } from './ui.jsx';
import { SmartList } from './widgets.jsx';

/* ============================================================
   DASHBOARD WIDGETS — conectados al store
   ============================================================ */
const greetingTime = () => { const h = new Date().getHours(); return h < 6 ? "noche" : h < 13 ? "mañana" : h < 20 ? "tarde" : "noche"; };

const _evDay  = (e) => e.date ? parseInt(e.date.slice(8,10)) : (e.day || 0);
const _evMonth= (e) => e.date ? parseInt(e.date.slice(5,7)) - 1 : new Date().getMonth();
const _evYear = (e) => e.date ? parseInt(e.date.slice(0,4)) : new Date().getFullYear();
const _isToday= (e) => { const t = new Date(); return _evDay(e) === t.getDate() && _evMonth(e) === t.getMonth() && _evYear(e) === t.getFullYear(); };

const WAgenda = ({ data }) => {
  const today = (data.events || []).filter(_isToday);
  return (
    <div className="card" style={{ height: "100%" }}>
      <div className="row between" style={{ marginBottom: 18 }}><div className="h3">Agenda de hoy</div><Icon name="calendar" size={18} color="var(--tx-3)" /></div>
      {today.length === 0
        ? <Empty icon="calendar" title="Sin eventos hoy" sub="Disfrutá el día libre." />
        : <div style={{ display: "grid", gap: 10 }}>
            {today.map(e => (
              <div key={e.id} className="row" style={{ gap: 14, padding: "12px 0", borderTop: "1px solid var(--line)" }}>
                <span style={{ width: 9, height: 9, borderRadius: 99, background: e.color }}></span>
                <div style={{ flex: 1, fontSize: 14.5, fontWeight: 500 }}>{e.title}</div>
              </div>
            ))}
          </div>}
    </div>
  );
};

const WXP = ({ data }) => (
  <div className="card card-hero tcorners" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
    <TerminalCorners />
    <div className="row between"><MonoLabel>XP total</MonoLabel><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.82)" }}>Nv {data.level}</span></div>
    <div>
      <div className="stat" style={{ fontSize: 34, color: "#fff" }}>{data.xp.toLocaleString("es")}</div>
      <div style={{ marginTop: 6, color: "rgba(255,255,255,.75)", fontSize: 12.5, display: "flex", alignItems: "center", gap: 5 }}>+120 hoy · <Icon name="fire" size={13} /> {data.streak}</div>
    </div>
  </div>
);

const WTareas = ({ data, set, onOpen }) => {
  const active = data.tasks.filter(t => !t.done);
  const [draft, setDraft] = React.useState("");
  return (
    <div className="card card-flush" style={{ height: "100%" }}>
      <div className="row between" style={{ padding: "20px 22px 14px" }}><div className="h3">Tareas activas</div><span className="link" style={{ fontSize: 13 }} onClick={() => onOpen("tareas")}>Ver todas →</span></div>
      <div style={{ borderTop: "1px solid var(--line)" }}>
        {active.length === 0 && <div className="empty" style={{ padding: 24 }}><span className="small">Sin tareas pendientes</span></div>}
        {active.slice(0, 4).map(t => {
          const subj = data.subjects.find(s => s.id === t.subject);
          return (
            <div key={t.id} className="row" style={{ gap: 13, padding: "12px 22px", borderBottom: "1px solid var(--line)" }}>
              <div className="cbox" onClick={() => set(s => { s.tasks.find(x => x.id === t.id).done = true; })}></div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{t.t}</div>
              <span className="prio" style={{ color: PRIO[t.prio], background: PRIO[t.prio] + "22" }}>{t.prio}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: t.due === "Hoy" ? "var(--violet-hi)" : "var(--tx-3)", width: 56, textAlign: "right" }}>{t.due}</span>
            </div>
          );
        })}
      </div>
      <form className="row" style={{ gap: 10, padding: "14px 22px" }} onSubmit={e => { e.preventDefault(); if (draft.trim()) { set(s => s.tasks.push({ id: uid(), t: draft.trim(), desc: "", subject: null, due: "—", prio: "media", xp: 20, status: "pendiente", done: false })); setDraft(""); toast("Tarea agregada"); } }}>
        <input className="input" placeholder="Agregar nueva tarea y enter…" value={draft} onChange={e => setDraft(e.target.value)} style={{ padding: "11px 14px", fontSize: 14 }} />
        <Btn variant="primary" icon="plus" style={{ flex: "0 0 auto" }}></Btn>
      </form>
    </div>
  );
};

const WMaterias = ({ data, onOpen }) => (
  <div className="card" style={{ height: "100%" }}>
    <div className="row between" style={{ marginBottom: 18 }}><div className="h3">Materias</div><span className="link" style={{ fontSize: 13 }} onClick={() => onOpen("facultad")}>Ver todas →</span></div>
    <div style={{ display: "grid", gap: 15 }}>
      {data.subjects.slice(0, 3).map(s => (
        <div key={s.id} className="row" style={{ gap: 13 }}>
          <SubjectDot s={s} size={34} />
          <div style={{ flex: 1 }}>
            <div className="row between" style={{ marginBottom: 6 }}><span style={{ fontSize: 14, fontWeight: 500 }}>{s.name}</span><span className="mono" style={{ fontSize: 11 }}>{s.pct}%</span></div>
            <div className="bar"><i style={{ width: s.pct + "%", background: s.color }}></i></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const WRacha = ({ data }) => {
  const days = ["L","M","M","J","V","S","D"];
  const filled = [true, false, false, false, false, false, false];
  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
      <MonoLabel>Racha</MonoLabel>
      <div className="stat" style={{ fontSize: 32 }}>{data.streak}<span style={{ fontSize: 14, color: "var(--tx-3)", fontWeight: 500, marginLeft: 5 }}>{data.streak === 1 ? "día" : "días"}</span></div>
      <div className="row" style={{ gap: 5 }}>
        {days.map((d, i) => <div key={i} title={d} style={{ flex: 1, height: 20, borderRadius: 5, background: filled[i] ? "var(--fill)" : "var(--surface-3)" }}></div>)}
      </div>
    </div>
  );
};

const WHoras = () => {
  const days = ["L","M","M","J","V","S","D"];
  const vals = getPomoWeekByDay(); /* horas reales de pomoLog */
  const totalH = Math.round(getPomoWeekMins() / 60 * 10) / 10;
  const max = Math.max(0.5, ...vals);
  const todayIdx = (new Date().getDay() + 6) % 7; /* 0=Lun … 6=Dom */
  return (
    <div className="card" style={{ height: "100%" }}>
      <div className="row between"><MonoLabel>Horas estudiadas</MonoLabel><span className="accent-tx" style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>{totalH}h esta semana</span></div>
      <div className="row" style={{ gap: 9, alignItems: "flex-end", height: 92, marginTop: 18 }}>
        {vals.map((v, i) => <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: "100%", height: Math.max(4, 66 * (v / max)), borderRadius: 6, background: i === todayIdx ? "var(--fill)" : "var(--surface-3)" }}></div>
          <div className="mono" style={{ fontSize: 9 }}>{days[i]}</div>
        </div>)}
      </div>
    </div>
  );
};

const WCompletas = ({ data }) => {
  const total = data.tasks.length, done = data.tasks.filter(t => t.done).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
      <MonoLabel>Tareas hechas</MonoLabel>
      <div className="stat" style={{ fontSize: 32 }}>{done}<span style={{ fontSize: 16, color: "var(--tx-3)", fontWeight: 500 }}>/{total}</span></div>
      <div><div className="bar"><i style={{ width: pct + "%" }}></i></div><div className="small" style={{ marginTop: 7, fontSize: 11.5 }}>{pct}% del día</div></div>
    </div>
  );
};

const WRing = ({ data }) => (
  <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
    <MonoLabel>Cuatrimestre</MonoLabel>
    <div className="row" style={{ gap: 14, alignItems: "center" }}>
      <ProgressRing value={62} size={62} />
      <div><div className="h2" style={{ fontSize: 20 }}>62%</div><div className="small" style={{ marginTop: 3, fontSize: 11.5 }}>43 días</div></div>
    </div>
  </div>
);

const WSemana = () => {
  const days = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"]; const vals = [5,3,7,2,6,1,0]; const max = 8;
  return (
    <div className="card" style={{ height: "100%" }}>
      <div className="row between" style={{ marginBottom: 20 }}><div className="h3">Actividad de la semana</div><span className="mono" style={{ fontSize: 11 }}>tareas / día</span></div>
      <div className="row" style={{ gap: 12, alignItems: "flex-end", height: 130 }}>
        {vals.map((v, i) => <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
          <div style={{ width: "100%", height: 95 * (v / max) + 4, borderRadius: 7, background: i === 4 ? "var(--fill)" : "var(--surface-3)" }}></div>
          <div className="mono" style={{ fontSize: 9.5 }}>{days[i]}</div>
        </div>)}
      </div>
    </div>
  );
};

const WReloj = () => {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const hh = String(now.getHours()).padStart(2, "0"), mm = String(now.getMinutes()).padStart(2, "0");
  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <MonoLabel>Hora</MonoLabel>
      <div className="display" style={{ fontSize: 40, marginTop: 8, fontFeatureSettings: '"tnum"' }}>{hh}:{mm}</div>
      <div className="small" style={{ marginTop: 4, textTransform: "capitalize" }}>{now.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}</div>
    </div>
  );
};

const WNota = ({ data, set }) => (
  <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
    <MonoLabel>Nota rápida</MonoLabel>
    <textarea value={data.dashNote || ""} onChange={e => set(s => s.dashNote = e.target.value)} placeholder="Algo para no olvidar…"
      style={{ flex: 1, marginTop: 12, minHeight: 90, background: "none", border: "none", outline: "none", resize: "none", color: "var(--tx-1)", fontFamily: "var(--font-body)", fontSize: 14, lineHeight: 1.6 }} />
  </div>
);

const MONTHS_ABBR = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

const WProximo = ({ data, onOpen }) => {
  const now = new Date();
  const sortedFuture = [...(data.events||[])].sort((a,b) => {
    const da = a.date ? new Date(a.date) : new Date(now.getFullYear(), now.getMonth(), _evDay(a));
    const db = b.date ? new Date(b.date) : new Date(now.getFullYear(), now.getMonth(), _evDay(b));
    return da - db;
  });
  const next = sortedFuture.find(e => {
    const d = e.date ? new Date(e.date) : new Date(now.getFullYear(), now.getMonth(), _evDay(e));
    return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }) || sortedFuture[0];
  const nextLabel = next ? (next.date ? `${String(_evDay(next)).padStart(2,"0")} de ${MONTHS_ABBR[_evMonth(next)]}` : `${String(_evDay(next)).padStart(2,"0")}`) : "";
  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer" }} onClick={() => onOpen("calendario")}>
      <div className="row between"><MonoLabel>Próximo evento</MonoLabel><Icon name="calendar" size={16} color="var(--tx-3)" /></div>
      {next ? <><div className="h2" style={{ marginTop: 10 }}>{next.title}</div><div className="row" style={{ gap: 9, marginTop: 10 }}><span style={{ width: 9, height: 9, borderRadius: 99, background: next.color }}></span><span className="small">{nextLabel}</span></div></> : <div className="small" style={{ marginTop: 10 }}>Sin eventos próximos</div>}
    </div>
  );
};

const WHabitos = ({ data, onOpen }) => {
  const hp = (data.space && data.space.pages.find(p => p.kind === "habits")) || { habits: [] };
  const k = `${new Date().getMonth() + 1}-${new Date().getDate()}`;
  const total = hp.habits.length, done = hp.habits.filter(h => (h.done || []).includes(k)).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer" }} onClick={() => onOpen("espacio")}>
      <div className="row between"><MonoLabel>Hábitos de hoy</MonoLabel><Icon name="fire" size={17} color="var(--violet-hi)" /></div>
      <div className="stat" style={{ fontSize: 34, marginTop: 10 }}>{done}<span style={{ fontSize: 18, color: "var(--tx-3)" }}>/{total}</span></div>
      <div style={{ marginTop: 14 }}><div className="bar"><i style={{ width: pct + "%" }}></i></div></div>
    </div>
  );
};

const FRASES = [
  "Hecho es mejor que perfecto.", "Un paso a la vez también es avanzar.", "La constancia vence al talento.",
  "Estudiá ahora, agradecé después.", "El secreto es empezar.", "Pequeños hábitos, grandes resultados.", "Concentrate en hoy.",
];
const WFrase = () => {
  const f = FRASES[new Date().getDate() % FRASES.length];
  return (
    <div className="card card-hero tcorners" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <TerminalCorners />
      <MonoLabel>Frase del día</MonoLabel>
      <div className="h2" style={{ color: "#fff", marginTop: 12, lineHeight: 1.3, textWrap: "pretty" }}>“{f}”</div>
    </div>
  );
};

const WIDGET_COMP = {
  agenda: WAgenda, xp: WXP, tareas: WTareas, materias: WMaterias,
  racha: WRacha, horas: WHoras, completas: WCompletas, ring: WRing, semana: WSemana,
  reloj: WReloj, nota: WNota, proximo: WProximo, habitos: WHabitos, frase: WFrase,
};

export { WIDGET_COMP, greetingTime };