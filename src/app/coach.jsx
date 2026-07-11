import React from 'react';
import { Icon } from './icons.jsx';
import { useStore, uid, toast, getAllTasks } from './store.jsx';
import { parseCapture } from './palette.jsx';
import { Hubby } from './ui.jsx';

const COACH_POSE = { alta: "vamos", media: "vamos", baja: "idea", cero: "contento" };

/* ============================================================
   COACH — "¿Y ahora qué?"
   Motor de recomendación determinístico: analiza parciales
   próximos, tareas (prioridad/vencimiento), energía de la
   mañana y hora del día. Sin IA, sin red — funciona siempre.
   ============================================================ */

const todayISO = () => new Date().toISOString().slice(0, 10);

/* Eventos tipo examen en los próximos N días, con días restantes */
function upcomingExams(data, maxDays = 14) {
  const today = todayISO();
  return (data.events || [])
    .filter(e => e.date >= today && /parcial|final|examen|test|evaluaci/i.test(e.title || ""))
    .map(e => ({
      ...e,
      days: Math.round((new Date(e.date + "T12:00") - new Date(today + "T12:00")) / 864e5),
    }))
    .filter(e => e.days <= maxDays)
    .sort((a, b) => a.days - b.days);
}

/* Matchea un examen con una materia por nombre (aprox) */
function examSubject(exam, subjects) {
  const t = (exam.title || "").toLowerCase();
  return (subjects || []).find(s => {
    const words = s.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    return words.some(w => t.includes(w));
  });
}

function getNextAction(data) {
  const now = new Date();
  const hour = now.getHours();
  const today = todayISO();
  const tasks = getAllTasks(data).filter(t => !t.done);
  const subjects = data.subjects || [];
  const exams = upcomingExams(data);

  /* energía de hoy (del registro matutino) */
  const m = (data.morning || [])[0];
  const lowEnergy = m && (m.isoDate === today) && ((m.energy != null && m.energy <= 2) || (Number(m.sleep) > 0 && Number(m.sleep) < 6));

  /* puntuar tareas */
  const prioW = { alta: 30, media: 15, baja: 5 };
  const scored = tasks.map(t => {
    let score = prioW[t.prio] || 10;
    let why = [];
    if (t.due === "Hoy") { score += 40; why.push("vence hoy"); }
    if (t.subject) {
      const subj = subjects.find(s => s.id === t.subject);
      const exam = exams.find(e => subj && examSubject(e, [subj]));
      if (exam) { score += 30 - exam.days; why.push(`parcial de ${subj.name} en ${exam.days === 0 ? "HOY" : exam.days + " días"}`); }
    }
    return { t, score, why };
  }).sort((a, b) => b.score - a.score);

  /* ── reglas, de más urgente a más relajada ── */

  /* 1. Parcial HOY o mañana */
  const examSoon = exams.find(e => e.days <= 1);
  if (examSoon) {
    const subj = examSubject(examSoon, subjects);
    return {
      icon: "fire", urgency: "alta",
      title: examSoon.days === 0 ? `Hoy: ${examSoon.title}` : `Mañana: ${examSoon.title}`,
      reason: subj
        ? `Repasá los temas de ${subj.name} — abrí la materia y revisá notas y TPs. Una sesión de foco ahora vale doble.`
        : "Último repaso. Una sesión de foco de 25 minutos ahora vale más que 2 horas dispersas.",
      cta: { label: "Empezar foco 25m", nav: "pomodoro" },
      alt: subj ? { label: `Abrir ${subj.name}`, nav: "facultad" } : { label: "Ver calendario", nav: "calendario" },
    };
  }

  /* 2. Parcial en ≤7 días → estudiar para eso */
  const examWeek = exams.find(e => e.days <= 7);
  if (examWeek && (!scored[0] || scored[0].score < 50)) {
    const subj = examSubject(examWeek, subjects);
    return {
      icon: "book", urgency: "media",
      title: `${examWeek.title} — en ${examWeek.days} días`,
      reason: subj
        ? `Todavía hay margen, pero el mejor momento para repasar ${subj.name} es ahora. Dividilo: hoy un tema, mañana otro.`
        : `Quedan ${examWeek.days} días. Planificá qué tema repasás cada día y empezá hoy con el primero.`,
      cta: { label: "Empezar foco 25m", nav: "pomodoro" },
      alt: { label: "Ver materias", nav: "facultad" },
    };
  }

  /* 3. Tarea puntuada arriba */
  if (scored.length > 0 && scored[0].score >= 25) {
    const { t, why } = scored[0];
    const subj = subjects.find(s => s.id === t.subject);
    return {
      icon: "target", urgency: t.due === "Hoy" ? "alta" : "media",
      title: t.t,
      reason: [
        why.length ? `Prioridad: ${why.join(" · ")}.` : `Es tu tarea de prioridad ${t.prio}.`,
        subj ? `Materia: ${subj.name}.` : "",
        lowEnergy ? "Dormiste poco — hacé solo 25 minutos y cortá sin culpa." : "Un bloque de foco y la sacás.",
      ].filter(Boolean).join(" "),
      cta: { label: "Empezar foco 25m", nav: "pomodoro" },
      alt: { label: "Ver tarea", nav: "tareas" },
    };
  }

  /* 4. Baja energía + noche → cerrar el día */
  if (lowEnergy && hour >= 21) {
    return {
      icon: "moon", urgency: "baja",
      title: "Cerrá el día",
      reason: "Energía baja y ya es tarde. Anotá lo de mañana en el diario, revisá la agenda y descansá — mañana rendís el doble.",
      cta: { label: "Abrir diario", nav: "diario" },
      alt: { label: "Ver agenda", nav: "calendario" },
    };
  }

  /* 5. Hay tareas pero ninguna urgente */
  if (scored.length > 0) {
    const { t } = scored[0];
    return {
      icon: "check", urgency: "baja",
      title: `Adelantá: ${t.t}`,
      reason: "Nada vence hoy — ideal para adelantar. Lo que hagas ahora es tiempo libre que ganás después.",
      cta: { label: "Empezar foco 25m", nav: "pomodoro" },
      alt: { label: "Ver tareas", nav: "tareas" },
    };
  }

  /* 6. Inbox cero */
  return {
    icon: "star", urgency: "cero",
    title: "Todo al día ✨",
    reason: "No tenés tareas pendientes ni parciales cerca. Aprovechá: planificá la semana, o simplemente descansá — también es productivo.",
    cta: { label: "Planear semana", nav: "calendario" },
    alt: { label: "Modo foco libre", nav: "pomodoro" },
  };
}

