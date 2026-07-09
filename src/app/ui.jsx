import React from 'react';

import ReactDOM from 'react-dom';
import { Icon } from './icons.jsx';
import { Store, useStore, uid, scaleToZoom, toast, COLORS, ALL_WIDGETS, PomoStore, usePomoStore, getStreak } from './store.jsx';

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

const ProgressRing = ({ value = 70, size = 96, stroke = 7, light = false, label }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle className="ring-track" cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={stroke}/>
        <circle className="ring-fill" cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center",
        fontFamily:"var(--font-display)", fontWeight:700, fontSize:size*0.2,
        color: light ? "#fff" : "var(--tx-1)" }}>
        {label != null ? label : value + "%"}
      </div>
    </div>
  );
};

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

/* ---------- SIDEBAR ---------- */
/* 5 ítems principales + grupo "Vida" colapsable */
const NAV_MAIN = [
  { id: "dashboard",  label: "Hoy",      short: "Hoy",     icon: "home" },
  { id: "facultad",   label: "Facultad", short: "Facultad",icon: "layers" },
  { id: "tareas",     label: "Tareas",   short: "Tareas",  icon: "check" },
  { id: "pomodoro",   label: "Enfoque",  short: "Foco",    icon: "clock" },
  { id: "chat",       label: "Hubby",    short: "Hubby",   icon: "chat" },
];
const NAV_VIDA = [
  { id: "diario",    label: "Diario",    icon: "pen" },
  { id: "cocina",    label: "Cocina",    icon: "mug" },
  { id: "finanzas",  label: "Finanzas",  icon: "coins" },
  { id: "casa",      label: "Casa",      icon: "house" },
  { id: "ocio",      label: "Ocio",      icon: "sparkles" },
];
const NAV_EXTRA = [
  { id: "misiones",  label: "Misiones",  icon: "bolt" },
  { id: "calendario",label: "Calendario",icon: "calendar" },
  { id: "espacio",   label: "Mi Espacio",icon: "box" },
  { id: "historial", label: "Historial", icon: "clock" },
];
/* Array plano para mantener compatibilidad con TabBar y otras referencias */
const NAV = [
  ...NAV_MAIN,
  { sep: true },
  ...NAV_VIDA,
];

