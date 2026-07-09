import React from 'react';

import { Icon } from './icons.jsx';
import { useStore, getAllTasks } from './store.jsx';
import { greetingTime } from './dashboard.jsx';
import { CoachCard, CaptureBar, TodayTimeline } from './coach.jsx';

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
  { id: "notas",      label: "Notas",     icon: "note" },
  { id: "ocio",       label: "Pelis",     icon: "film" },
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

const Dashboard = ({ onNav }) => {
  const [data, set] = useStore();
  const p = data.profile;

  const now = new Date();
  const gt = greetingTime();
  const saludo = gt === "mañana" ? "Buen día" : gt === "tarde" ? "Buenas tardes" : "Buenas noches";
  const fecha = now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  const dayPct = Math.min(100, Math.max(0, ((now.getHours() * 60 + now.getMinutes()) - 420) / 1020 * 100));
  const activas = getAllTasks(data).filter(t => !t.done).length;

  return (
    <div className="page page-cozy">
      {/* ── HERO editorial ── */}
      <div className="hoy-hero">
        <div className="hoy-fecha">{fecha}</div>
        <h1 className="hoy-saludo">{saludo}, <em>{p.name}</em></h1>
        <div className="hoy-sub">{activas} tareas activas · racha de {data.streak || 0} días</div>
        <div className="hoy-dayline" title={`${Math.round(dayPct)}% del día`}><div style={{ width: `${dayPct}%` }}></div></div>
      </div>

      {/* ── CAPTURA UNIVERSAL ── */}
      <div style={{ margin: "18px 0" }}>
        <CaptureBar data={data} set={set} onOpen={onNav} />
      </div>

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