const URGENCY_COLOR = { alta: "var(--org-deep)", media: "var(--org)", baja: "var(--green)", cero: "var(--green)" };

const CoachCard = ({ data, onNav }) => {
  const action = React.useMemo(() => getNextAction(data), [data]);
  return (
    <div className="coach-card">
      <Hubby pose={COACH_POSE[action.urgency] || "pensando"} size={78} className="coach-hubby hubby-float" />
      <div className="coach-label" style={{ color: URGENCY_COLOR[action.urgency] }}>
        <Icon name={action.icon} size={13} /> ¿Y ahora qué?
      </div>
      <div className="coach-title">{action.title}</div>
      <div className="coach-reason">{action.reason}</div>
      <div className="row" style={{ gap: 10, marginTop: 16 }}>
        <button className="btn btn-primary btn-sm" onClick={() => onNav(action.cta.nav)}>{action.cta.label}</button>
        {action.alt && <button className="btn btn-secondary btn-sm" onClick={() => onNav(action.alt.nav)}>{action.alt.label}</button>}
      </div>
    </div>
  );
};

/* ============================================================
   CAPTURE BAR — captura universal embebida en el dashboard
   ============================================================ */
const PLACEHOLDERS = [
  'Probá: "tarea: terminar TP de redes para el viernes"',
  'Probá: "parcial de álgebra el 24"',
  "Escribí cualquier cosa y se organiza sola…",
];

const TYPE_STYLE = {
  "create-task":  { label: "→ Tarea",  color: "var(--green)" },
  "create-event": { label: "→ Evento", color: "var(--org)" },
};

