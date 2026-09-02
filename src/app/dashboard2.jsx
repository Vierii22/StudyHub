import React from 'react';

import { Icon } from './icons.jsx';
import { useStore, isSubjectDone, subjectClassDates, todayLocal } from './store.jsx';
import { CoachCard, CaptureBar, TodayTimeline } from './coach.jsx';
import { usePushNotifications } from './pushNotifications.js';

const greetingTime = () => { const h = new Date().getHours(); return h < 6 ? "noche" : h < 13 ? "mañana" : h < 20 ? "tarde" : "noche"; };

/* recordatorio para activar las notificaciones push (hasta que las activás o lo cerrás) —
   reemplaza al viejo aviso de "conectá el bot de Telegram", dado de baja */
const NotifyReminder = () => {
  const { status, enable } = usePushNotifications();
  const [gone, setGone] = React.useState(() => { try { return localStorage.getItem("sh_notif_reminder") === "off"; } catch { return false; } });
  if (status !== "unsubscribed" || gone) return null;
  const dismiss = (e) => { e.stopPropagation(); try { localStorage.setItem("sh_notif_reminder", "off"); } catch {} setGone(true); };
  return (
    <div className="bot-reminder" onClick={enable}>
      <img src="/assets/hubby/hubby-saluda.png" alt="" className="bot-reminder-hubby" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="bot-reminder-title">Activá las notificaciones</div>
        <div className="bot-reminder-sub">Un aviso con lo de mañana, aunque no tengas la app abierta.</div>
      </div>
      <span className="bot-reminder-cta">Activar</span>
      <span className="bot-reminder-x" onClick={dismiss} title="Ahora no"><Icon name="x" size={15} /></span>
    </div>
  );
};

/* Te avisa si tuviste clase y no anotaste qué se dio.
   Cruza el horario semanal de cada materia con el diario de clases:
   si hubo clase en los últimos días y no hay entrada de ese día,
   te lo recuerda. Así no dependés de acordarte vos. */
const DIAS_PARA_AVISAR = 7;

const ClaseSinAnotar = ({ onOpenSubject }) => {
  const [data] = useStore();
  const [gone, setGone] = React.useState(null); /* clave de la clase descartada en esta sesión */

  const pendiente = React.useMemo(() => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const desde = new Date(hoy); desde.setDate(desde.getDate() - DIAS_PARA_AVISAR);
    const hoyISO = todayLocal();
    let ultima = null;
    for (const s of (data.subjects || [])) {
      if (isSubjectDone(s)) continue;
      const anotadas = new Set(((s.lists?.clases) || []).map(c => c.date));
      for (const iso of subjectClassDates(s, desde, hoy)) {
        if (iso === hoyISO) continue;              /* la de hoy todavía puede estar en curso */
        if (anotadas.has(iso)) continue;           /* ya la anotaste */
        if (!ultima || iso > ultima.iso) ultima = { iso, subject: s };
      }
    }
    return ultima;
  }, [data.subjects]);

  if (!pendiente) return null;
  const clave = pendiente.subject.id + pendiente.iso;
  if (gone === clave) return null;

  const d = new Date(pendiente.iso + "T12:00:00");
  const cuando = d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
  const dismiss = (e) => { e.stopPropagation(); setGone(clave); };

  return (
    <div className="bot-reminder" onClick={() => onOpenSubject && onOpenSubject(pendiente.subject.id)}>
      <img src="/assets/hubby/hubby-idea.png" alt="" className="bot-reminder-hubby" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="bot-reminder-title">¿Qué viste en {pendiente.subject.name}?</div>
        <div className="bot-reminder-sub">Tuviste clase el {cuando} y no anotaste nada todavía.</div>
      </div>
      <span className="bot-reminder-cta">Anotar</span>
      <span className="bot-reminder-x" onClick={dismiss} title="Ahora no"><Icon name="x" size={15} /></span>
    </div>
  );
};

/* ============================================================
   DASHBOARD "HOY" — mockup confirmado (DESIGN.md pantalla 1)
   Layout fijo, sin modo edición ni widgets configurables:
   saludo + anotador con IA · menú de 5 íconos táctiles ·
   "¿y ahora qué?" + "Hoy".
   ============================================================ */
const MENU = [
  { id: "dashboard",  label: "Hoy",       icon: "home" },
  { id: "calendario", label: "Calendario",icon: "calendar" },
  { id: "facultad",   label: "Facultad",  icon: "layers" },
  { id: "tareas",     label: "Tareas",    icon: "check" },
  { id: "notas",      label: "Progreso",  icon: "target" },
  { id: "ocio",       label: "Ocio",      icon: "film" },
];

const HoyMenu = ({ active, onNav }) => (
  <div className="hoy-menu">
    {MENU.map(item => (
      <div
        key={item.id}
        className={`hoy-menu-btn${active === item.id ? " active" : ""}`}
        onClick={() => onNav(item.id)}
      >
        <span className="hoy-menu-icon"><Icon name={item.icon} size={19} /></span>
        <span>{item.label}</span>
      </div>
    ))}
  </div>
);

const Dashboard = ({ onNav, onOpenSubject }) => {
  const [data, set] = useStore();
  const p = data.profile;
  const [mobile, setMobile] = React.useState(() => typeof window !== "undefined" && window.innerWidth <= 768);
  React.useEffect(() => {
    const f = () => setMobile(window.innerWidth <= 768);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  const now = new Date();
  const gt = greetingTime();
  const saludo = gt === "mañana" ? "Buen día" : gt === "tarde" ? "Buenas tardes" : "Buenas noches";
  const fecha = now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  /* ── MOBILE: home tipo feed (el menú de secciones vive en el ☰) ── */
  if (mobile) {
    return (
      <div className="page page-cozy hoy-feed">
        <div className="hoy-hero">
          <div className="hoy-fecha">{fecha}</div>
          <h1 className="hoy-saludo">{saludo}, <em>{p.name}</em></h1>
        </div>
        <div style={{ marginTop: 16 }}><CoachCard data={data} onNav={onNav} /></div>
        <div style={{ margin: "14px 0" }}><CaptureBar data={data} set={set} onOpen={onNav} /></div>
        <NotifyReminder />
        <ClaseSinAnotar onOpenSubject={onOpenSubject} />
        <TodayTimeline data={data} set={set} onNav={onNav} />
      </div>
    );
  }

  return (
    <div className="page page-cozy">
      {/* ── HERO editorial ── */}
      <div className="hoy-hero">
        <div className="hoy-fecha">{fecha}</div>
        <h1 className="hoy-saludo">{saludo}, <em>{p.name}</em></h1>
      </div>

      {/* ── CAPTURA UNIVERSAL ── */}
      <div style={{ margin: "18px 0" }}>
        <CaptureBar data={data} set={set} onOpen={onNav} />
      </div>

      {/* ── recordatorio para activar notificaciones (si todavía no están) ── */}
      <NotifyReminder />
      <ClaseSinAnotar onOpenSubject={onOpenSubject} />

      {/* ── MENÚ DE ÍCONOS ── */}
      <HoyMenu active="dashboard" onNav={onNav} />

      {/* ── COACH + HOY ── */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(12,1fr)", marginTop: 22 }}>
        <div style={{ gridColumn: "span 7" }} className="dash-col-coach"><CoachCard data={data} onNav={onNav} /></div>
        <div style={{ gridColumn: "span 5" }} className="dash-col-hoy"><TodayTimeline data={data} set={set} onNav={onNav} /></div>
      </div>
    </div>
  );
};

export { Dashboard };
