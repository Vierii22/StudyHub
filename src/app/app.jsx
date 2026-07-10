import React from 'react';

import ReactDOM from 'react-dom/client';
import { Icon } from './icons.jsx';
import { Store, useStore, toast, scaleToZoom, ToastHost } from './store.jsx';
import { Header } from './ui.jsx';
import { Login, Onboarding, ConfirmEmail } from './login.jsx';
import { Dashboard } from './dashboard2.jsx';
import { Facultad } from './facultad.jsx';
import { SubjectView } from './facultad2.jsx';
import { Tareas } from './tareas.jsx';
import { Calendario } from './calendario.jsx';
import { ChatIA } from './chat.jsx';
import { Ocio } from './ocio.jsx';
import { Notas } from './notas.jsx';
import { Correlatividades } from './correlatividades.jsx';
import { ConfigSection } from './config.jsx';
import { Landing } from './landing.jsx';
import { FeedbackWidget } from './feedback.jsx';
import { TabBar } from './tabbar.jsx';
import { Palette } from './palette.jsx';
import { supabase } from '../supabase.js';

/* ============================================================
   APP ROOT — auth Supabase + router + tema + zoom + acento
   ============================================================ */
const { useState, useEffect, useRef } = React;

/* pantalla de carga mientras se verifica la sesión */
function LoadingScreen() {
  return (
    <div style={{ height: "100%", display: "grid", placeItems: "center", background: "var(--bg)" }}>
      <div style={{ textAlign: "center" }}>
        <img src="assets/logo.png" alt="StudyHub" style={{ width: 64, height: 64, borderRadius: 18, boxShadow: "0 16px 40px -14px rgba(217,85,31,.5)", marginBottom: 20 }} />
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
            <pre style={{ fontSize: 11, color: "var(--org-deep)", marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
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

function App() {
  /* auth: "loading" | "landing" | "login" | "confirm-email" | "onboarding" | "app" */
  const [auth, setAuth]   = useState("loading");
  const [pendingEmail, setPendingEmail] = useState(""); // email pendiente de confirmación
  const authRef = useRef("loading"); // ref para leer auth dentro de callbacks sin stale closure
  const [section, setSection] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("section") || "dashboard";
  });
  const [openSubject, setOpenSubject] = useState(null);
  const [autoPlanner, setAutoPlanner] = useState(false);
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

  /* ── zoom de la interfaz (Configuración → Apariencia) ── */
  useEffect(() => {
    document.documentElement.style.setProperty("--ui-zoom", scaleToZoom(data.settings.uiScale));
  }, [data.settings.uiScale]);

  /* sección NO persistida — siempre arranca en dashboard al abrir la app */

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const upd = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);
  const nav = (s) => {
    if (document.startViewTransition) {
      document.startViewTransition(() => { setOpenSubject(null); setSection(s); });
    } else {
      setOpenSubject(null); setSection(s);
    }
  };
  const openSubjectPlanner = (id) => { setSection("facultad"); setOpenSubject(id); setAutoPlanner(true); };
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
      return <SubjectView subjectId={openSubject} onBack={() => setOpenSubject(null)} autoOpenPlanner={autoPlanner} onPlannerConsumed={() => setAutoPlanner(false)} />;
    switch (section) {
      case "dashboard":  return <Dashboard onNav={nav} />;
      case "facultad":   return <Facultad onOpenSubject={setOpenSubject} onNav={nav} />;
      case "correlatividades": return <Correlatividades />;
      case "tareas":     return <Tareas   onOpenSubject={(id) => { setSection("facultad"); setOpenSubject(id); }} autoNew={new URLSearchParams(window.location.search).get("action") === "new"} />;
      case "calendario": return <Calendario onOpenSubjectPlanner={openSubjectPlanner} />;
      case "chat":       return <ChatIA />;
      case "ocio":       return <Ocio />;
      case "notas":      return <Notas />;
      case "config":     return <ConfigSection onLogout={logout} />;
      default: return <Dashboard onNav={nav} />;
    }
  };

  return (
    <div className={`app${isMobile ? " app-mobile" : ""}`}>
      <div className="main">
        <Header
          profile={data.profile}
          onNav={nav}
          section={section}
        />
        <div
          className="scroll"
          key={section + (openSubject || "")}
          style={{ paddingBottom: isMobile ? "80px" : undefined }}
        >
          {render()}
        </div>
      </div>
      {isMobile && <TabBar active={section} onNav={nav} />}
      {paletteOpen && <Palette onNav={nav} onClose={() => setPaletteOpen(false)} />}
      <FeedbackWidget section={section} />
      <ToastHost />
    </div>
  );
}

// Render moved to src/main.jsx
export { App, AppErrorBoundary };