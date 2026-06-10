import React from 'react';

import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast } from './store.jsx';
import { Btn, Field, Modal, TerminalCorners } from './ui.jsx';
import { supabase } from '../supabase.js';

/* ============================================================
   LOGIN + ONBOARDING (wizard 4 pasos) — auth Supabase real
   ============================================================ */

/* helper: genera código SH-XXXX */
const genHubbyCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return "SH-" + s;
};

const Login = ({ onEnter, onRegister }) => {
  const [show,     setShow]     = React.useState(false);
  const [mode,     setMode]     = React.useState("login"); /* "login" | "register" */
  const [email,    setEmail]    = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm,  setConfirm]  = React.useState("");
  const [error,    setError]    = React.useState("");
  const [loading,  setLoading]  = React.useState(false);

  const sb = () => supabase;

  const handleLogin = async () => {
    if (!email || !password) { setError("Completá email y contraseña."); return; }
    setLoading(true); setError("");
    const { error: err } = await sb().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    /* onAuthStateChange en app.jsx se encarga del setAuth("app") */
    onEnter();
  };

  const handleRegister = async () => {
    if (!email || !password) { setError("Completá email y contraseña."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    setLoading(true); setError("");
    const { error: err } = await sb().auth.signUp({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    onRegister(); /* → setAuth("onboarding") en app.jsx */
  };

  const submit = () => mode === "login" ? handleLogin() : handleRegister();

  return (
    <div style={{ position: "relative", zIndex: 1, height: "100%", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card tcorners fade-in" style={{ width: 420, padding: "44px 40px", textAlign: "center", background: "#121217" }}>
        <TerminalCorners />
        <img src="assets/logo.png" alt="StudyHub" style={{ width: 76, height: 76, borderRadius: 20, margin: "0 auto 22px", display: "block", boxShadow: "0 16px 40px -14px rgba(139,109,255,.8)" }} />
        <div className="h1" style={{ fontSize: 30 }}>Study<span style={{ color: "var(--violet-hi)" }}>Hub</span></div>
        <div className="mono" style={{ marginTop: 12, marginBottom: 30 }}>
          {mode === "login" ? "Bienvenido de vuelta" : "Creá tu cuenta gratis"}
        </div>

        <div style={{ display: "grid", gap: 13, textAlign: "left" }}>
          <input
            className="input"
            placeholder="Email"
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && submit()}
          />
          <div style={{ position: "relative" }}>
            <input
              className="input"
              type={show ? "text" : "password"}
              placeholder="Contraseña"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && submit()}
            />
            <div onClick={() => setShow(s => !s)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "var(--tx-3)" }}>
              <Icon name="eye" size={18} />
            </div>
          </div>

          {mode === "register" && (
            <input
              className="input"
              type="password"
              placeholder="Repetir contraseña"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && submit()}
            />
          )}

          {error && (
            <div style={{ fontSize: 13, color: "#e8639b", background: "rgba(232,99,155,.1)", border: "1px solid rgba(232,99,155,.25)", borderRadius: "var(--r)", padding: "10px 14px" }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ marginTop: 6, padding: "14px", fontSize: 15 }}
            onClick={submit}
            disabled={loading}
          >
            {loading ? "…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </div>

        <div style={{ marginTop: 24, fontSize: 13.5, color: "var(--tx-2)" }}>
          {mode === "login"
            ? <>¿No tenés cuenta? <span className="link" onClick={() => { setMode("register"); setError(""); }}>Registrate</span></>
            : <>¿Ya tenés cuenta? <span className="link" onClick={() => { setMode("login"); setError(""); }}>Iniciá sesión</span></>}
        </div>
      </div>
    </div>
  );
};

/* ── ONBOARDING ──────────────────────────────────────────── */
const ROLES = [
  { id: "uni",  emoji: "🎓", label: "Estudiante universitario", sub: "Facultad, carrera, materias" },
  { id: "sec",  emoji: "🏫", label: "Estudiante secundario",    sub: "Escuela, año, materias"       },
  { id: "work", emoji: "💼", label: "Trabajo",                   sub: "Contanos en qué trabajás"    },
];

/* Field viene de ui.jsx (carga antes en el bundle) */

const Onboarding = ({ onDone }) => {
  const [step, setStep]         = React.useState(0);
  const [d, setD]               = React.useState({ name: "", role: "", place: "", career: "", year: "1", work: "", subjects: ["", ""] });
  const [code, setCode]         = React.useState(genHubbyCode);
  const [hubbyLinked, setHubby] = React.useState(false);
  const [photoSrc, setPhoto]    = React.useState(null);
  const set   = (k, v) => setD(x => ({ ...x, [k]: v }));
  const steps = ["Perfil", "Ocupación", "Detalles", "Hubby"];

  /* cuando llega al paso Hubby, registra el código en Supabase */
  React.useEffect(() => {
    if (step !== 3) return;
    const freshCode = genHubbyCode();
    setCode(freshCode);
    (async () => {
      const sb = supabase;
      if (!sb) return;

      /* Intentar obtener el usuario — funciona con session o con token de confirmación pendiente */
      let userId = null;
      try {
        const { data: sessionData } = await sb.auth.getSession();
        userId = sessionData?.session?.user?.id;
        if (!userId) {
          const { data: userData } = await sb.auth.getUser();
          userId = userData?.user?.id;
        }
      } catch (_) { /* ignorar — igual mostramos el código */ }

      if (!userId) return; /* sin sesión todavía, el código se muestra igual pero no se guarda */

      await sb.from("telegram_links").delete().eq("user_id", userId);
      await sb.from("telegram_links").insert({
        user_id: userId,
        link_code: freshCode,
        linked: false,
        created_at: new Date().toISOString(),
      });
    })();
  }, [step]);

  const finish = () => {
    Store.set(s => {
      s.profile.name    = d.name || "Estudiante";
      s.profile.initial = (d.name || "E")[0].toUpperCase();
      s.profile.role    = d.role || "uni";
      s.profile.uni     = d.place;
      s.profile.career  = d.role === "work" ? d.work : d.career;
      s.profile.year    = d.year;
      s.profile.hubby   = hubbyLinked;
      if (photoSrc) s.profile.photo = photoSrc;
      const subs = d.subjects.filter(x => x.trim());
      if (subs.length) {
        s.subjects = subs.map((n, i) => ({
          id: uid(), name: n, color: COLORS[i % COLORS.length],
          prof: "", profs: [], next: "", link: "", pct: 0,
          board: null, boardMode: false, showDots: true, files: [], photo: null,
        }));
      }
    });
    toast("¡Perfil creado! 🎉");
    onDone();
  };

  const next = () => step < 3 ? setStep(step + 1) : finish();

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ position: "relative", zIndex: 1, minHeight: "100%", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card tcorners fade-in" style={{ width: 560, maxWidth: "100%", padding: 38, background: "#121217" }}>
        <TerminalCorners />
        {/* progress dots */}
        <div className="row" style={{ gap: 0, marginBottom: 30, justifyContent: "center" }}>
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div style={{ textAlign: "center" }}>
                <div className={`ob-step-dot${i === step ? " on" : i < step ? " done" : ""}`} style={{ margin: "0 auto" }}>
                  {i < step ? <Icon name="check" size={15} /> : i + 1}
                </div>
                <div className="mono" style={{ fontSize: 9.5, marginTop: 7, color: i === step ? "var(--violet-hi)" : "var(--tx-3)" }}>{s}</div>
              </div>
              {i < 3 && <div style={{ flex: 1, height: 1.5, background: i < step ? "var(--violet)" : "var(--line-2)", margin: "0 8px", marginBottom: 18 }}></div>}
            </React.Fragment>
          ))}
        </div>

        {/* paso 0: nombre + foto */}
        {step === 0 && (
          <div className="fade-in">
            <div className="h2" style={{ marginBottom: 6 }}>¿Cómo te llamás?</div>
            <div className="small" style={{ marginBottom: 22 }}>Así personalizamos tu experiencia.</div>
            <div className="row" style={{ gap: 16 }}>
              <label style={{ width: 72, height: 72, borderRadius: 18, background: photoSrc ? "transparent" : "var(--surface-2)", border: "1px dashed var(--line-2)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--tx-3)", flex: "0 0 auto", overflow: "hidden" }}>
                {photoSrc ? <img src={photoSrc} style={{ width: 72, height: 72, objectFit: "cover" }} /> : <Icon name="camera" size={22} />}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
              </label>
              <input className="input" placeholder="Tu nombre" value={d.name} onChange={e => set("name", e.target.value)} autoFocus />
            </div>
          </div>
        )}

        {/* paso 1: rol */}
        {step === 1 && (
          <div className="fade-in">
            <div className="h2" style={{ marginBottom: 6 }}>¿A qué te dedicás?</div>
            <div className="small" style={{ marginBottom: 22 }}>Elegí una opción.</div>
            <div style={{ display: "grid", gap: 12 }}>
              {ROLES.map(r => (
                <div key={r.id} className={`pickcard${d.role === r.id ? " sel" : ""}`} style={{ padding: 18 }} onClick={() => set("role", r.id)}>
                  <div className="row" style={{ gap: 14 }}>
                    <div style={{ fontSize: 26 }}>{r.emoji}</div>
                    <div><div style={{ fontWeight: 600, fontSize: 15.5 }}>{r.label}</div><div className="small" style={{ marginTop: 2 }}>{r.sub}</div></div>
                    {d.role === r.id && <div style={{ marginLeft: "auto", color: "var(--violet-hi)" }}><Icon name="check" size={20} /></div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* paso 2: detalles */}
        {step === 2 && (
          <div className="fade-in">
            <div className="h2" style={{ marginBottom: 6 }}>Tus detalles</div>
            <div className="small" style={{ marginBottom: 22 }}>Podés completar lo que quieras ahora.</div>
            {d.role === "work" ? (
              <Field label="¿En qué trabajás?"><textarea className="input" rows={4} value={d.work} onChange={e => set("work", e.target.value)} placeholder="Describí tu trabajo…" /></Field>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                <Field label={d.role === "sec" ? "Escuela" : "Facultad / universidad"}>
                  <input className="input" value={d.place} onChange={e => set("place", e.target.value)} placeholder={d.role === "sec" ? "Ej: E.E.S.T. N°1" : "Ej: UTN FRBA"} />
                </Field>
                {d.role !== "sec" && (
                  <Field label="Carrera">
                    <input className="input" value={d.career} onChange={e => set("career", e.target.value)} placeholder="Ej: Ing. en Sistemas" />
                  </Field>
                )}
                <Field label="Año">
                  <select className="sel-input" style={{ width: "100%" }} value={d.year} onChange={e => set("year", e.target.value)}>
                    {(d.role === "sec" ? [1,2,3,4,5,6] : [1,2,3,4,5]).map(y => <option key={y} value={y}>{y}° año</option>)}
                  </select>
                </Field>
                <Field label="Materias (podés agregar más después)">
                  <div style={{ display: "grid", gap: 8 }}>
                    {d.subjects.map((s, i) => (
                      <div className="row" key={i} style={{ gap: 8 }}>
                        <input className="input" value={s} placeholder={`Materia ${i + 1}`} onChange={e => set("subjects", d.subjects.map((x, j) => j === i ? e.target.value : x))} />
                        {d.subjects.length > 1 && <div className="icon-btn" onClick={() => set("subjects", d.subjects.filter((_, j) => j !== i))}><Icon name="x" size={15} /></div>}
                      </div>
                    ))}
                    <button className="addbtn" onClick={() => set("subjects", [...d.subjects, ""])}><Icon name="plus" size={15} /> Agregar materia</button>
                  </div>
                </Field>
              </div>
            )}
          </div>
        )}

        {/* paso 3: Hubby (Telegram) */}
        {step === 3 && (
          <div className="fade-in">
            <div className="h2" style={{ marginBottom: 6 }}>Conectá a Hubby 🤖</div>
            <div className="small" style={{ marginBottom: 22 }}>Tu asistente de Telegram para guardar cosas al toque. Opcional.</div>
            <div className="card card-2" style={{ textAlign: "center", padding: 28 }}>
              <div className="mono" style={{ marginBottom: 12 }}>Tu código de vinculación</div>
              <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 32, letterSpacing: ".1em", color: "var(--violet-hi)", margin: "16px 0" }}>{code}</div>
              <div className="row" style={{ gap: 10, justifyContent: "center" }}>
                <Btn variant="secondary" icon="copy" onClick={() => { navigator.clipboard?.writeText(code); toast("Código copiado"); }}>Copiar</Btn>
                <Btn variant="primary" icon="send" onClick={() => window.open("https://t.me/Hubby_ia_bot?start=" + code, "_blank")}>Abrir Hubby</Btn>
              </div>
            </div>
            <div className="small" style={{ marginTop: 16, textAlign: "center" }}>
              Buscá <b className="tx-1">@Hubby_ia_bot</b> en Telegram y pegale el código para vincular.
            </div>
          </div>
        )}

        <div className="row between" style={{ marginTop: 30 }}>
          <span className="link" style={{ color: "var(--tx-3)" }} onClick={finish}>Completar después</span>
          <div className="row" style={{ gap: 10 }}>
            {step > 0 && <Btn variant="secondary" onClick={() => setStep(step - 1)}>Atrás</Btn>}
            <Btn variant="primary" icon={step === 3 ? "check" : "arrowR"} onClick={next}>
              {step === 3 ? "Empezar" : "Siguiente"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

export { Login, Onboarding, Field };