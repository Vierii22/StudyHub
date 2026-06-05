import React from 'react';

import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, COLORS } from './store.jsx';
import { Btn, Chip, MonoLabel, PageHead, Field, Modal, Seg, Toggle, ProgressRing, TerminalCorners, FONT_OPTS, ACCENT_OPTS, VARIANT_OPTS, NAV } from './ui.jsx';
import { supabase } from '../supabase.js';
import { SupabaseStorage } from '../storage.js';

/* ============================================================
   CONFIGURACIÓN — sección de página completa
   Con auth Supabase real: Telegram, password, borrar datos
   ============================================================ */
/* FONT_OPTS, ACCENT_OPTS, VARIANT_OPTS vienen de ui.jsx (carga antes en el bundle) */

const ACCENT_SWATCHES = [
  { id: "violet", c: "#8b6dff" }, { id: "blue", c: "#4ec5e8" }, { id: "orange", c: "#f0764e" },
  { id: "green",  c: "#3ecf9a" }, { id: "red",  c: "#e8639b" }, { id: "indigo", c: "#6d8bff" },
];
const CONFIG_TABS = [
  ["apariencia","Apariencia","palette"],
  ["dashboard", "Dashboard",  "layout"],
  ["perfil",    "Perfil",     "user"  ],
  ["integr",    "Integraciones","robot"],
  ["cuenta",    "Cuenta",     "gear"  ],
  ["acerca",    "Acerca de",  "info"  ],
];

const ConfigRow = ({ label, sub, children }) => (
  <div className="row between" style={{ padding: "15px 0", borderBottom: "1px solid var(--line)", gap: 20 }}>
    <div><div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>{sub && <div className="small" style={{ marginTop: 3, fontSize: 12 }}>{sub}</div>}</div>
    <div style={{ flex: "0 0 auto" }}>{children}</div>
  </div>
);

/* ── PWA INSTALL BUTTON ─────────────────────────────────── */
const InstallPWA = () => {
  const [canInstall, setCanInstall] = React.useState(!!window._pwaPrompt);
  const [installed,  setInstalled]  = React.useState(false);

  React.useEffect(() => {
    const onPrompt = () => setCanInstall(true);
    window.addEventListener("beforeinstallprompt_ready", onPrompt);
    // Si el prompt ya llegó antes de que este componente montara
    if (window._pwaPrompt) setCanInstall(true);
    // Detectar si ya está instalada (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => window.removeEventListener("beforeinstallprompt_ready", onPrompt);
  }, []);

  const install = async () => {
    const prompt = window._pwaPrompt;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") { setInstalled(true); setCanInstall(false); window._pwaPrompt = null; toast("¡App instalada! Buscala en tu escritorio."); }
  };

  if (installed) return (
    <div className="card card-2" style={{ marginTop: 16, textAlign: "center", padding: "18px 22px" }}>
      <div style={{ color: "#3ecf9a", marginBottom: 6 }}><Icon name="check" size={22} /></div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>StudyHub instalada</div>
      <div className="small" style={{ marginTop: 4 }}>Podés abrirla desde el escritorio o el dock de tu dispositivo.</div>
    </div>
  );

  if (!canInstall) return (
    <div className="card card-2" style={{ marginTop: 16, padding: "16px 20px" }}>
      <div className="row" style={{ gap: 12 }}>
        <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--violet-soft)", color: "var(--violet-hi)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name="home" size={20} /></span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Instalar como app</div>
          <div className="small" style={{ marginTop: 3 }}>
            En Chrome/Edge: menú <b>⋮</b> → <b>"Instalar StudyHub"</b>.<br />
            En Safari (iOS): compartir → <b>"Añadir a pantalla de inicio"</b>.
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="card card-2" style={{ marginTop: 16, padding: "16px 20px" }}>
      <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="row" style={{ gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--violet-soft)", color: "var(--violet-hi)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name="home" size={20} /></span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Instalar como app</div>
            <div className="small" style={{ marginTop: 3 }}>Sin browser, con ícono propio, como app nativa.</div>
          </div>
        </div>
        <Btn variant="primary" icon="download" onClick={install}>Instalar</Btn>
      </div>
    </div>
  );
};

