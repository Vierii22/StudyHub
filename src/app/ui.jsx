import React from 'react';

import { Icon } from './icons.jsx';

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
  <div style={{ marginBottom: 18 }}>
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
  { id: "notas",      label: "Progreso" },
  { id: "ocio",       label: "Pelis" },
];
const Header = ({ profile, onNav, section }) => {
  const initial = profile.initial || (profile.name ? profile.name[0] : "?");
  return (
    <header className="topbar">
      <div className="tb-brand" onClick={() => onNav("dashboard")}>
        {/* LOGO: cambiar acá cuando esté el ícono final */}
        <span className="tb-logo"><span className="tb-dot" /></span>
        <span className="tb-word"><span className="w1">study</span><span className="w2">hub</span><span className="w3">.</span></span>
      </div>
      <nav className="tb-nav">
        {TOPNAV.map(it => (
          <span key={it.id} className={`tb-item${section === it.id ? " active" : ""}`} onClick={() => onNav(it.id)}>{it.label}</span>
        ))}
      </nav>
      <div className="tb-right">
        <div className="icon-btn" onClick={() => onNav("chat")} title="Hubby"><Icon name="chat" size={17} /></div>
        <div className="tb-avatar" onClick={() => onNav("config")} title="Tu perfil">{initial}</div>
      </div>
    </header>
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
      {footer && <div className="row between" style={{ marginTop: 24, borderTop: "1px solid var(--line)", paddingTop: 20 }}>{footer}</div>}
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


export {
  TerminalCorners, Btn, Chip, MonoLabel, Hubby,
  Header, PageHead, Seg, Field,
  Modal, Toggle, Empty, SubjectDot,
};