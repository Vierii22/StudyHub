import React from 'react';

import ReactDOM from 'react-dom/client';
import { Icon } from './icons.jsx';
import { Store, useStore, toast, scaleToZoom, ToastHost } from './store.jsx';
import { Sidebar, Header } from './ui.jsx';
import { Login, Onboarding, ConfirmEmail } from './login.jsx';
import { Dashboard } from './dashboard2.jsx';
import { Facultad } from './facultad.jsx';
import { SubjectView } from './facultad2.jsx';
import { Tareas } from './tareas.jsx';
import { Calendario } from './sections.jsx';
import { ChatIA } from './sections2.jsx';
import { Ocio } from './sections3.jsx';
import { ConfigSection } from './config.jsx';
import { Landing } from './landing.jsx';
import { Tutorial, TUTORIAL_KEY } from './tutorial.jsx';
import { FeedbackWidget } from './feedback.jsx';
import { TabBar } from './tabbar.jsx';
import { Palette } from './palette.jsx';
import { supabase } from '../supabase.js';

/* ============================================================
   APP ROOT — auth Supabase + router + tema + zoom + acento
   ============================================================ */
const { useState, useEffect, useRef } = React;
const DEFAULT_THEME = { font: "outfit-mono", accent: "gradient", variant: "editorial", namedTheme: "medianoche" };
const load = (k, f) => { try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch { return f; } };

const ACCENTS = {
  violet: { v: "#8b6dff", v2: "#c264e8", hi: "#a48cff" },
  blue:   { v: "#4ec5e8", v2: "#6d8bff", hi: "#7ed8f0" },
  orange: { v: "#f0764e", v2: "#e8b04e", hi: "#f59b78" },
  green:  { v: "#3ecf9a", v2: "#4ec5e8", hi: "#6fe0b6" },
  red:    { v: "#e8639b", v2: "#c264e8", hi: "#f08bb6" },
  indigo: { v: "#6d8bff", v2: "#8b6dff", hi: "#93a9ff" },
};

/* pantalla de carga mientras se verifica la sesión */
function LoadingScreen() {
  return (
    <div style={{ height: "100%", display: "grid", placeItems: "center", background: "var(--bg)" }}>
      <div style={{ textAlign: "center" }}>
        <img src="assets/logo.png" alt="StudyHub" style={{ width: 64, height: 64, borderRadius: 18, boxShadow: "0 16px 40px -14px rgba(139,109,255,.8)", marginBottom: 20 }} />
        <div className="mono" style={{ color: "var(--tx-3)", letterSpacing: ".2em" }}>CARGANDO…</div>
      </div>
    </div>
  );
}

/* Error Boundary — atrapa crashes de React y muestra pantalla de recuperación
   en vez de pantalla negra */
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[StudyHub] Error capturado por boundary:", error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ height: "100%", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 460 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💥</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
            Algo salió mal
          </div>
          <div style={{ fontSize: 14, color: "var(--tx-2)", marginBottom: 6, lineHeight: 1.6 }}>
            La app encontró un error inesperado. Tus datos están guardados — recargá la página para continuar.
          </div>
          <details style={{ marginBottom: 22, textAlign: "left", background: "var(--surface-2)", borderRadius: 10, padding: "10px 14px", cursor: "pointer" }}>
            <summary style={{ fontSize: 12, color: "var(--tx-3)", fontFamily: "var(--font-mono)" }}>Ver detalle del error</summary>
            <pre style={{ fontSize: 11, color: "#e8639b", marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {this.state.error?.message || String(this.state.error)}
            </pre>
          </details>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              🔄 Recargar
            </button>
            <button className="btn btn-secondary" onClick={() => {
              localStorage.removeItem("sh_data");
              window.location.reload();
            }}>
              🗑️ Limpiar datos y recargar
            </button>
          </div>
          <div style={{ marginTop: 14, fontSize: 11, color: "var(--tx-3)" }}>
            "Limpiar datos" solo si el error persiste — se van a re-descargar de la nube.
          </div>
        </div>
      </div>
    );
  }
}

function NotasStub() {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center" }}>
      <div className="h2" style={{ marginBottom: 8 }}>Notas del cuatrimestre</div>
      <div className="small" style={{ color: "var(--tx-2)" }}>En construcción — la rediseñamos en breve.</div>
    </div>
  );
}

