import React from 'react';
import { Icon } from './icons.jsx';

/* ============================================================
   TAB BAR — bottom navigation para mobile (≤768px)
   Mismos 5 destinos que el menú de arriba.
   ============================================================ */

const TABS = [
  { id: "dashboard",  icon: "home",     label: "Hoy" },
  { id: "calendario", icon: "calendar", label: "Calendario" },
  { id: "facultad",   icon: "layers",   label: "Facultad" },
  { id: "tareas",     icon: "check",    label: "Tareas" },
  { id: "notas",      icon: "target",   label: "Progreso" },
  { id: "ocio",       icon: "film",     label: "Ocio" },
];

export function TabBar({ active, onNav }) {
  return (
    <nav
      className="tab-bar"
      style={{
        position: "fixed",
        bottom: 0, left: 0, right: 0,
        height: `calc(64px + env(safe-area-inset-bottom))`,
        paddingBottom: "env(safe-area-inset-bottom)",
        display: "flex", alignItems: "center",
        background: "var(--card)",
        borderTop: "1px solid var(--line)",
        zIndex: 500,
      }}
    >
      {TABS.map(tab => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onNav(tab.id)}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 3,
              height: "100%", border: "none", background: "none",
              cursor: "pointer",
              color: isActive ? "#fff" : "var(--tx-3)",
              transition: "color .15s",
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              display: "grid", placeItems: "center",
              background: isActive ? "var(--ink)" : "transparent",
              transition: "background .15s",
            }}>
              <Icon name={tab.icon} size={19} color={isActive ? "#fff" : "var(--tx-3)"} />
            </div>
            <span style={{
              fontSize: 10, fontWeight: isActive ? 700 : 500, color: isActive ? "var(--ink)" : "var(--tx-3)",
            }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
