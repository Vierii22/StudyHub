import React from 'react';

import ReactDOM from 'react-dom/client';
import { Icon } from './icons.jsx';
import { Store, useStore, toast, scaleToZoom, ToastHost, PomoStore, usePomoStore } from './store.jsx';
import { Sidebar, Header } from './ui.jsx';
import { Login, Onboarding } from './login.jsx';
import { Dashboard } from './dashboard2.jsx';
import { Facultad } from './facultad.jsx';
import { SubjectView } from './facultad2.jsx';
import { Tareas } from './tareas.jsx';
import { Misiones, Calendario } from './sections.jsx';
import { Pomodoro, ChatIA, Diario, Historial } from './sections2.jsx';
import { Cocina, Finanzas, Casa, Ocio, Recetas } from './sections3.jsx';
import { ConfigSection, MorningModal } from './config.jsx';
import { MiEspacio } from './space.jsx';
import { Landing } from './landing.jsx';
import { Tutorial, TUTORIAL_KEY } from './tutorial.jsx';
import { FeedbackWidget } from './feedback.jsx';
import { supabase } from '../supabase.js';

/* ============================================================
   APP ROOT — auth Supabase + router + tema + zoom + acento
   ============================================================ */
const { useState, useEffect, useRef } = React;
const DEFAULT_THEME = { font: "outfit-mono", accent: "gradient", variant: "editorial" };
const load = (k, f) => { try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch { return f; } };

const ACCENTS = {
  violet: { v: "#8b6dff", v2: "#c264e8", hi: "#a48cff" },
  blue:   { v: "#4ec5e8", v2: "#6d8bff", hi: "#7ed8f0" },
  orange: { v: "#f0764e", v2: "#e8b04e", hi: "#f59b78" },
  green:  { v: "#3ecf9a", v2: "#4ec5e8", hi: "#6fe0b6" },
  red:    { v: "#e8639b", v2: "#c264e8", hi: "#f08bb6" },
  indigo: { v: "#6d8bff", v2: "#8b6dff", hi: "#93a9ff" },
};

/* ── MINI POMODORO FLOTANTE ─────────────────────────────── */
/* Aparece en la esquina cuando el timer está activo y el
   usuario navega a otra sección. */
