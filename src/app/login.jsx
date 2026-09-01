import React from 'react';

import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, COLORS } from './store.jsx';
import { Btn, Field, Seg } from './ui.jsx';
import { usePushNotifications } from './pushNotifications.js';
import { supabase } from '../supabase.js';

/* ============================================================
   LOGIN + ONBOARDING (wizard 4 pasos) + CONFIRM EMAIL
   Fondo piedra con orbes cálidos (parallax al mouse) + tarjeta
   crema que se inclina apenas — mockup aprobado (DESIGN.md Fase 7)
   ============================================================ */

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
  <img src="/assets/icon.png" alt="studyhub." className="auth-logo" />
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
    const flojas = ["12345678", "contraseña", "password", "qwertyui", "studyhub", "11111111", "123456789"];
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) { setError("Usá al menos una letra y un número."); return; }
    if (flojas.some(f => password.toLowerCase().includes(f))) { setError("Esa contraseña es muy fácil de adivinar. Probá otra."); return; }
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
      <div className="auth-wrap">
        <TiltCard style={{ width: "min(420px, calc(100vw - 48px))", padding: "40px 38px", textAlign: "center" }}>
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
  const [photoSrc, setPhoto]    = React.useState(null);
  const { status: notifStatus, enable: enableNotif } = usePushNotifications();
  const set   = (k, v) => setD(x => ({ ...x, [k]: v }));
  const steps = ["Perfil", "Ocupación", "Detalles", "Avisos"];

  const finish = () => {
    Store.set(s => {
      s.profile.name    = d.name || "Estudiante";
      s.profile.initial = (d.name || "E")[0].toUpperCase();
      s.profile.role    = d.role || "uni";
      s.profile.uni     = d.place;
      s.profile.career  = d.role === "work" ? d.work : d.career;
      s.profile.year    = d.year;
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
      <div className="auth-wrap">
        <div className="auth-card fade-in" style={{ width: "min(560px, calc(100vw - 48px))", padding: 36 }}>
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
                <div style={{ display: "grid", gap: 16 }}>
                  <Field label="Facultad / universidad">
                    <input className="input" value={d.place} onChange={e => set("place", e.target.value)} placeholder="Ej: UTN FRBA" autoFocus />
                  </Field>
                  <Field label="Carrera">
                    <input className="input" value={d.career} onChange={e => set("career", e.target.value)} placeholder="Ej: Ing. en Sistemas" />
                  </Field>
                  <Field label="Año">
                    <Seg opts={[1, 2, 3, 4, 5].map(y => ({ id: String(y), label: y < 5 ? `${y}°` : "5°+" }))} value={String(d.year)} onChange={v => set("year", v)} />
                  </Field>
                  <Field label="Materias" hint="podés agregar más después">
                    <div style={{ display: "grid", gap: 8 }}>
                      {d.subjects.map((s, i) => (
                        <div className="ob-subj-row" key={i}>
                          <span className="ob-subj-num">{String(i + 1).padStart(2, "0")}</span>
                          <input className="ob-subj-in" value={s} placeholder={`Materia ${i + 1}`} onChange={e => set("subjects", d.subjects.map((x, j) => j === i ? e.target.value : x))} />
                          {d.subjects.length > 1 && <button type="button" className="ob-subj-del" onClick={() => set("subjects", d.subjects.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>}
                        </div>
                      ))}
                      <button className="addbtn" onClick={() => set("subjects", [...d.subjects, ""])}><Icon name="plus" size={15} /> Agregar materia</button>
                    </div>
                  </Field>
                </div>
              )}
            </div>
          )}

          {/* paso 3: activar notificaciones push */}
          {step === 3 && (
            <div className="fade-in">
              <div className="h2" style={{ marginBottom: 6 }}>Activá los avisos 🔔</div>
              <div className="small" style={{ marginBottom: 22 }}>Un aviso con lo que tenés para mañana, aunque no tengas la app abierta. Opcional.</div>
              <div className="card card-2" style={{ textAlign: "center", padding: 28 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--field)", color: "var(--org)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
                  <Icon name="bell" size={24} />
                </div>
                {notifStatus === "subscribed" ? (
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#2f5e10", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Icon name="check" size={18} /> Notificaciones activadas
                  </div>
                ) : notifStatus === "denied" ? (
                  <div className="small">Las bloqueaste antes — activalas desde los permisos del navegador para este sitio.</div>
                ) : notifStatus === "unsupported" ? (
                  <div className="small">Tu navegador no soporta notificaciones push — no hay drama, seguimos.</div>
                ) : (
                  <Btn variant="primary" icon="bell" onClick={enableNotif}>Activar notificaciones</Btn>
                )}
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
      <div className="auth-wrap">
        <div className="auth-card fade-in" style={{ width: "min(460px, calc(100vw - 48px))", padding: "40px 38px", textAlign: "center" }}>
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