const CaptureBar = ({ data, set, onOpen }) => {
  const [text, setText] = React.useState("");
  const [phIdx, setPhIdx] = React.useState(0);

  React.useEffect(() => {
    const t = setInterval(() => setPhIdx(i => (i + 1) % PLACEHOLDERS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const parsed = text.trim() ? parseCapture(text, data.subjects || []) : null;
  const style = parsed ? TYPE_STYLE[parsed.type] : null;

  const submit = (e) => {
    e.preventDefault();
    if (!parsed) return;
    if (parsed.type === "create-task") {
      set(s => s.tasks.push({ id: uid(), desc: "", subject: null, due: "—", xp: 20, ...parsed.payload }));
      toast(`Tarea creada: ${parsed.payload.t}`);
    } else if (parsed.type === "create-event") {
      toast("Abrí el calendario para completar el evento");
      onOpen && onOpen("calendario");
    }
    setText("");
  };

  return (
    <form className="capture-bar" onSubmit={submit}>
      <Icon name="plus" size={17} color="var(--violet-hi)" />
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={PLACEHOLDERS[phIdx]}
      />
      {style && (
        <span className="capture-chip" style={{ color: style.color, border: `1px solid ${style.color}55`, background: `${style.color}15` }}>
          {style.label}
        </span>
      )}
      <span className="kbd" style={{ flex: "0 0 auto" }}>↵</span>
    </form>
  );
};

/* ============================================================
   TIMELINE DE HOY — eventos del día + tareas que vencen hoy
   ============================================================ */
const TodayTimeline = ({ data, set, onNav }) => {
  const today = todayISO();
  const events = (data.events || []).filter(e => e.date === today);
  const tasks = getAllTasks(data).filter(t => t.due === "Hoy");
  const exams = upcomingExams(data, 14).filter(e => e.days > 0);

  const toggleTask = (id) => set(s => {
    const t = s.tasks.find(x => x.id === id);
    if (t) { t.done = !t.done; t.status = t.done ? "lista" : "pendiente"; }
  });

  const empty = events.length === 0 && tasks.length === 0;

  return (
    <div className="card" style={{ height: "100%" }}>
      <div className="mono" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="calendar" size={13} /> HOY
      </div>

      {empty && (
        <div className="small" style={{ padding: "14px 0", color: "var(--tx-3)" }}>
          Día despejado — sin eventos ni vencimientos.
        </div>
      )}

      {events.map(e => (
        <div key={e.id} className="tl-item">
          <span className="tl-dot" style={{ background: e.color || "var(--violet)" }}></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tl-text" style={{ fontSize: 13.5, fontWeight: 600 }}>{e.title}</div>
            {e.desc && <div className="small" style={{ fontSize: 11.5, marginTop: 2 }}>{e.desc}</div>}
          </div>
          <span className="mono" style={{ fontSize: 9.5, color: "var(--tx-3)" }}>EVENTO</span>
        </div>
      ))}

      {tasks.map(t => (
        <div key={t.id} className={`tl-item${t.done ? " tl-done" : ""}`} style={{ cursor: "pointer" }} onClick={() => toggleTask(t.id)}>
          <div className="cbox" style={{ width: 17, height: 17, marginTop: 2, ...(t.done ? { background: "var(--violet)", borderColor: "var(--violet)" } : {}) }}>
            {t.done && <Icon name="check" size={11} color="#fff" />}
          </div>
          <div className="tl-text" style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{t.t}</div>
          <span className="mono" style={{ fontSize: 9.5, color: "var(--org)" }}>HOY</span>
        </div>
      ))}

      {exams.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          {exams.slice(0, 3).map(e => (
            <div key={e.id} className="row" style={{ gap: 9, padding: "5px 0", cursor: "pointer" }} onClick={() => onNav("calendario")}>
              <Icon name="fire" size={12} color={e.days <= 3 ? "var(--org-deep)" : "var(--org)"} />
              <span className="small" style={{ flex: 1, fontSize: 12 }}>{e.title}</span>
              <span className="mono" style={{ fontSize: 10, color: e.days <= 3 ? "var(--org-deep)" : "var(--tx-3)" }}>
                {e.days}d
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export { CoachCard, CaptureBar, TodayTimeline, getNextAction, upcomingExams };
