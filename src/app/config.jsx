import React from 'react';

import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast } from './store.jsx';
import { Btn, MonoLabel, PageHead, Field, Toggle } from './ui.jsx';
import { supabase } from '../supabase.js';
import { SupabaseStorage } from '../storage.js';

/* ============================================================
   CONFIGURACIÓN — sección de página completa
   Con auth Supabase real: Telegram, password, borrar datos
   ============================================================ */

const CONFIG_TABS = [
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
      <div style={{ color: "var(--green)", marginBottom: 6 }}><Icon name="check" size={22} /></div>
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

const ROLES_CONFIG = [
  { id: "uni",  label: "Universidad",  emoji: "🎓" },
  { id: "sec",  label: "Secundaria",   emoji: "🏫" },
  { id: "work", label: "Trabajo",      emoji: "💼" },
];

const ConfigSection = ({ onLogout, initialTab }) => {
  const [data, set] = useStore();
  const [tab, setTab] = React.useState(initialTab || "perfil");

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
  const upProfile  = (k, v) => set(s => s.profile[k] = v);

  /* cargar email real de Supabase */
  React.useEffect(() => {
    const sb = supabase;
    if (!sb) return;
    sb.auth.getUser().then(({ data: u }) => {
      if (u?.user?.email) setUserEmail(u.user.email);
    });
  }, []);

  /* helper: obtiene el user_id de la sesión activa (compatible con confirmación pendiente) */
  const getSbUserId = async (sb) => {
    try {
      const { data: sd } = await sb.auth.getSession();
      if (sd?.session?.user?.id) return sd.session.user.id;
      const { data: ud } = await sb.auth.getUser();
      return ud?.user?.id || null;
    } catch (_) { return null; }
  };

  /* cargar código Telegram al abrir la pestaña */
  React.useEffect(() => {
    if (tab !== "integr") return;
    (async () => {
      const sb = supabase;
      if (!sb) return;
      const userId = await getSbUserId(sb);
      if (!userId) return;
      const { data: row } = await sb.from("telegram_links").select("link_code,linked").eq("user_id", userId).maybeSingle();
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
    const userId = await getSbUserId(sb);
    if (!userId) { toast("Necesitás estar logueado"); setTgLoad(false); return; }
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
    const newCode = "SH-" + s;
    await sb.from("telegram_links").delete().eq("user_id", userId);
    const { error } = await sb.from("telegram_links").insert({
      user_id:    userId,
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
        <div className="cfg-nav">
          {CONFIG_TABS.map(([id, label, icon]) => (
            <div key={id} onClick={() => setTab(id)} className="row cfg-tab" style={{ gap: 11, padding: "10px 13px", borderRadius: "var(--r)", cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: tab === id ? "var(--violet-hi)" : "var(--tx-2)", background: tab === id ? "var(--violet-soft)" : "transparent", border: "1px solid " + (tab === id ? "var(--violet-line)" : "transparent"), whiteSpace: "nowrap" }}>
              <Icon name={icon} size={16} />{label}
            </div>
          ))}
          <div className="cfg-sep"></div>
          <div className="row cfg-tab" style={{ gap: 11, padding: "10px 13px", borderRadius: "var(--r)", cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "var(--org-deep)", whiteSpace: "nowrap" }} onClick={onLogout}>
            <Icon name="logout" size={16} />Cerrar sesión
          </div>
        </div>

        {/* contenido */}
        <div className="card" style={{ minHeight: 420 }}>

          {/* ── PERFIL ── */}
          {tab === "perfil" && <div className="fade-in" style={{ display: "grid", gap: 14 }}>
            {/* foto + nombre */}
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

            {/* selector de rol — igual que en el onboarding */}
            <Field label="¿A qué te dedicás?">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {ROLES_CONFIG.map(r => (
                  <div
                    key={r.id}
                    onClick={() => upProfile("role", r.id)}
                    style={{
                      padding: "12px 10px",
                      borderRadius: 12,
                      border: `1.5px solid ${p.role === r.id ? "var(--violet)" : "var(--line-2)"}`,
                      background: p.role === r.id ? "var(--violet-soft)" : "var(--surface-2)",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all .15s",
                    }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 5 }}>{r.emoji}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: p.role === r.id ? "var(--violet-hi)" : "var(--tx-2)" }}>{r.label}</div>
                  </div>
                ))}
              </div>
            </Field>

            {/* campos según rol */}
            {p.role === "work" ? (
              <Field label="¿En qué trabajás?">
                <textarea className="input" rows={3} value={p.career || ""} onChange={e => upProfile("career", e.target.value)} placeholder="Describí tu trabajo…" style={{ resize: "vertical" }} />
              </Field>
            ) : (
              <>
                <Field label={p.role === "sec" ? "Escuela" : "Facultad / Universidad"}>
                  <input className="input" value={p.uni || ""} onChange={e => upProfile("uni", e.target.value)} />
                </Field>
                {p.role !== "sec" && (
                  <Field label="Carrera">
                    <input className="input" value={p.career || ""} onChange={e => upProfile("career", e.target.value)} />
                  </Field>
                )}
              </>
            )}
          </div>}

          {/* ── INTEGRACIONES (Telegram) ── */}
          {tab === "integr" && <div className="fade-in">
            <div className="row between" style={{ marginBottom: 16 }}>
              <div className="row" style={{ gap: 12 }}>
                <div style={{ fontSize: 30 }}>🤖</div>
                <div><div className="h3">Hubby</div><div className="mono" style={{ marginTop: 4 }}>Asistente de Telegram</div></div>
              </div>
              <span className="chip" style={{ color: tgLinked ? "var(--green)" : "var(--tx-3)", borderColor: tgLinked ? "var(--green)55" : "var(--line-2)" }}>{tgLinked ? "Vinculado ✓" : "No vinculado"}</span>
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
              <span className="link" style={{ color: "var(--tx-3)", fontSize: 13 }} onClick={() => { set(s => { s.settings = { uiScale: 40 }; }); toast("Preferencias restablecidas"); }}>
                Restablecer preferencias
              </span>
              <span className="link" style={{ color: "var(--org-deep)", fontSize: 13 }} onClick={deleteAllData}>
                🗑 Borrar todos mis datos
              </span>
            </div>
          </div>}

          {/* ── ACERCA DE ── */}
          {tab === "acerca" && <div className="fade-in">
            <div className="row" style={{ gap: 14, alignItems: "center" }}>
              <span className="tb-logo"><span className="tb-dot" /></span>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20 }}><span style={{ color: "var(--soft)", fontWeight: 500 }}>study</span>hub<span style={{ color: "var(--org)" }}>.</span></div>
                <div className="small" style={{ marginTop: 4, maxWidth: 420, textWrap: "pretty" }}>
                  Tu facultad, calendario, notas y progreso — todo en un solo lugar, con tu asistente.
                </div>
              </div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(2,1fr)", marginTop: 18 }}>
              <div className="card card-2" style={{ textAlign: "center" }}><MonoLabel>Versión</MonoLabel><div className="h2" style={{ marginTop: 8 }}>2.0</div></div>
              <div className="card card-2" style={{ textAlign: "center" }}><MonoLabel>Materias</MonoLabel><div className="h2" style={{ marginTop: 8 }}>{data.subjects.length}</div></div>
            </div>

            {/* Instalar como app */}
            <InstallPWA />

            <div className="small" style={{ marginTop: 18, textAlign: "center", color: "var(--tx-3)" }}>
              Tus datos se sincronizan en la nube.
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
};

export { ConfigSection, ConfigRow };