const ConfigSection = ({ theme, setTheme, onEditDash, onLogout }) => {
  const [data, set] = useStore();
  const [tab, setTab] = React.useState("apariencia");

  /* ── Cuenta ── */
  const [userEmail, setUserEmail] = React.useState(data.profile?.email || "");
  const [newPwd,    setNewPwd]    = React.useState("");
  const [confPwd,   setConfPwd]   = React.useState("");
  const [pwdLoading, setPwdLoad]  = React.useState(false);

  /* ── Telegram ── */
  const [tgCode,    setTgCode]    = React.useState(null);
  const [tgLoading, setTgLoad]    = React.useState(false);
  const [tgLinked,  setTgLinked]  = React.useState(data.profile?.hubby || false);

  const p  = data.profile;
  const st = data.settings;
  const setSetting = (k, v) => set(s => s.settings[k] = v);
  const upProfile  = (k, v) => set(s => s.profile[k] = v);

  /* cargar email real de Supabase */
  React.useEffect(() => {
    const sb = supabase;
    if (!sb) return;
    sb.auth.getUser().then(({ data: u }) => {
      if (u?.user?.email) setUserEmail(u.user.email);
    });
  }, []);

  /* cargar código Telegram al abrir la pestaña */
  React.useEffect(() => {
    if (tab !== "integr") return;
    (async () => {
      const sb = supabase;
      if (!sb) return;
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      const { data: row } = await sb.from("telegram_links").select("link_code,linked").eq("user_id", session.user.id).maybeSingle();
      if (row) {
        setTgCode(row.link_code);
        setTgLinked(row.linked);
        set(s => s.profile.hubby = row.linked);
      }
    })();
  }, [tab]);

  /* generar nuevo código Telegram */
  const genTgCode = async () => {
    setTgLoad(true);
    const sb = supabase;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { toast("Necesitás estar logueado"); setTgLoad(false); return; }
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
    const newCode = "SH-" + s;
    await sb.from("telegram_links").delete().eq("user_id", session.user.id);
    const { error } = await sb.from("telegram_links").insert({
      user_id:    session.user.id,
      link_code:  newCode,
      linked:     false,
      created_at: new Date().toISOString(),
    });
    if (error) { toast("Error al generar código"); } else { setTgCode(newCode); setTgLinked(false); toast("Código generado ✓"); }
    setTgLoad(false);
  };

  /* cambiar contraseña */
  const changePwd = async () => {
    if (!newPwd) return toast("Ingresá la nueva contraseña");
    if (newPwd !== confPwd) return toast("Las contraseñas no coinciden");
    if (newPwd.length < 6)  return toast("Mínimo 6 caracteres");
    setPwdLoad(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setPwdLoad(false);
    if (error) { toast("Error: " + error.message); } else { setNewPwd(""); setConfPwd(""); toast("Contraseña actualizada ✓"); }
  };

  /* borrar todos los datos */
  const deleteAllData = async () => {
    if (!window.confirm("¿Borrar TODOS tus datos? Esta acción no se puede deshacer.")) return;
    Store.reset();
    if (SupabaseStorage) SupabaseStorage.removeItem("sh_data");
    toast("Datos borrados");
  };

  /* foto de perfil */
  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) { toast("Imagen muy grande (máx 500 KB)"); return; }
    const reader = new FileReader();
    reader.onload = ev => { set(s => { s.profile.photo = ev.target.result; }); toast("Foto actualizada ✓"); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="page">
      <PageHead title="Configuración" meta="Todo se guarda en la nube automáticamente" />
      <div className="grid" style={{ gridTemplateColumns: "210px 1fr", alignItems: "start" }}>
        {/* sub-nav */}
        <div style={{ display: "grid", gap: 3, position: "sticky", top: 0 }}>
          {CONFIG_TABS.map(([id, label, icon]) => (
            <div key={id} onClick={() => setTab(id)} className="row" style={{ gap: 11, padding: "10px 13px", borderRadius: "var(--r)", cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: tab === id ? "var(--violet-hi)" : "var(--tx-2)", background: tab === id ? "var(--violet-soft)" : "transparent", border: "1px solid " + (tab === id ? "var(--violet-line)" : "transparent") }}>
              <Icon name={icon} size={16} />{label}
            </div>
          ))}
          <div className="nav-sep"></div>
          <div className="row" style={{ gap: 11, padding: "10px 13px", borderRadius: "var(--r)", cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "#e8639b" }} onClick={onLogout}>
            <Icon name="logout" size={16} />Cerrar sesión
          </div>
        </div>

        {/* contenido */}
        <div className="card" style={{ minHeight: 420 }}>

          {/* ── APARIENCIA ── */}
          {tab === "apariencia" && <div className="fade-in">
            <div className="h3" style={{ marginBottom: 6 }}>Tamaño de la interfaz</div>
            <div className="small" style={{ marginBottom: 14 }}>Ajustá qué tan compacta o grande se ve toda la app.</div>
            <div className="row" style={{ gap: 16, marginBottom: 8 }}>
              <span className="mono" style={{ fontSize: 10 }}>Compacto</span>
              <input type="range" min="1" max="100" value={st.uiScale} onChange={e => setSetting("uiScale", +e.target.value)} style={{ flex: 1, accentColor: "var(--violet)" }} />
              <span className="mono" style={{ fontSize: 10 }}>Grande</span>
              <span className="display" style={{ fontSize: 26, color: "var(--violet-hi)", width: 52, textAlign: "right" }}>{st.uiScale}</span>
            </div>
            <div className="divider" style={{ margin: "18px 0" }}></div>
            <ConfigRow label="Color de acento" sub="Tono principal de la app">
              <div className="swatches">{ACCENT_SWATCHES.map(s => <div key={s.id} className={`swatch${st.accent === s.id ? " sel" : ""}`} style={{ background: s.c }} title={s.id} onClick={() => setSetting("accent", s.id)} />)}</div>
            </ConfigRow>
            <ConfigRow label="Tipografía">
              <Seg opts={FONT_OPTS} value={theme.font} onChange={v => setTheme("font", v)} />
            </ConfigRow>
            <ConfigRow label="Estilo de acento">
              <Seg opts={ACCENT_OPTS} value={theme.accent} onChange={v => setTheme("accent", v)} />
            </ConfigRow>
            <ConfigRow label="Brillo de fondo" sub="Glow ambiental">
              <Toggle on={st.glow} onChange={v => { setSetting("glow", v); const a = document.querySelector(".ambient"); if (a) a.style.opacity = v ? 1 : 0; }} />
            </ConfigRow>
            <ConfigRow label="Animaciones">
              <Toggle on={st.anim} onChange={v => setSetting("anim", v)} />
            </ConfigRow>
            <ConfigRow label="Sonidos de interfaz">
              <Toggle on={st.sounds} onChange={v => setSetting("sounds", v)} />
            </ConfigRow>
          </div>}

          {/* ── DASHBOARD ── */}
          {tab === "dashboard" && <div className="fade-in">
            <div className="card card-2" style={{ marginBottom: 16 }}>
              <div className="h3" style={{ marginBottom: 8 }}>Editor de widgets</div>
              <div className="small" style={{ marginBottom: 16 }}>{data.dashWidgets.length} widgets activos de {Object.keys(ALL_WIDGETS).length} disponibles.</div>
              <Btn variant="primary" icon="edit" onClick={onEditDash}>Abrir editor</Btn>
            </div>
            <ConfigRow label="Variante de dashboard" sub="Editorial · Grilla · Foco">
              <Seg opts={VARIANT_OPTS} value={theme.variant} onChange={v => setTheme("variant", v)} />
            </ConfigRow>
            <button className="addbtn" style={{ marginTop: 16, justifyContent: "center", color: "#e8639b" }} onClick={() => { set(s => { s.dashWidgets = ["tareas","agenda","xp","racha","completas","ring","materias","horas"]; s.dashSpans = {}; }); toast("Dashboard restaurado"); }}>
              <Icon name="refresh" size={15} color="#e8639b" /> Restaurar dashboard por defecto
            </button>
          </div>}

          {/* ── PERFIL ── */}
          {tab === "perfil" && <div className="fade-in" style={{ display: "grid", gap: 14 }}>
            <div className="row" style={{ gap: 16, marginBottom: 4 }}>
              {p.photo
                ? <img src={p.photo} style={{ width: 58, height: 58, borderRadius: 16, objectFit: "cover" }} />
                : <div className="avatar" style={{ width: 58, height: 58, borderRadius: 16, fontSize: 24 }}>{p.initial || "?"}</div>}
              <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
                <Icon name="camera" size={15} /> Cambiar foto
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
              </label>
            </div>
            <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: 14 }}>
              <Field label="Nombre"><input className="input" value={p.name || ""} onChange={e => { upProfile("name", e.target.value); upProfile("initial", e.target.value[0]?.toUpperCase() || p.initial); }} /></Field>
              <Field label="Inicial avatar"><input className="input" value={p.initial || ""} maxLength={1} onChange={e => upProfile("initial", e.target.value.toUpperCase())} /></Field>
            </div>
            <Field label="Facultad / Universidad"><input className="input" value={p.uni || ""} onChange={e => upProfile("uni", e.target.value)} /></Field>
            <Field label="Carrera"><input className="input" value={p.career || ""} onChange={e => upProfile("career", e.target.value)} /></Field>
          </div>}

          {/* ── INTEGRACIONES (Telegram) ── */}
          {tab === "integr" && <div className="fade-in">
            <div className="row between" style={{ marginBottom: 16 }}>
              <div className="row" style={{ gap: 12 }}>
                <div style={{ fontSize: 30 }}>🤖</div>
                <div><div className="h3">Hubby</div><div className="mono" style={{ marginTop: 4 }}>Asistente de Telegram</div></div>
              </div>
              <span className="chip" style={{ color: tgLinked ? "#3ecf9a" : "var(--tx-3)", borderColor: tgLinked ? "#3ecf9a55" : "var(--line-2)" }}>{tgLinked ? "Vinculado ✓" : "No vinculado"}</span>
            </div>

            <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
              {["Generá tu código abajo","Abrí @Hubby_ia_bot en Telegram","Pegá el código en el chat","¡Listo! Guardá cosas desde Telegram"].map((s, i) => (
                <div key={i} className="row" style={{ gap: 11 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--violet-soft)", color: "var(--violet-hi)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, flex: "0 0 auto" }}>{i + 1}</div>
                  <span style={{ fontSize: 13.5 }}>{s}</span>
                </div>
              ))}
            </div>

            {tgCode && (
              <div style={{ textAlign: "center", padding: "18px 0", marginBottom: 14, background: "var(--surface-2)", borderRadius: 12, border: "1px solid var(--line)" }}>
                <div className="mono" style={{ fontSize: 10.5, marginBottom: 8 }}>Tu código</div>
                <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 28, letterSpacing: ".12em", color: "var(--violet-hi)" }}>{tgCode}</div>
              </div>
            )}

            <div className="wrap-gap">
              <Btn variant="secondary" onClick={genTgCode} disabled={tgLoading}>{tgLoading ? "…" : tgCode ? "Regenerar código" : "Generar código"}</Btn>
              {tgCode && <Btn variant="secondary" icon="copy" onClick={() => { navigator.clipboard?.writeText(tgCode); toast("Código copiado"); }}>Copiar</Btn>}
              {tgCode && <Btn variant="primary" icon="send" onClick={() => window.open("https://t.me/Hubby_ia_bot?start=" + tgCode, "_blank")}>Abrir en Telegram</Btn>}
            </div>
          </div>}

          {/* ── CUENTA ── */}
          {tab === "cuenta" && <div className="fade-in">
            <ConfigRow label="Email">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--tx-2)" }}>{userEmail || "—"}</span>
            </ConfigRow>

            <div style={{ padding: "16px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Cambiar contraseña</div>
              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input className="input" type="password" placeholder="Nueva contraseña" value={newPwd}  onChange={e => setNewPwd(e.target.value)}  />
                <input className="input" type="password" placeholder="Repetir"          value={confPwd} onChange={e => setConfPwd(e.target.value)} />
              </div>
              <Btn variant="secondary" style={{ marginTop: 12 }} onClick={changePwd} disabled={pwdLoading}>
                {pwdLoading ? "Actualizando…" : "Actualizar contraseña"}
              </Btn>
            </div>

            <div style={{ marginTop: 20, display: "flex", gap: 18, flexWrap: "wrap" }}>
              <span className="link" style={{ color: "var(--tx-3)", fontSize: 13 }} onClick={() => { set(s => { s.settings = { uiScale: 40, glow: true, anim: true, sounds: false, accent: "violet" }; }); toast("Preferencias restablecidas"); }}>
                Restablecer preferencias
              </span>
              <span className="link" style={{ color: "#e8639b", fontSize: 13 }} onClick={deleteAllData}>
                🗑 Borrar todos mis datos
              </span>
            </div>
          </div>}

          {/* ── ACERCA DE ── */}
          {tab === "acerca" && <div className="fade-in">
            <BrandBanner size="lg">
              <div style={{ fontSize: 14, color: "var(--tx-2)", marginTop: 16, maxWidth: 420, textWrap: "pretty" }}>
                Tu facultad, tareas, finanzas, cocina, hogar y ocio — todo en un solo lugar, con tu asistente y tu pizarrón.
              </div>
            </BrandBanner>
            <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginTop: 18 }}>
              <div className="card card-2" style={{ textAlign: "center" }}><MonoLabel>Versión</MonoLabel><div className="h2" style={{ marginTop: 8 }}>2.0</div></div>
              <div className="card card-2" style={{ textAlign: "center" }}><MonoLabel>Secciones</MonoLabel><div className="h2" style={{ marginTop: 8 }}>{typeof NAV !== "undefined" ? NAV.filter(n => !n.sep).length : "—"}</div></div>
              <div className="card card-2" style={{ textAlign: "center" }}><MonoLabel>Materias</MonoLabel><div className="h2" style={{ marginTop: 8 }}>{data.subjects.length}</div></div>
            </div>

            {/* Instalar como app */}
            <InstallPWA />

            <div className="small" style={{ marginTop: 18, textAlign: "center", color: "var(--tx-3)" }}>
              Hecho con 💜 para estudiantes · Tus datos se sincronizan en la nube.
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
};