function App() {
  /* auth: "loading" | "landing" | "login" | "confirm-email" | "onboarding" | "app" */
  const [auth, setAuth]   = useState("loading");
  const [pendingEmail, setPendingEmail] = useState(""); // email pendiente de confirmación
  const authRef = useRef("loading"); // ref para leer auth dentro de callbacks sin stale closure
  const [showTutorial, setShowTutorial] = useState(false);
  const [section, setSection] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("section") || "dashboard";
  });
  const [theme, setThemeState] = useState(() => {
    const t = load("sh_theme", DEFAULT_THEME);
    if (!localStorage.getItem("sh_layout_v2")) { t.variant = "editorial"; localStorage.setItem("sh_layout_v2", "1"); }
    /* migración v4: vuelta a Medianoche (el Carbón quedó como opción en Config) */
    if (!localStorage.getItem("sh_theme_v4")) { t.namedTheme = "medianoche"; localStorage.setItem("sh_theme_v4", "1"); }
    return t;
  });
  const [openSubject, setOpenSubject] = useState(null);
  const [morning, setMorning] = useState(false);
  const [dashEditSignal, setDashEditSignal] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [data] = useStore();

  /* mantener ref sincronizado con el estado real */
  useEffect(() => { authRef.current = auth; }, [auth]);

  /* ── Ctrl/Cmd+K → command palette ─────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ── auth Supabase ─────────────────────────────────── */
  useEffect(() => {
    const sb = supabase;
    if (!sb) { setAuth("landing"); return; }

    const checkProfile = () => {
      const raw = localStorage.getItem("sh_data");
      let hasProfile = false;
      try { hasProfile = !!JSON.parse(raw)?.profile?.name; } catch {}
      return hasProfile;
    };

    /* check sesión inicial */
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuth(checkProfile() ? "app" : "onboarding");
      } else {
        setAuth("landing");
      }
    });

    /*
     * Fix para dispositivo nuevo: cuando localStorage está vacío al cargar,
     * getSession() resuelve antes que _initialSync() en storage.js termine.
     * Cuando storage.js termina el sync, dispara sh:user-synced y acá
     * corregimos el estado si el usuario ya tenía perfil en la nube.
     */
    const onSynced = () => {
      if (checkProfile()) {
        setAuth(prev => (prev === "loading" || prev === "onboarding") ? "app" : prev);
      }
    };
    window.addEventListener("sh:user-synced", onSynced);

    /* escuchar cambios de sesión */
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setAuth("landing");
        setSection("dashboard");
      }
      /* Cuando el usuario confirma el email, Supabase dispara SIGNED_IN.
         Si estábamos esperando confirmación → avanzar al onboarding. */
      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session) {
        if (authRef.current === "confirm-email") {
          setAuth(checkProfile() ? "app" : "onboarding");
        }
      }
    });

    return () => {
      subscription?.unsubscribe();
      window.removeEventListener("sh:user-synced", onSynced);
    };
  }, []);

  /* ── tema ──────────────────────────────────────────── */
  useEffect(() => {
    const r = document.documentElement;
    r.setAttribute("data-font",       theme.font);
    r.setAttribute("data-accent",     theme.accent);
    r.setAttribute("data-variant",    theme.variant);
    r.setAttribute("data-theme",      theme.namedTheme || "medianoche");
    localStorage.setItem("sh_theme", JSON.stringify(theme));
  }, [theme]);

  /* ── zoom + acento desde settings ─────────────────── */
  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--ui-zoom", scaleToZoom(data.settings.uiScale));
    const ACCENT_VARS = ["--violet", "--violet-2", "--violet-hi", "--grad", "--violet-soft", "--violet-line"];
    /* Con el acento default ("violet") no pisamos nada: manda el tema con nombre.
       Solo si el usuario eligió un swatch distinto, ese acento gana sobre el tema. */
    if (!data.settings.accent || data.settings.accent === "violet") {
      ACCENT_VARS.forEach(p => r.removeProperty(p));
    } else {
      const a = ACCENTS[data.settings.accent] || ACCENTS.violet;
      r.setProperty("--violet",      a.v);
      r.setProperty("--violet-2",    a.v2);
      r.setProperty("--violet-hi",   a.hi);
      r.setProperty("--grad",        `linear-gradient(135deg, ${a.v} 0%, ${a.v2} 100%)`);
      r.setProperty("--violet-soft", a.v + "22");
      r.setProperty("--violet-line", a.v + "66");
    }
  }, [data.settings.uiScale, data.settings.accent]);

  /* sección NO persistida — siempre arranca en dashboard al abrir la app */

  /* ── tutorial (primera vez) ────────────────────────── */
  useEffect(() => {
    if (auth === "app" && !localStorage.getItem(TUTORIAL_KEY)) {
      const t = setTimeout(() => setShowTutorial(true), 600);
      return () => clearTimeout(t);
    }
  }, [auth]);

  /* ── morning modal ─────────────────────────────────── */
  /* No aparece el primer día de uso — solo desde el segundo día en adelante */
  useEffect(() => {
    if (auth === "app") {
      const today    = new Date().toDateString();
      const firstKey = "sh_app_first_date";
      const firstDate = localStorage.getItem(firstKey);
      if (!firstDate) {
        // Primer login ever: registrar fecha, no mostrar modal hoy
        localStorage.setItem(firstKey, today);
        return;
      }
      if (firstDate === today) return; // todavía es el primer día
      const key = "sh_morning_" + today;
      if (new Date().getHours() >= 5 && !localStorage.getItem(key)) {
        const t = setTimeout(() => {
          setMorning(true);
          localStorage.setItem(key, "1");
        }, 800);
        return () => clearTimeout(t);
      }
    }
  }, [auth]);

  const [configInitTab, setConfigInitTab] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const upd = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);
  const setTheme  = (k, v) => setThemeState(t => ({ ...t, [k]: v }));
  const nav = (s) => {
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        setOpenSubject(null); setSection(s); setSidebarOpen(false);
      });
    } else {
      setOpenSubject(null); setSection(s); setSidebarOpen(false);
    }
  };
  const navConfig = (tab)  => { setConfigInitTab(tab); nav("config"); };
  const logout    = ()     => {
    const sb = supabase;
    if (sb) sb.auth.signOut();
    /* storage.js limpia localStorage en SIGNED_OUT */
    Store.reset();
    toast("Sesión cerrada");
  };

  /* ── estados de carga / auth ───────────────────────── */
  if (auth === "loading") return <LoadingScreen />;

  if (auth === "landing") return (
    <>
      <Landing onStart={() => setAuth("login")} />
      <ToastHost />
    </>
  );

  if (auth === "login") return (
    <>
      <Login
        onEnter={() => setAuth("app")}
        onRegister={(email) => { setPendingEmail(email); setAuth("confirm-email"); }}
      />
      <ToastHost />
    </>
  );

  if (auth === "confirm-email") return (
    <>
      <ConfirmEmail email={pendingEmail} />
      <ToastHost />
    </>
  );

  if (auth === "onboarding") return (
    <>
      <Onboarding onDone={() => setAuth("app")} />
      <ToastHost />
    </>
  );

  /* ── renderizado de sección ────────────────────────── */
  const render = () => {
    if (section === "facultad" && openSubject)
      return <SubjectView subjectId={openSubject} onBack={() => setOpenSubject(null)} />;
    switch (section) {
      case "dashboard":  return <Dashboard key={dashEditSignal} variant={theme.variant} onNav={nav} onConnect={() => navConfig("integr")} />;
      case "facultad":   return <Facultad onOpenSubject={setOpenSubject} />;
      case "tareas":     return <Tareas   onOpenSubject={(id) => { setSection("facultad"); setOpenSubject(id); }} autoNew={new URLSearchParams(window.location.search).get("action") === "new"} />;
      case "calendario": return <Calendario />;
      case "chat":       return <ChatIA />;
      case "ocio":       return <Ocio />;
      case "notas":      return <NotasStub />;
      case "config":     return (
        <ConfigSection
          theme={theme}
          setTheme={setTheme}
          onEditDash={() => { setSection("dashboard"); setDashEditSignal(x => x + 1); toast('Tocá "Editar dashboard"'); }}
          onLogout={logout}
          onTutorial={() => { setShowTutorial(true); nav("dashboard"); }}
          initialTab={configInitTab}
          key={configInitTab || "config"}
        />
      );
      default: return <Dashboard variant={theme.variant} onNav={nav} onConnect={() => nav("config")} />;
    }
  };

  return (
    <div className={`app${isMobile ? " app-mobile" : ""}`} data-anim="on">
      {/* La navegación ahora es la barra de arriba (Header/topbar). Sidebar eliminado. */}
      <div className="main">
        <Header
          profile={data.profile}
          onNav={nav}
          section={section}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <div
          className="scroll scroll-zoom"
          key={section + (openSubject || "")}
          style={{
            backgroundImage: data.bgImages?.[section] ? `url(${data.bgImages[section]})` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed",
            paddingBottom: isMobile ? "80px" : undefined,
          }}
        >
          {render()}
        </div>
      </div>
      {showTutorial && (
        <Tutorial
          onDone={() => setShowTutorial(false)}
          currentSection={section}
          onNavigate={nav}
        />
      )}
      {isMobile && (
        <TabBar
          active={section}
          onNav={nav}
          onCapture={() => nav("tareas")}
        />
      )}
      {paletteOpen && <Palette onNav={nav} onClose={() => setPaletteOpen(false)} />}
      <FeedbackWidget section={section} />
      <ToastHost />
    </div>
  );
}

// Render moved to src/main.jsx
export { App, AppErrorBoundary };