function PomoMini({ onOpen }) {
  const ps = usePomoStore();
  if (!ps.started && !ps.running) return null;

  const mm     = String(Math.floor(ps.secs / 60)).padStart(2, "0");
  const ss     = String(ps.secs % 60).padStart(2, "0");
  const isFoco = ps.mode === "foco";
  const accent = isFoco ? "var(--violet-hi)" : "#3ecf9a";

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 400,
      display: "flex", alignItems: "center", gap: 10,
      background: "var(--surface-1)",
      border: `1px solid ${ps.running && isFoco ? "var(--violet-line)" : "var(--line-2)"}`,
      borderRadius: 16, padding: "10px 14px",
      boxShadow: `0 12px 36px -10px rgba(0,0,0,.7)${ps.running && isFoco ? ", 0 0 0 1px rgba(139,109,255,.2)" : ""}`,
      backdropFilter: "blur(16px)",
      cursor: "pointer", minWidth: 176,
      transition: "border-color .3s, box-shadow .3s",
    }} onClick={onOpen} title="Ir al Pomodoro">

      {/* ícono modo */}
      <div style={{ width: 34, height: 34, borderRadius: 10, background: ps.running && isFoco ? "var(--violet-soft)" : "var(--surface-2)", display: "grid", placeItems: "center", color: accent, flex: "0 0 34px" }}>
        <Icon name={isFoco ? "clock" : "mug"} size={17} />
      </div>

      {/* countdown */}
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 19, fontWeight: 700, letterSpacing: ".04em", lineHeight: 1, color: ps.running ? accent : "var(--tx-2)" }}>
          {mm}:{ss}
        </div>
        <div style={{ fontSize: 10, color: "var(--tx-3)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 90 }}>
          {isFoco ? "Foco" : "Descanso"}{ps.task ? ` · ${ps.task}` : ""}
        </div>
      </div>

      {/* pause/play */}
      <div onClick={e => { e.stopPropagation(); PomoStore.toggle(); }}
        style={{ width: 32, height: 32, borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--line)", display: "grid", placeItems: "center", cursor: "pointer", color: ps.running ? accent : "var(--tx-2)", flex: "0 0 32px" }}>
        <Icon name={ps.running ? "pause" : "play"} size={14} />
      </div>

      {/* dismiss */}
      <div onClick={e => { e.stopPropagation(); PomoStore.dismiss(); }}
        style={{ width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--tx-3)", flex: "0 0 26px" }}>
        <Icon name="x" size={13} />
      </div>
    </div>
  );
}

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

function App() {
  /* auth: "loading" | "landing" | "login" | "onboarding" | "app" */
  const [auth, setAuth]   = useState("loading");
  const [showTutorial, setShowTutorial] = useState(false);
  const [section, setSection] = useState("dashboard");
  const [theme, setThemeState] = useState(() => {
    const t = load("sh_theme", DEFAULT_THEME);
    if (!localStorage.getItem("sh_layout_v2")) { t.variant = "editorial"; localStorage.setItem("sh_layout_v2", "1"); }
    return t;
  });
  const [openSubject, setOpenSubject] = useState(null);
  const [morning, setMorning] = useState(false);
  const [dashEditSignal, setDashEditSignal] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data] = useStore();

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
      /* SIGNED_IN lo maneja el onboarding / login */
    });

    return () => {
      subscription?.unsubscribe();
      window.removeEventListener("sh:user-synced", onSynced);
    };
  }, []);

  /* ── tema ──────────────────────────────────────────── */
  useEffect(() => {
    const r = document.documentElement;
    r.setAttribute("data-font",    theme.font);
    r.setAttribute("data-accent",  theme.accent);
    r.setAttribute("data-variant", theme.variant);
    localStorage.setItem("sh_theme", JSON.stringify(theme));
  }, [theme]);

  /* ── zoom + acento desde settings ─────────────────── */
  useEffect(() => {
    document.documentElement.style.setProperty("--ui-zoom", scaleToZoom(data.settings.uiScale));
    const a = ACCENTS[data.settings.accent] || ACCENTS.violet;
    const r = document.documentElement.style;
    r.setProperty("--violet",      a.v);
    r.setProperty("--violet-2",    a.v2);
    r.setProperty("--violet-hi",   a.hi);
    r.setProperty("--grad",        `linear-gradient(135deg, ${a.v} 0%, ${a.v2} 100%)`);
    r.setProperty("--violet-soft", a.v + "22");
    r.setProperty("--violet-line", a.v + "66");
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
  useEffect(() => {
    if (auth === "app") {
      const key = "sh_morning_" + new Date().toDateString();
      if (new Date().getHours() >= 5 && !localStorage.getItem(key)) {
        const t = setTimeout(() => {
          setMorning(true);
          localStorage.setItem(key, "1");
        }, 800);
        return () => clearTimeout(t);
      }
    }
  }, [auth]);

  const setTheme  = (k, v) => setThemeState(t => ({ ...t, [k]: v }));
  const nav       = (s)    => { setOpenSubject(null); setSection(s); setSidebarOpen(false); };
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
        onRegister={() => setAuth("onboarding")}
      />
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
      case "dashboard":  return <Dashboard key={dashEditSignal} variant={theme.variant} onNav={nav} onConnect={() => nav("config")} />;
      case "facultad":   return <Facultad onOpenSubject={setOpenSubject} />;
      case "tareas":     return <Tareas   onOpenSubject={(id) => { setSection("facultad"); setOpenSubject(id); }} />;
      case "misiones":   return <Misiones />;
      case "calendario": return <Calendario />;
      case "pomodoro":   return <Pomodoro />;
      case "chat":       return <ChatIA />;
      case "diario":     return <Diario />;
      case "espacio":    return <MiEspacio />;
      case "historial":  return <Historial />;
      case "cocina":     return <Cocina onNav={nav} />;
      case "recetas":    return <Recetas onNav={nav} />;
      case "finanzas":   return <Finanzas />;
      case "casa":       return <Casa />;
      case "ocio":       return <Ocio />;
      case "config":     return (
        <ConfigSection
          theme={theme}
          setTheme={setTheme}
          onEditDash={() => { setSection("dashboard"); setDashEditSignal(x => x + 1); toast('Tocá "Editar dashboard"'); }}
          onLogout={logout}
          onTutorial={() => { setShowTutorial(true); nav("dashboard"); }}
        />
      );
      default: return <Dashboard variant={theme.variant} onNav={nav} onConnect={() => nav("config")} />;
    }
  };

  return (
    <div className="app">
      <Sidebar
        active={section}
        onNav={nav}
        onLogout={logout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main">
        <Header
          profile={data.profile}
          onNav={nav}
          section={section}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
        />
        <div className="scroll scroll-zoom" key={section + (openSubject || "")}>
          {render()}
        </div>
      </div>
      {morning && <MorningModal onClose={() => setMorning(false)} />}
      {showTutorial && (
        <Tutorial
          onDone={() => setShowTutorial(false)}
          currentSection={section}
          onNavigate={nav}
        />
      )}
      {section !== "pomodoro" && <PomoMini onOpen={() => nav("pomodoro")} />}
      <FeedbackWidget section={section} />
      <ToastHost />
    </div>
  );
}

// Render moved to src/main.jsx
export { App };