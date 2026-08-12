import React from 'react';

import { Icon } from './icons.jsx';
import { usePWAInstall } from './pwaInstall.js';

/* ============================================================
   UI PRIMITIVES
   ============================================================ */

const TerminalCorners = () => (
  <>
    <span className="tc tc-tl"></span>
    <span className="tc tc-tr"></span>
    <span className="tc tc-bl"></span>
    <span className="tc tc-br"></span>
  </>
);

const Btn = ({ variant = "secondary", icon, children, size, ...rest }) => (
  <button className={`btn btn-${variant}${size ? " btn-" + size : ""}`} {...rest}>
    {icon && <Icon name={icon} size={16} />}{children}
  </button>
);

const Chip = ({ accent, dot, children }) => (
  <span className={`chip${accent ? " chip-accent" : ""}${dot ? " chip-dot" : ""}`}>{children}</span>
);

const MonoLabel = ({ children, accent }) => (
  <div className={`mono${accent ? " mono-accent" : ""}`}>{children}</div>
);

const Field = ({ label, hint, children }) => (
  <div style={{ marginBottom: 18, minWidth: 0 }}>
    <div className="row between" style={{ marginBottom: 9 }}>
      <div className="mono">{label}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--tx-3)" }}>{hint}</div>}
    </div>
    {children}
  </div>
);

const Seg = ({ opts, value, onChange }) => (
  <div className="seg" style={{ display: "flex", width: "100%" }}>
    {opts.map(o => (
      <button key={o.id} className={value === o.id ? "on" : ""} style={{ flex: 1 }}
        onClick={() => onChange(o.id)}>{o.label}</button>
    ))}
  </div>
);

/* ---------- TOP NAV (barra de arriba — reemplaza el sidebar viejo) ---------- */
const TOPNAV = [
  { id: "dashboard",  label: "Hoy" },
  { id: "calendario", label: "Calendario" },
  { id: "facultad",   label: "Facultad" },
  { id: "tareas",     label: "Tareas" },
  { id: "notas",      label: "Progreso" },
  { id: "ocio",       label: "Ocio" },
];
const Header = ({ profile, onNav, section, onMenu }) => {
  const initial = profile.initial || (profile.name ? profile.name[0] : "?");
  return (
    <header className="topbar">
      <button className="tb-burger" onClick={onMenu} aria-label="Abrir menú"><Icon name="menu" size={22} /></button>
      <div className="tb-brand" onClick={() => onNav("dashboard")}>
        <img src="/assets/icon.png" alt="" className="tb-logo" />
        <span className="tb-word"><span className="w1">study</span><span className="w2">hub</span><span className="w3">.</span></span>
      </div>
      <nav className="tb-nav">
        {TOPNAV.map(it => (
          <span key={it.id} className={`tb-item${section === it.id ? " active" : ""}`} onClick={() => onNav(it.id)}>{it.label}</span>
        ))}
      </nav>
      <div className="tb-right">
        <div className="tb-avatar" onClick={() => onNav("config")} title="Tu perfil">{initial}</div>
      </div>
    </header>
  );
};