const Sidebar = ({ active, onNav, onLogout, isOpen, onClose }) => {
  const [expanded, setExpanded] = React.useState(() => { try { return JSON.parse(localStorage.getItem("sh_sidebar")) ?? false; } catch { return false; } });
  const [vidaOpen, setVidaOpen] = React.useState(() => { try { return JSON.parse(localStorage.getItem("sh_vida")) ?? true; } catch { return true; } });
  const [tip, setTip] = React.useState(null);
  React.useEffect(() => { localStorage.setItem("sh_sidebar", JSON.stringify(expanded)); }, [expanded]);
  React.useEffect(() => { localStorage.setItem("sh_vida", JSON.stringify(vidaOpen)); }, [vidaOpen]);
  const showTip = (e, label) => { if (expanded) return; const r = e.currentTarget.getBoundingClientRect(); setTip({ label, top: r.top + r.height / 2, left: r.right + 12 }); };
  const hideTip = () => setTip(null);
  React.useEffect(() => { if (expanded) setTip(null); }, [expanded]);

  const handleNav = (id) => { onNav(id); if (onClose) onClose(); };
  const isVidaActive = NAV_VIDA.some(item => item.id === active);
  const isExtraActive = NAV_EXTRA.some(item => item.id === active);

  const NavItem = ({ item }) => (
    <div
      key={item.id}
      data-tour={item.id}
      className={`nav-item${active === item.id ? " active" : ""}`}
      onClick={() => handleNav(item.id)}
      onMouseEnter={e => showTip(e, item.label)} onMouseLeave={hideTip}
    >
      <Icon name={item.icon} /><span className="nav-label">{item.label}</span>
    </div>
  );

  return (
    <React.Fragment>
      <div className={`sidebar-backdrop${isOpen ? " visible" : ""}`} onClick={onClose} />

      <aside className={`sidebar${expanded ? " expanded" : ""}${isOpen ? " mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <img src="assets/logo.png" alt="StudyHub" />
          <div className="wordmark">
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, letterSpacing: "-.02em", lineHeight: 1.1 }}>Study<span style={{ color: "var(--violet-hi)" }}>Hub</span></div>
            <div className="mono" style={{ fontSize: 8.5, letterSpacing: ".22em", marginTop: 3 }}>Tu centro de estudio</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {/* 5 ítems principales */}
          {NAV_MAIN.map(item => <NavItem key={item.id} item={item} />)}

          {/* ── Grupo Vida ── */}
          <div className="nav-sep" />
          <div
            className={`nav-item${isVidaActive ? " active" : ""}`}
            onClick={() => setVidaOpen(v => !v)}
            onMouseEnter={e => showTip(e, "Vida")} onMouseLeave={hideTip}
            style={{ justifyContent: "space-between" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="sparkles" />
              <span className="nav-label">Vida</span>
            </div>
            <span className="nav-label" style={{ fontSize: 10, color: "var(--tx-3)", transition: "transform .2s", transform: vidaOpen ? "rotate(90deg)" : "none" }}>
              <Icon name="chevR" size={12} />
            </span>
          </div>
          {vidaOpen && NAV_VIDA.map(item => (
            <div
              key={item.id}
              data-tour={item.id}
              className={`nav-item nav-sub${active === item.id ? " active" : ""}`}
              onClick={() => handleNav(item.id)}
              onMouseEnter={e => showTip(e, item.label)} onMouseLeave={hideTip}
            >
              <Icon name={item.icon} size={15} /><span className="nav-label">{item.label}</span>
            </div>
          ))}

          {/* ── Extras (misiones, calendario, espacio, historial) ── */}
          <div className="nav-sep" />
          {NAV_EXTRA.map(item => <NavItem key={item.id} item={item} />)}
        </nav>

        <div className="sidebar-foot">
          <div className="collapse-btn" onClick={() => setExpanded(e => !e)} title={expanded ? "Colapsar barra" : "Expandir barra"}>
            <Icon name={expanded ? "chevL" : "chevR"} />
          </div>
          <div data-tour="config" className={`nav-item${active === "config" ? " active" : ""}`} onClick={() => handleNav("config")} onMouseEnter={e => showTip(e, "Configuración")} onMouseLeave={hideTip}>
            <Icon name="gear" /><span className="nav-label">Configuración</span>
          </div>
          <div className="nav-item" onClick={onLogout} onMouseEnter={e => showTip(e, "Cerrar sesión")} onMouseLeave={hideTip} style={{ color: "#e8639b" }}>
            <Icon name="logout" /><span className="nav-label">Salir</span>
          </div>
        </div>
        {tip && !expanded && (
          <div style={{ position: "fixed", left: tip.left, top: tip.top, transform: "translateY(-50%)", zIndex: 90,
            background: "#1d1d25", color: "var(--tx-1)", border: "1px solid var(--line-2)",
            fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
            padding: "6px 11px", borderRadius: 9, pointerEvents: "none",
            boxShadow: "0 10px 26px -10px rgba(0,0,0,.7)" }}>{tip.label}</div>
        )}
      </aside>
    </React.Fragment>
  );
};

/* ---------- APPEARANCE CONTROL (header popover) ---------- */
const FONT_OPTS = [
  { id: "outfit",      label: "Outfit",        hint: "Una sola familia" },
  { id: "outfit-mono", label: "Outfit + Mono", hint: "Labels en JetBrains Mono" },
  { id: "grotesk",     label: "Space Grotesk", hint: "Display seria + Mono" },
];
const ACCENT_OPTS = [
  { id: "gradient", label: "Gradiente" },
  { id: "mix",      label: "Mix" },
];
const VARIANT_OPTS = [
  { id: "editorial", label: "Editorial" },
  { id: "grid",      label: "Grilla" },
  { id: "focus",     label: "Foco" },
];

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

const AppearanceControl = ({ open, onClose, theme, setTheme }) => {
  if (!open) return null;
  return (
    <div className="pop tcorners" onClick={e => e.stopPropagation()}>
      <TerminalCorners />
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="h3">Apariencia</div>
        <div className="icon-btn" style={{ width: 30, height: 30 }} onClick={onClose}><Icon name="x" size={15} /></div>
      </div>
      <Field label="Tipografía">
        <div style={{ display: "grid", gap: 7 }}>
          {FONT_OPTS.map(o => (
            <button key={o.id}
              onClick={() => setTheme("font", o.id)}
              className="row between"
              style={{ textAlign: "left", cursor: "pointer", padding: "10px 13px", borderRadius: 10,
                border: "1px solid " + (theme.font === o.id ? "var(--violet-line)" : "var(--line)"),
                background: theme.font === o.id ? "var(--violet-soft)" : "var(--surface-2)", color: "var(--tx-1)" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{o.label}</div>
                <div style={{ fontSize: 11.5, color: "var(--tx-3)" }}>{o.hint}</div>
              </div>
              {theme.font === o.id && <Icon name="check" size={17} color="var(--violet-hi)" />}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Acento" hint="Violeta único">
        <Seg opts={ACCENT_OPTS} value={theme.accent} onChange={v => setTheme("accent", v)} />
      </Field>
      <Field label="Variante de dashboard">
        <Seg opts={VARIANT_OPTS} value={theme.variant} onChange={v => setTheme("variant", v)} />
      </Field>
    </div>
  );
};

/* ---------- SYNC STATUS CHIP ---------- */
const SyncChip = () => {
  const [status, setStatus] = React.useState(navigator.onLine ? "ok" : "offline");
  React.useEffect(() => {
    const handler = (e) => setStatus(e.detail);
    window.addEventListener("sh:sync-status", handler);
    window.addEventListener("online",  () => setStatus("syncing"));
    window.addEventListener("offline", () => setStatus("offline"));
    return () => window.removeEventListener("sh:sync-status", handler);
  }, []);
  if (status === "ok") return null;
  const label = status === "offline" ? "Sin conexión" : "Sincronizando…";
  const color  = status === "offline" ? "#e8639b" : "#e8b04e";
  return (
    <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color, padding: "3px 9px", borderRadius: 99, border: `1px solid ${color}55`, background: `${color}15`, whiteSpace: "nowrap" }}>
      {label}
    </div>
  );
};

/* ---------- TOP NAV (barra de arriba — reemplaza el sidebar viejo) ---------- */
const TOPNAV = [
  { id: "dashboard",  label: "Hoy" },
  { id: "calendario", label: "Calendario" },
  { id: "facultad",   label: "Facultad" },
  { id: "notas",      label: "Progreso" },
  { id: "ocio",       label: "Pelis" },
];
const Header = ({ profile, onNav, section, onToggleSidebar, onOpenPalette }) => {
  const isMac = navigator.platform?.toUpperCase().includes("MAC");
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

/* ---------- HUBBY PLACEHOLDER (mascota, futuras poses) ---------- */
const HubbyIcon = ({ size = 48, mood = "idle" }) => {
  const colors = {
    idle:      { body: "#8b6dff", pupils: "#fff" },
    happy:     { body: "#3ecf9a", pupils: "#fff" },
    sleepy:    { body: "#5d5d68", pupils: "#fff" },
    focused:   { body: "#4ec5e8", pupils: "#fff" },
    worried:   { body: "#e8639b", pupils: "#fff" },
  };
  const c = colors[mood] || colors.idle;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="22" fill={c.body} />
      <ellipse cx="17" cy="22" rx="3.5" ry={mood === "sleepy" ? 1.5 : 3.5} fill={c.pupils} />
      <ellipse cx="31" cy="22" rx="3.5" ry={mood === "sleepy" ? 1.5 : 3.5} fill={c.pupils} />
      <circle cx="17" cy="23" r="1.5" fill={c.body} />
      <circle cx="31" cy="23" r="1.5" fill={c.body} />
      {mood === "happy" && <path d="M17 30 Q24 36 31 30" stroke={c.pupils} strokeWidth="2" strokeLinecap="round" fill="none" />}
      {mood === "worried" && <path d="M17 32 Q24 28 31 32" stroke={c.pupils} strokeWidth="2" strokeLinecap="round" fill="none" />}
      {mood === "sleepy" && <path d="M19 31 Q24 33 29 31" stroke={c.pupils} strokeWidth="2" strokeLinecap="round" fill="none" />}
      {(mood === "idle" || mood === "focused") && <path d="M18 30 Q24 34 30 30" stroke={c.pupils} strokeWidth="2" strokeLinecap="round" fill="none" />}
    </svg>
  );
};

const Empty = ({ icon, hubby, title, sub, action, onAction }) => (
  <div className="empty">
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      {hubby
        ? <HubbyIcon size={56} mood={hubby} />
        : <div style={{ color: "var(--tx-3)" }}><Icon name={icon || "layout"} size={36} /></div>}
      <div className="h3" style={{ marginTop: 16, fontSize: 16 }}>{title}</div>
      {sub && <div className="small" style={{ marginTop: 7, maxWidth: 320, textWrap: "pretty", lineHeight: 1.6 }}>{sub}</div>}
      {action && <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={onAction}>{action}</button>}
    </div>
  </div>
);

const SubjectDot = ({ s, size = 46 }) => (
  <div className="subject-icon" style={{ background: s.color, width: size, height: size, fontSize: size * 0.42, borderRadius: size * 0.26 }}>{s.name[0]}</div>
);

/* ---------- BRAND BANNER ---------- */
const BrandBanner = ({ size = "md", children }) => (
  <div className={`brand-banner tcorners${size === "lg" ? " lg" : ""}`}>
    <TerminalCorners />
    <img src="assets/logo.png" alt="StudyHub" />
    <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
      <div className="brand-wm">Study<span className="grad">Hub</span></div>
      <div className="brand-tag">Tu centro de estudio</div>
      {children}
    </div>
  </div>
);

/* ---------- COLOR PICKER ---------- */
const ColorPicker = ({ value = COLORS[0], onChange, label }) => (
  <Field label={label || "Color"}>
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      {COLORS.map(color => (
        <div
          key={color}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: color,
            cursor: "pointer",
            border: value === color ? "2px solid #fff" : "2px solid transparent",
            transition: "border .2s",
          }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  </Field>
);

/* ---------- PHOTO UPLOADER ---------- */
const PhotoUploader = ({ photos = [], onAdd, onRemove, label }) => (
  <Field label={label || "Fotos"}>
    <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
      {photos.map((photo, i) => (
        <div
          key={i}
          style={{
            width: 60,
            height: 60,
            borderRadius: 8,
            backgroundImage: `url(${photo})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            position: "relative",
            cursor: "pointer",
          }}
          onClick={() => onRemove(i)}
        >
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              background: "#e8639b",
              color: "#fff",
              width: 20,
              height: 20,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ✕
          </span>
        </div>
      ))}
      <label
        style={{
          width: 60,
          height: 60,
          borderRadius: 8,
          border: "2px dashed var(--line)",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          color: "var(--tx-3)",
          fontSize: 24,
        }}
      >
        ＋
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={e => {
            const file = e.target.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = ev => onAdd(ev.target.result);
              reader.readAsDataURL(file);
            }
          }}
        />
      </label>
    </div>
  </Field>
);

