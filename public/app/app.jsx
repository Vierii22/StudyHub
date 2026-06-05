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
  /* auth: "loading" | "login" | "onboarding" | "app" */
  const [auth, setAuth]   = useState("loading");
  const [section, setSection] = useState(() => load("sh_section", "dashboard"));
  const [theme, setThemeState] = useState(() => {
    const t = load("sh_theme", DEFAULT_THEME);
    if (!localStorage.getItem("sh_layout_v2")) { t.variant = "editorial"; localStorage.setItem("sh_layout_v2", "1"); }
    return t;
  });
  const [openSubject, setOpenSubject] = useState(null);
  const [morning, setMorning] = useState(false);
  const [dashEditSignal, setDashEditSignal] = useState(0);
  const [data] = useStore();

  /* ── auth Supabase ─────────────────────────────────── */
  useEffect(() => {
    const sb = window._supabase;
    if (!sb) { setAuth("login"); return; }

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
        setAuth("login");
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
        setAuth("login");
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

  /* ── sección persistida ────────────────────────────── */
  useEffect(() => { localStorage.setItem("sh_section", JSON.stringify(section)); }, [section]);

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
  const nav       = (s)    => { setOpenSubject(null); setSection(s); };
  const logout    = ()     => {
    const sb = window._supabase;
    if (sb) sb.auth.signOut();
    /* storage.js limpia localStorage en SIGNED_OUT */
    Store.reset();
    toast("Sesión cerrada");
  };

  /* ── estados de carga / auth ───────────────────────── */
  if (auth === "loading") return <LoadingScreen />;

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
        />
      );
      default: return <Dashboard variant={theme.variant} onNav={nav} onConnect={() => nav("config")} />;
    }
  };

  return (
    <div className="app">
      <Sidebar active={section} onNav={nav} onLogout={logout} />
      <div className="main">
        <Header profile={data.profile} onNav={nav} section={section} />
        <div className="scroll scroll-zoom" key={section + (openSubject || "")}>
          {render()}
        </div>
      </div>
      {morning && <MorningModal onClose={() => setMorning(false)} />}
      <FeedbackWidget section={section} />
      <ToastHost />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
