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
const NAV = [
  { id: "dashboard", label: "Dashboard", short: "Inicio", icon: "home" },
  { id: "facultad",  label: "Facultad",  short: "Facultad", icon: "layers" },
  { id: "misiones",  label: "Misiones",  short: "Misión", icon: "bolt" },
  { id: "calendario",label: "Calendario",short: "Agenda", icon: "calendar" },
  { id: "tareas",    label: "Tareas",    short: "Tareas", icon: "check" },
  { id: "pomodoro",  label: "Pomodoro",  short: "Foco", icon: "clock" },
  { sep: true },
  { id: "chat",      label: "Chat IA",   short: "Chat", icon: "chat" },
  { id: "diario",    label: "Diario",    short: "Diario", icon: "pen" },
  { id: "espacio",   label: "Mi Espacio", short: "Espacio", icon: "box" },
  { id: "cocina",    label: "Cocina",    short: "Cocina", icon: "mug" },
  { id: "finanzas",  label: "Finanzas",  short: "Plata", icon: "coins" },
  { id: "casa",      label: "Casa",      short: "Casa", icon: "house" },
  { id: "ocio",      label: "Ocio",      short: "Ocio", icon: "sparkles" },
];

const Sidebar = ({ active, onNav, onLogout }) => {
  const [expanded, setExpanded] = React.useState(() => { try { return JSON.parse(localStorage.getItem("sh_sidebar")) ?? false; } catch { return false; } });
  const [tip, setTip] = React.useState(null);
  React.useEffect(() => { localStorage.setItem("sh_sidebar", JSON.stringify(expanded)); }, [expanded]);
  const showTip = (e, label) => { if (expanded) return; const r = e.currentTarget.getBoundingClientRect(); setTip({ label, top: r.top + r.height / 2, left: r.right + 12 }); };
  const hideTip = () => setTip(null);
  React.useEffect(() => { if (expanded) setTip(null); }, [expanded]);
  return (
    <aside className={`sidebar${expanded ? " expanded" : ""}`}>
      <div className="sidebar-brand">
        <img src="assets/logo.png" alt="StudyHub" />
        <div className="wordmark">
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, letterSpacing: "-.02em", lineHeight: 1.1 }}>Study<span style={{ color: "var(--violet-hi)" }}>Hub</span></div>
          <div className="mono" style={{ fontSize: 8.5, letterSpacing: ".22em", marginTop: 3 }}>Tu centro de estudio</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map((item, i) =>
          item.sep
            ? <div className="nav-sep" key={"s" + i}></div>
            : <div key={item.id}
                className={`nav-item${active === item.id ? " active" : ""}`}
                onClick={() => onNav(item.id)}
                onMouseEnter={e => showTip(e, item.label)} onMouseLeave={hideTip}>
                <Icon name={item.icon} /><span className="nav-label">{item.label}</span>
              </div>
        )}
      </nav>
      <div className="sidebar-foot">
        <div className="collapse-btn" onClick={() => setExpanded(e => !e)} title={expanded ? "Colapsar barra" : "Expandir barra"}>
          <Icon name={expanded ? "chevL" : "chevR"} />
        </div>
        <div className={`nav-item${active === "config" ? " active" : ""}`} onClick={() => onNav("config")} onMouseEnter={e => showTip(e, "Configuración")} onMouseLeave={hideTip}>
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

/* ---------- HEADER ---------- */
const Header = ({ profile, onNav, section }) => {
  const incomplete = !profile.uni || !profile.career;
  return (
    <header className="header">
      <div className="row" style={{ gap: 10, flex: "0 0 auto", cursor: "pointer" }} onClick={() => onNav("config")}>
        <div className="avatar">{profile.initial || profile.name[0]}</div>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{profile.name}</div>
          <div style={{ fontSize: 10.5, color: incomplete ? "var(--violet-hi)" : "var(--tx-3)" }}>{incomplete ? "+ Completar perfil" : profile.career}</div>
        </div>
      </div>
      <div style={{ flex: 1 }}></div>
      <div className="searchbar">
        <Icon name="search" size={16} />
        <input placeholder="Buscar…" />
        <span className="kbd">⌘K</span>
      </div>
      <div style={{ flex: 1 }}></div>
      <Chip accent dot><Icon name="fire" size={11} /> racha 1</Chip>
      <div className="icon-btn" onClick={() => onNav("chat")} title="Chat IA"><Icon name="chat" size={17} /></div>
      <div className="icon-btn" title="Notificaciones"><Icon name="bell" size={17} /></div>
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

const Empty = ({ icon = "layout", title, sub }) => (
  <div className="empty">
    <div>
      <div style={{ color: "var(--tx-3)" }}><Icon name={icon} size={36} /></div>
      <div className="h3" style={{ marginTop: 14 }}>{title}</div>
      {sub && <div className="small" style={{ marginTop: 7, maxWidth: 340, textWrap: "pretty" }}>{sub}</div>}
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

Object.assign(window, {
  TerminalCorners, ProgressRing, Btn, Chip, MonoLabel,
  Sidebar, Header, AppearanceControl, PageHead, Seg, Field,
  Modal, Toggle, Empty, SubjectDot, BrandBanner,
  NAV, FONT_OPTS, ACCENT_OPTS, VARIANT_OPTS,
});
