import React from 'react';

import { Icon } from './icons.jsx';
import { useStore } from './store.jsx';
import { CoachCard, CaptureBar, TodayTimeline } from './coach.jsx';

const greetingTime = () => { const h = new Date().getHours(); return h < 6 ? "noche" : h < 13 ? "mañana" : h < 20 ? "tarde" : "noche"; };

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

const Dashboard = ({ onNav }) => {
  const [data, set] = useStore();
  const p = data.profile;

  const now = new Date();
  const gt = greetingTime();
  const saludo = gt === "mañana" ? "Buen día" : gt === "tarde" ? "Buenas tardes" : "Buenas noches";
  const fecha = now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

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