/* ---------- MENÚ MOBILE a pantalla completa (reemplaza la tab bar) ---------- */
const MENU_SECTIONS = [
  { id: "dashboard",  label: "Hoy",        icon: "home" },
  { id: "calendario", label: "Calendario", icon: "calendar" },
  { id: "facultad",   label: "Facultad",   icon: "layers" },
  { id: "tareas",     label: "Tareas",     icon: "check" },
  { id: "notas",      label: "Progreso",   icon: "target" },
  { id: "ocio",       label: "Ocio",       icon: "film" },
];
/* instrucciones para instalar cuando el navegador no tiene prompt nativo (iOS Safari u otros) */
const InstallInstructionsModal = ({ ios, onClose }) => (
  <Modal title="Instalar StudyHub" icon="download" onClose={onClose}
    footer={<Btn variant="primary" onClick={onClose}>Entendido</Btn>}>
    {ios ? (
      <div style={{ display: "grid", gap: 14 }}>
        <div className="small" style={{ lineHeight: 1.6 }}>En Safari, tocá el ícono de <b className="tx-1">Compartir</b> (el cuadrado con la flecha hacia arriba, abajo en el medio) y después <b className="tx-1">"Agregar a pantalla de inicio"</b>.</div>
        <div className="row" style={{ gap: 12, padding: "12px 14px", background: "var(--field)", borderRadius: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--card)", border: "1px solid var(--line)", display: "grid", placeItems: "center", flex: "0 0 auto", color: "var(--org)" }}><Icon name="send" size={17} /></div>
          <div className="small" style={{ color: "var(--tx-2)" }}>Compartir → Agregar a pantalla de inicio → Agregar</div>
        </div>
      </div>
    ) : (
      <div className="small" style={{ lineHeight: 1.6 }}>Buscá la opción <b className="tx-1">"Instalar app"</b> o <b className="tx-1">"Agregar a pantalla de inicio"</b> en el menú de tu navegador (⋮ o ☰, según cuál uses).</div>
    )}
  </Modal>
);

const MobileMenu = ({ open, section, onNav, onClose }) => {
  const pwa = usePWAInstall();
  const [showInstructions, setShowInstructions] = React.useState(false);
  if (!open) return null;
  const go = (id) => { onNav(id); onClose(); };
  const install = async () => {
    if (pwa.canPrompt) { await pwa.promptInstall(); return; }
    setShowInstructions(true);
  };
  return (
    <div className="mobmenu" role="dialog" aria-modal="true">
      <div className="mobmenu-top">
        <span className="mobmenu-logo">studyhub<span>.</span></span>
        <button className="mobmenu-x" onClick={onClose} aria-label="Cerrar menú"><Icon name="x" size={22} /></button>
      </div>
      <nav className="mobmenu-list">
        {MENU_SECTIONS.map(it => (
          <button key={it.id} className={`mobmenu-item${section === it.id ? " active" : ""}`} onClick={() => go(it.id)}>
            <Icon name={it.icon} size={22} /> {it.label}
          </button>
        ))}
      </nav>
      <div className="mobmenu-foot">
        <button className="mobmenu-hubby" onClick={() => go("chat")}><Icon name="chat" size={20} /> Hablar con Hubby</button>
        {!pwa.isStandalone && (
          <button className="mobmenu-install" onClick={install}><Icon name="download" size={18} /> Instalar la app</button>
        )}
        <button className="mobmenu-cfg" onClick={() => go("config")}><Icon name="gear" size={19} /> Configuración</button>
      </div>
      {showInstructions && <InstallInstructionsModal ios={pwa.isIOS} onClose={() => setShowInstructions(false)} />}
    </div>
  );
};

/* ---------- PAGE HEAD ---------- */
const PageHead = ({ title, meta, children }) => (
  <div className="toolbar">
    <div className="t-title">{title}</div>
    {meta && <div className="t-meta">{meta}</div>}
    <div style={{ flex: 1 }}></div>
    {children && <div className="wrap-gap">{children}</div>}
  </div>
);

/* ---------- HELPERS REUTILIZABLES ---------- */
const Modal = ({ title, sub, icon, onClose, children, footer, wide, corners }) => (
  <div className="overlay" onClick={onClose}>
    <div className={`modal${corners ? " tcorners" : ""}`} style={{ width: wide ? "min(820px,100%)" : "min(560px,100%)" }} onClick={e => e.stopPropagation()}>
      {corners && <TerminalCorners />}
      <div className="row between" style={{ marginBottom: children ? 22 : 0 }}>
        <div className="row" style={{ gap: 14 }}>
          {icon && <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--surface-2)", display: "grid", placeItems: "center", color: "var(--violet-hi)" }}><Icon name={icon} size={20} /></div>}
          <div>
            <div className="h2">{title}</div>
            {sub && <div className="mono" style={{ marginTop: 6 }}>{sub}</div>}
          </div>
        </div>
        <div className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></div>
      </div>
      {children}
      {footer && <div className="row between modal-footer">{footer}</div>}
    </div>
  </div>
);

const Toggle = ({ on, onChange }) => (
  <div onClick={() => onChange(!on)} style={{ width: 44, height: 26, borderRadius: 99, background: on ? "var(--violet)" : "var(--surface-3)", padding: 3, cursor: "pointer", transition: "background .16s ease", flex: "0 0 auto" }}>
    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", transform: on ? "translateX(18px)" : "none", transition: "transform .16s ease" }}></div>
  </div>
);

/* ---------- HUBBY (mascota) ---------- */
/* poses: saluda · pensando · festejo · contento · vamos · idea · duerme · idle · chat */
const Hubby = ({ pose = "idle", size = 72, className = "", style }) => (
  <img src={`/assets/hubby/hubby-${pose}.png`} alt="Hubby" width={size} height={size}
    className={`hubby ${className}`} style={{ objectFit: "contain", ...style }} draggable="false" />
);

const Empty = ({ icon, hubby, title, sub, action, onAction }) => (
  <div className="empty">
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      {hubby
        ? <Hubby pose={hubby} size={92} />
        : <div style={{ color: "var(--tx-3)" }}><Icon name={icon || "layout"} size={36} /></div>}
      <div className="h3" style={{ marginTop: hubby ? 10 : 16, fontSize: 16 }}>{title}</div>
      {sub && <div className="small" style={{ marginTop: 7, maxWidth: 320, textWrap: "pretty", lineHeight: 1.6 }}>{sub}</div>}
      {action && <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={onAction}>{action}</button>}
    </div>
  </div>
);

const SubjectDot = ({ s, size = 46 }) => (
  <div className="subject-icon" style={{ background: s.color, width: size, height: size, fontSize: size * 0.42, borderRadius: size * 0.26 }}>{s.name[0]}</div>
);

/* ---------- DATE PICKER — calendario clickeable (sin tipear) ---------- */
const DP_MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DP_DOW    = ["L","M","M","J","V","S","D"];
const dpISO   = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const dpParse = (iso) => { if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null; const [y, m, d] = iso.split("-").map(Number); return { y, m: m - 1, d }; };
const dpFmt   = (iso) => { const p = dpParse(iso); return p ? `${p.d} de ${DP_MONTHS[p.m].toLowerCase()} ${p.y}` : ""; };

const DatePicker = ({ value, onChange, placeholder = "Elegir fecha", allowClear = true }) => {
  const [open, setOpen] = React.useState(false);
  const sel = dpParse(value);
  const today = new Date();
  const todayISO = dpISO(today.getFullYear(), today.getMonth(), today.getDate());
  const [view, setView] = React.useState(() => sel ? { y: sel.y, m: sel.m } : { y: today.getFullYear(), m: today.getMonth() });

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const offset = (new Date(view.y, view.m, 1).getDay() + 6) % 7; /* lunes primero */
  const prevM = () => setView(v => v.m === 0  ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 });
  const nextM = () => setView(v => v.m === 11 ? { y: v.y + 1, m: 0  } : { y: v.y, m: v.m + 1 });
  const pick  = (d) => { onChange(dpISO(view.y, view.m, d)); setOpen(false); };

  return (
    <div className="dp">
      <button type="button" className={`dp-trigger${value ? " has" : ""}`} onClick={() => setOpen(o => !o)}>
        <Icon name="calendar" size={15} />
        <span className="dp-val">{value ? dpFmt(value) : placeholder}</span>
        {value && allowClear
          ? <span className="dp-clear" title="Quitar fecha" onClick={e => { e.stopPropagation(); onChange(""); }}><Icon name="x" size={13} /></span>
          : <Icon name="chevron" size={14} />}
      </button>
      {open && (
        <div className="dp-pop">
          <div className="dp-head">
            <button type="button" className="dp-nav" onClick={prevM}><Icon name="chevL" size={16} /></button>
            <span className="dp-month">{DP_MONTHS[view.m]} {view.y}</span>
            <button type="button" className="dp-nav" onClick={nextM}><Icon name="chevR" size={16} /></button>
          </div>
          <div className="dp-grid dp-dow">{DP_DOW.map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="dp-grid">
            {Array.from({ length: offset }).map((_, i) => <span key={"b" + i} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
              const iso = dpISO(view.y, view.m, d);
              return (
                <button type="button" key={d}
                  className={`dp-day${value === iso ? " sel" : ""}${todayISO === iso ? " today" : ""}`}
                  onClick={() => pick(d)}>{d}</button>
              );
            })}
          </div>
          <div className="dp-foot">
            <button type="button" className="dp-foot-btn" onClick={() => { onChange(todayISO); setOpen(false); }}>Hoy</button>
            {allowClear && value && <button type="button" className="dp-foot-btn ghost" onClick={() => { onChange(""); setOpen(false); }}>Sin fecha</button>}
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------- HUBBY CHAT FAB — entrada al chat, abajo a la izquierda ---------- */
const HubbyChatFab = ({ section, onNav }) => {
  if (section === "chat") return null; /* ya estás en el chat */
  return (
    <button className="hubby-fab" onClick={() => onNav("chat")} title="Hablar con Hubby" aria-label="Abrir chat con Hubby">
      <Hubby pose="chat" size={44} />
    </button>
  );
};

export {
  TerminalCorners, Btn, Chip, MonoLabel, Hubby, HubbyChatFab,
  Header, MobileMenu, PageHead, Seg, Field,
  Modal, Toggle, Empty, SubjectDot, DatePicker,
  InstallInstructionsModal,
};