/* ── DIARIO MATUTINO ─────────────────────────────────────── */
const MorningModal = ({ onClose }) => {
  const [, set]        = useStore();
  const [energy, setEnergy] = React.useState(3);
  const [sleep, setSleep]   = React.useState(7);
  const [mood, setMood]     = React.useState("");
  const moods        = ["😞","😐","🙂","😄","🤩"];
  const energyLabels = ["Agotado","Bajo","Normal","Bien","Con pilas"];

  const save = () => {
    set(s => {
      if (!Array.isArray(s.morning)) s.morning = [];
      s.morning.unshift({
        date:   new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" }),
        energy, sleep, mood: mood || "🙂", wake: new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }),
      });
      if (s.morning.length > 30) s.morning = s.morning.slice(0, 30);
    });
    localStorage.setItem("sh_morning_" + new Date().toDateString(), "1");
    toast("¡Buen día! ☀️");
    onClose();
  };

  return (
    <Modal title="¿Cómo empezás el día?" sub="Tu registro matutino" icon="sun" onClose={onClose} corners
      footer={<><span className="link" style={{ color: "var(--tx-3)" }} onClick={() => { localStorage.setItem("sh_morning_" + new Date().toDateString(), "1"); onClose(); }}>Omitir</span><Btn variant="primary" onClick={save}>Guardar</Btn></>}>
      <div style={{ display: "grid", gap: 20 }}>
        <div>
          <div className="mono" style={{ marginBottom: 12 }}>Energía</div>
          <div className="row" style={{ gap: 8 }}>
            {energyLabels.map((l, i) => (
              <div key={i} onClick={() => setEnergy(i + 1)} style={{ flex: 1, textAlign: "center", padding: "11px 4px", borderRadius: 12, cursor: "pointer", border: "1px solid " + (energy === i + 1 ? "var(--violet)" : "var(--line)"), background: energy === i + 1 ? "var(--violet-soft)" : "var(--surface-2)" }}>
                <div className="display" style={{ fontSize: 22, color: energy === i + 1 ? "var(--violet-hi)" : "var(--tx-2)" }}>{i + 1}</div>
                <div style={{ fontSize: 10, color: "var(--tx-3)", marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mono" style={{ marginBottom: 12 }}>Horas de sueño</div>
          <div className="row" style={{ gap: 14 }}>
            <input type="range" min="0" max="12" value={sleep} onChange={e => setSleep(+e.target.value)} style={{ flex: 1, accentColor: "var(--violet)" }} />
            <span className="display" style={{ fontSize: 26, color: "var(--violet-hi)", width: 56, textAlign: "right" }}>{sleep}h</span>
          </div>
        </div>
        <div>
          <div className="mono" style={{ marginBottom: 12 }}>Humor</div>
          <div className="row" style={{ gap: 10 }}>
            {moods.map(m => <div key={m} onClick={() => setMood(m)} style={{ flex: 1, textAlign: "center", fontSize: 28, padding: "9px 0", borderRadius: 12, cursor: "pointer", border: "1px solid " + (mood === m ? "var(--violet)" : "var(--line)"), background: mood === m ? "var(--violet-soft)" : "transparent" }}>{m}</div>)}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export { ConfigSection, MorningModal, ConfigRow };