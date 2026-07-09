import React from 'react';

import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, COLORS } from './store.jsx';
import { Btn, Field } from './ui.jsx';
import { supabase } from '../supabase.js';

/* ============================================================
   LOGIN + ONBOARDING (wizard 4 pasos) + CONFIRM EMAIL
   Fondo piedra con orbes cálidos (parallax al mouse) + tarjeta
   crema que se inclina apenas — mockup aprobado (DESIGN.md Fase 7)
   ============================================================ */

/* helper: genera código SH-XXXX */
const genHubbyCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return "SH-" + s;
};

/* ---------- fondo de orbes cálidos con parallax ---------- */
const ORBS = [
  { x: 12, y: 18, size: 420, color: "#D9551F", opacity: 0.12, depth: 0.05 },
  { x: 82, y: 70, size: 380, color: "#F4A94E", opacity: 0.15, depth: 0.04 },
  { x: 78, y: 12, size: 260, color: "#C9B896", opacity: 0.14, depth: 0.07 },
  { x: 8, y: 78, size: 300, color: "#F4A94E", opacity: 0.10, depth: 0.06 },
];

const AuthOrbs = () => {
  const mouseRef = React.useRef({ x: 0.5, y: 0.5 });
  const currentRef = React.useRef({ x: 0.5, y: 0.5 });
  const rafRef = React.useRef(null);
  const orbRefs = React.useRef([]);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  React.useEffect(() => {
    if (reducedMotion) return;
    const onMove = (e) => { mouseRef.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }; };
    const animate = () => {
      currentRef.current.x += (mouseRef.current.x - currentRef.current.x) * 0.04;
      currentRef.current.y += (mouseRef.current.y - currentRef.current.y) * 0.04;
      const cx = currentRef.current.x - 0.5, cy = currentRef.current.y - 0.5;
      orbRefs.current.forEach((el, i) => {
        if (!el) return;
        const o = ORBS[i];
        el.style.transform = `translate(${cx * o.depth * window.innerWidth}px, ${cy * o.depth * window.innerHeight}px)`;
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    window.addEventListener('mousemove', onMove);
    rafRef.current = requestAnimationFrame(animate);
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(rafRef.current); };
  }, [reducedMotion]);

  return (
    <div className="auth-orbs" aria-hidden="true">
      {ORBS.map((o, i) => (
        <div key={i} ref={el => { orbRefs.current[i] = el; }} className="auth-orb"
          style={{ left: `${o.x}%`, top: `${o.y}%`, width: o.size, height: o.size, background: o.color, opacity: o.opacity }} />
      ))}
    </div>
  );
};

/* ---------- tarjeta que se inclina apenas con el mouse ---------- */
const TiltCard = ({ children, style }) => {
  const ref = React.useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${px * 5}deg) rotateX(${-py * 5}deg)`;
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = ""; };
  return (
    <div ref={ref} className="auth-card fade-in" style={style} onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
    </div>
  );
};

const AuthLogo = () => (
  <div className="auth-logo"><span className="dot" /></div>
);

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
    onRegister(email); /* → setAuth("confirm-email") en app.jsx */
  };

  const submit = () => mode === "login" ? handleLogin() : handleRegister();

  return (
    <div className="auth-root">
      <AuthOrbs />
      <div style={{ position: "relative", zIndex: 1, height: "100%", display: "grid", placeItems: "center", padding: 24 }}>
        <TiltCard style={{ width: 420, padding: "40px 38px", textAlign: "center" }}>
          <AuthLogo />
          <div className="auth-wordmark"><span className="w1">study</span><span className="w2">hub</span><span className="w3">.</span></div>
          <div className="mono" style={{ marginTop: 12, marginBottom: 28 }}>
            {mode === "login" ? "Bienvenido de vuelta" : "Creá tu cuenta gratis"}
          </div>

          <div style={{ display: "grid", gap: 12, textAlign: "left" }}>
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
              <div style={{ fontSize: 13, color: "var(--org-deep)", background: "#F7E4D3", border: "1px solid rgba(150,54,15,.25)", borderRadius: "var(--r)", padding: "10px 14px" }}>
                {error}
              </div>
            )}

            <button className="btnC-crear" style={{ marginTop: 6, justifyContent: "center", padding: "13px" }} onClick={submit} disabled={loading}>
              <span className="btnC-chip"><Icon name={loading ? "clock" : "arrowR"} size={14} /></span>
              {loading ? "…" : mode === "login" ? "Entrar" : "Crear cuenta"}
            </button>
          </div>

          <div style={{ marginTop: 22, fontSize: 13.5, color: "var(--tx-2)" }}>
            {mode === "login"
              ? <>¿No tenés cuenta? <span className="link" onClick={() => { setMode("register"); setError(""); }}>Registrate</span></>
              : <>¿Ya tenés cuenta? <span className="link" onClick={() => { setMode("login"); setError(""); }}>Iniciá sesión</span></>}
          </div>
        </TiltCard>
      </div>
    </div>
  );
};

/* ── ONBOARDING ──────────────────────────────────────────── */
const ROLES = [
  { id: "uni",  emoji: "🎓", label: "Estudiante universitario", sub: "Facultad, carrera, materias" },
  { id: "work", emoji: "💼", label: "Trabajo",                   sub: "Contanos en qué trabajás"    },
];

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
    <div className="auth-root">
      <AuthOrbs />
      <div style={{ position: "relative", zIndex: 1, minHeight: "100%", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="auth-card fade-in" style={{ width: 560, maxWidth: "100%", padding: 36 }}>
          {/* progress dots */}
          <div className="row" style={{ gap: 0, marginBottom: 28, justifyContent: "center" }}>
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                <div style={{ textAlign: "center" }}>
                  <div className={`ob-step-dot${i === step ? " on" : i < step ? " done" : ""}`} style={{ margin: "0 auto" }}>
                    {i < step ? <Icon name="check" size={15} /> : i + 1}
                  </div>
                  <div className="mono" style={{ fontSize: 9.5, marginTop: 7, color: i === step ? "var(--org)" : "var(--tx-3)" }}>{s}</div>
                </div>
                {i < 3 && <div style={{ flex: 1, height: 1.5, background: i < step ? "var(--org)" : "var(--line-2)", margin: "0 8px", marginBottom: 18 }}></div>}
              </React.Fragment>
            ))}
          </div>

          {/* paso 0: nombre + foto */}
          {step === 0 && (
            <div className="fade-in">
              <div className="h2" style={{ marginBottom: 6 }}>¿Cómo te llamás?</div>
              <div className="small" style={{ marginBottom: 22 }}>Así personalizamos tu experiencia.</div>
              <div className="row" style={{ gap: 16 }}>
                <label style={{ width: 72, height: 72, borderRadius: 18, background: photoSrc ? "transparent" : "var(--field)", border: "1px dashed var(--line-2)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--tx-3)", flex: "0 0 auto", overflow: "hidden" }}>
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
                      {d.role === r.id && <div style={{ marginLeft: "auto", color: "var(--org)" }}><Icon name="check" size={20} /></div>}
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
                  <Field label="Facultad / universidad">
                    <input className="input" value={d.place} onChange={e => set("place", e.target.value)} placeholder="Ej: UTN FRBA" />
                  </Field>
                  <Field label="Carrera">
                    <input className="input" value={d.career} onChange={e => set("career", e.target.value)} placeholder="Ej: Ing. en Sistemas" />
                  </Field>
                  <Field label="Año">
                    <select className="input" style={{ width: "100%" }} value={d.year} onChange={e => set("year", e.target.value)}>
                      {[1,2,3,4,5].map(y => <option key={y} value={y}>{y}° año</option>)}
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
                <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 32, letterSpacing: ".1em", color: "var(--org-deep)", margin: "16px 0" }}>{code}</div>
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

          <div className="row between" style={{ marginTop: 28 }}>
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
    </div>
  );
};

/* ── CONFIRM EMAIL ──────────────────────────────────────── */
const ConfirmEmail = ({ email }) => {
  const [resent, setResent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const resend = async () => {
    setLoading(true);
    const sb = supabase;
    if (sb) await sb.auth.resend({ type: "signup", email });
    setLoading(false);
    setResent(true);
    setTimeout(() => setResent(false), 5000);
  };

  return (
    <div className="auth-root">
      <AuthOrbs />
      <div style={{ position: "relative", zIndex: 1, height: "100%", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="auth-card fade-in" style={{ width: 460, padding: "40px 38px", textAlign: "center" }}>
          <div style={{ width: 68, height: 68, borderRadius: 18, background: "var(--field)", display: "grid", placeItems: "center", margin: "0 auto 20px" }}>
            <Icon name="send" size={30} color="var(--org)" />
          </div>

          <div className="h1" style={{ fontSize: 25, marginBottom: 10 }}>
            Confirmá tu email
          </div>

          <div style={{ fontSize: 14.5, color: "var(--tx-2)", lineHeight: 1.6, marginBottom: 6 }}>
            Te mandamos un link de confirmación a:
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--org-deep)", marginBottom: 20, wordBreak: "break-all" }}>
            {email}
          </div>

          <div style={{ fontSize: 13.5, color: "var(--tx-2)", lineHeight: 1.7, marginBottom: 26, background: "var(--field)", borderRadius: 12, padding: "14px 18px" }}>
            Abrí el mail y tocá el link de confirmación.<br />
            <strong style={{ color: "var(--tx-1)" }}>No vas a poder entrar hasta que confirmes.</strong>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <Btn variant="primary" icon="refresh" onClick={resend} disabled={loading || resent}>
              {resent ? "¡Reenviado!" : loading ? "Enviando…" : "Reenviar email"}
            </Btn>
            <div className="mono" style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 4 }}>
              Una vez que confirmes, esta pantalla avanza automáticamente.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { Login, Onboarding, ConfirmEmail, Field };
