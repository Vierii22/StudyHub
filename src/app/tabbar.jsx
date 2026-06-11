import React from 'react';
import { Icon } from './icons.jsx';

/* ============================================================
   TAB BAR — bottom navigation para mobile (≤768px)
   4 tabs principales + botón [+] central de captura rápida.
   ============================================================ */

const TABS = [
  { id: "dashboard", icon: "home",     label: "Inicio" },
  { id: "tareas",    icon: "check",    label: "Tareas" },
  null,  /* placeholder del botón [+] */
  { id: "pomodoro",  icon: "clock",    label: "Foco"   },
  { id: "chat",      icon: "chat",     label: "Hubby"  },
];

/* Sheet de "Más secciones" que abre el quinto slot */
const MAS_ITEMS = [
  { id: "facultad",  icon: "layers",   label: "Facultad"  },
  { id: "calendario",icon: "calendar", label: "Calendario"},
  { id: "misiones",  icon: "bolt",     label: "Misiones"  },
  { id: "diario",    icon: "pen",      label: "Diario"    },
  { id: "espacio",   icon: "box",      label: "Mi Espacio"},
  { id: "cocina",    icon: "mug",      label: "Cocina"    },
  { id: "finanzas",  icon: "coins",    label: "Finanzas"  },
  { id: "casa",      icon: "house",    label: "Casa"      },
  { id: "ocio",      icon: "sparkles", label: "Ocio"      },
  { id: "historial", icon: "clock",    label: "Historial" },
  { id: "config",    icon: "gear",     label: "Config"    },
];

export function TabBar({ active, onNav, onCapture }) {
  const [masOpen, setMasOpen] = React.useState(false);

  const handleNav = (id) => {
    setMasOpen(false);
    onNav(id);
  };

  const isMasActive = MAS_ITEMS.some(it => it.id === active);

  return (
    <>
      {/* Sheet "Más" */}
      {masOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 490,
            background: "rgba(0,0,0,.55)", backdropFilter: "blur(6px)",
          }}
          onClick={() => setMasOpen(false)}
        />
      )}
      <div
        className={`tab-bar-sheet${masOpen ? " open" : ""}`}
        style={{
          position: "fixed",
          bottom: masOpen ? 0 : "-100%",
          left: 0, right: 0,
          zIndex: 491,
          background: "var(--surface-1)",
          borderTop: "1px solid var(--line)",
          borderRadius: "22px 22px 0 0",
          padding: "16px 20px calc(16px + env(safe-area-inset-bottom))",
          transition: "bottom .32s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div style={{
          width: 40, height: 4, background: "var(--line-2)", borderRadius: 99,
          margin: "0 auto 18px",
        }} />
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
        }}>
          {MAS_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                padding: "12px 8px", borderRadius: 14,
                background: active === item.id ? "var(--violet-soft)" : "var(--surface-2)",
                border: "none", cursor: "pointer",
                color: active === item.id ? "var(--violet-hi)" : "var(--tx-2)",
                transition: "background .15s, color .15s",
              }}
            >
              <Icon name={item.icon} size={22} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Bar */}
      <nav
        className="tab-bar"
        style={{
          position: "fixed",
          bottom: 0, left: 0, right: 0,
          height: `calc(64px + env(safe-area-inset-bottom))`,
          paddingBottom: "env(safe-area-inset-bottom)",
          display: "flex", alignItems: "center",
          background: "var(--surface-1)",
          borderTop: "1px solid var(--line)",
          zIndex: 500,
          backdropFilter: "blur(20px)",
        }}
      >
        {TABS.map((tab, i) => {
          if (!tab) {
            /* Botón [+] central */
            return (
              <div key="plus" style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                <button
                  onClick={onCapture}
                  style={{
                    width: 52, height: 52,
                    borderRadius: 16,
                    background: "var(--grad)",
                    border: "none", cursor: "pointer",
                    display: "grid", placeItems: "center",
                    color: "#fff",
                    boxShadow: "0 8px 24px -8px var(--violet)",
                    transform: "translateY(-8px)",
                    transition: "transform .15s, box-shadow .15s",
                  }}
                  onPointerDown={e => e.currentTarget.style.transform = "translateY(-6px) scale(.94)"}
                  onPointerUp={e => e.currentTarget.style.transform = "translateY(-8px) scale(1)"}
                >
                  <Icon name="plus" size={22} />
                </button>
              </div>
            );
          }

          /* Tab normal */
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleNav(tab.id)}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 3,
                height: "100%", border: "none", background: "none",
                cursor: "pointer",
                color: isActive ? "var(--violet-hi)" : "var(--tx-3)",
                transition: "color .15s",
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                display: "grid", placeItems: "center",
                background: isActive ? "var(--violet-soft)" : "transparent",
                transition: "background .15s",
              }}>
                <Icon name={tab.icon} size={20} />
              </div>
              <span style={{
                fontSize: 10, fontWeight: isActive ? 700 : 500, letterSpacing: ".01em",
              }}>{tab.label}</span>
            </button>
          );
        })}

        {/* Botón "Más" */}
        <button
          onClick={() => setMasOpen(o => !o)}
          style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 3,
            height: "100%", border: "none", background: "none",
            cursor: "pointer",
            color: isMasActive || masOpen ? "var(--violet-hi)" : "var(--tx-3)",
            transition: "color .15s",
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            display: "grid", placeItems: "center",
            background: (isMasActive || masOpen) ? "var(--violet-soft)" : "transparent",
            transition: "background .15s",
          }}>
            <Icon name="grid" size={20} />
          </div>
          <span style={{ fontSize: 10, fontWeight: (isMasActive || masOpen) ? 700 : 500 }}>Más</span>
        </button>
      </nav>
    </>
  );
}