/* ---------- IMAGE PICKER (para backgrounds) ---------- */
const ImagePicker = ({ value, onChange, label }) => (
  <Field label={label || "Imagen de fondo"}>
    <div style={{ display: "grid", gap: 10 }}>
      <label style={{ cursor: "pointer" }}>
        <div
          style={{
            width: "100%",
            height: 120,
            borderRadius: 8,
            border: "2px dashed var(--line)",
            backgroundImage: value ? `url(${value})` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
            display: "grid",
            placeItems: "center",
            color: "var(--tx-3)",
            fontSize: 32,
          }}
        >
          {!value && "📷"}
        </div>
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={e => {
            const file = e.target.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = ev => onChange(ev.target.result);
              reader.readAsDataURL(file);
            }
          }}
        />
      </label>
      {value && <Btn variant="secondary" size="sm" onClick={() => onChange(null)}>Quitar fondo</Btn>}
    </div>
  </Field>
);

/* ---------- BOTTOM SHEET ---------- */
/* Versión mobile-first de Modal: se desliza desde abajo con handle.
   En desktop se comporta como un modal centrado normal. */
const Sheet = ({ open, onClose, title, children, footer, snap = "auto" }) => {
  const [dragging, setDragging] = React.useState(false);
  const startY = React.useRef(0);
  const sheetRef = React.useRef(null);

  /* Cerrar con Escape */
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const onPointerDown = (e) => {
    startY.current = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging || !sheetRef.current) return;
    const delta = Math.max(0, e.clientY - startY.current);
    sheetRef.current.style.transform = `translateY(${delta}px)`;
  };
  const onPointerUp = (e) => {
    setDragging(false);
    const delta = e.clientY - startY.current;
    if (sheetRef.current) sheetRef.current.style.transform = "";
    if (delta > 80) onClose();
  };

  return (
    <div
      className="overlay"
      onClick={onClose}
      style={{ alignItems: "flex-end", padding: 0 }}
    >
      <div
        ref={sheetRef}
        className="modal"
        style={{
          width: "min(560px, 100%)",
          borderRadius: "22px 22px 0 0",
          padding: "0 0 env(safe-area-inset-bottom)",
          margin: 0,
          transition: dragging ? "none" : "transform .3s cubic-bezier(.2,.8,.2,1)",
          maxHeight: snap === "full" ? "95dvh" : "80dvh",
          overflowY: "auto",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle de arrastre */}
        <div
          style={{ padding: "14px 0 10px", cursor: "grab", touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div style={{
            width: 40, height: 4, background: "var(--line-2)",
            borderRadius: 99, margin: "0 auto",
          }} />
        </div>
        <div style={{ padding: "0 22px 22px" }}>
          {title && (
            <div className="row between" style={{ marginBottom: 18 }}>
              <div className="h2">{title}</div>
              <div className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></div>
            </div>
          )}
          {children}
          {footer && (
            <div className="row between" style={{ marginTop: 20, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


export {
  TerminalCorners, ProgressRing, Btn, Chip, MonoLabel,
  Sidebar, Header, AppearanceControl, PageHead, Seg, Field,
  Modal, Sheet, Toggle, Empty, SubjectDot, BrandBanner,
  ColorPicker, PhotoUploader, ImagePicker, HubbyIcon,
  NAV, FONT_OPTS, ACCENT_OPTS, VARIANT_OPTS,
};