import React from 'react';

import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, playSound, addPomoMinutes, getPomoWeekMins, PomoStore, usePomoStore } from './store.jsx';
import { Btn, Chip, Modal, Field, PageHead, Empty } from './ui.jsx';

/* ============================================================
   POMODORO · CHAT IA (Gemini) · DIARIO · HISTORIAL
   ============================================================ */

/* ── POMODORO ───────────────────────────────────────────── */
const POMO_MODES = [["foco","Foco",25],["corto","Descanso",5],["largo","Descanso largo",15]];

const Pomodoro = () => {
  /* Usa PomoStore global — el timer sobrevive navegación */
  const ps = usePomoStore();
  const { running, secs, mode, cycles, task } = ps;
  const [sessionLog, setLog] = React.useState([]);

  /* Escucha eventos de completado del PomoStore */
  React.useEffect(() => {
    const onComplete = (e) => {
      setLog(l => [{
        time: new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }),
        mode: e.detail.mode,
        task: e.detail.task,
      }, ...l]);
    };
    window.addEventListener("pomo:complete", onComplete);
    return () => window.removeEventListener("pomo:complete", onComplete);
  }, []);

  /* Espacio para pausar */
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
        e.preventDefault(); PomoStore.toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const durations = { foco: 25, corto: 5, largo: 15 };
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const total = durations[mode] * 60, pct = ((total - secs) / total) * 100;
  const isFoco   = mode === "foco";
  const focoMins = sessionLog.filter(l => l.mode === "foco").length * 25;

  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <PageHead title="Pomodoro" meta="Estación de foco" />

      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 18, background: running && isFoco ? "var(--fill)" : "var(--surface-1)", border: running && isFoco ? "none" : "1px solid var(--line)", transition: "background .4s ease" }}>
        {/* tabs de modo */}
        <div className="row" style={{ gap: 8, padding: "16px 22px", borderBottom: running && isFoco ? "1px solid rgba(255,255,255,.18)" : "1px solid var(--line)", flexWrap: "wrap" }}>
          {POMO_MODES.map(([k, l, m]) => {
            const on = mode === k, light = running && isFoco;
            return (
              <button key={k} onClick={() => PomoStore.setMode(k)} style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "8px 16px", borderRadius: 99, border: "1px solid transparent", background: on ? (light ? "rgba(255,255,255,.18)" : "var(--violet-soft)") : "transparent", color: on ? (light ? "#fff" : "var(--violet-hi)") : (light ? "rgba(255,255,255,.7)" : "var(--tx-2)"), borderColor: on ? (light ? "rgba(255,255,255,.3)" : "var(--violet-line)") : "transparent" }}>{l} · {m}m</button>
            );
          })}
          <div style={{ flex: 1 }}></div>
          <div className="row" style={{ gap: 6 }}>
            {[0,1,2,3].map(i => <span key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: i < (cycles % 4) ? (running && isFoco ? "#fff" : "var(--violet)") : (running && isFoco ? "rgba(255,255,255,.25)" : "var(--surface-3)") }}></span>)}
            <span className="mono" style={{ fontSize: 10, marginLeft: 6, color: running && isFoco ? "rgba(255,255,255,.75)" : "var(--tx-3)" }}>ciclo {cycles % 4}/4</span>
          </div>
        </div>

        {/* reloj + controles */}
        <div className="row" style={{ gap: 30, padding: "34px 38px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 360px", minWidth: 300 }}>
            <div className="mono" style={{ color: running && isFoco ? "rgba(255,255,255,.7)" : "var(--tx-3)", marginBottom: 8 }}>{isFoco ? "Tiempo de foco" : "Descanso"}{running ? " · en curso" : ""}</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(78px,12vw,128px)", lineHeight: .9, letterSpacing: "-.04em", fontFeatureSettings: '"tnum"', color: running && isFoco ? "#fff" : "var(--violet-hi)" }}>{mm}:{ss}</div>
            <div style={{ height: 6, borderRadius: 99, marginTop: 22, background: running && isFoco ? "rgba(255,255,255,.22)" : "var(--surface-3)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: pct + "%", borderRadius: 99, background: running && isFoco ? "#fff" : "var(--fill)", transition: "width 1s linear" }}></div>
            </div>
          </div>
          <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 14, minWidth: 220 }}>
            <input
              value={task}
              onChange={e => PomoStore.setTask(e.target.value)}
              placeholder="¿En qué vas a trabajar?"
              style={{ width: "100%", background: running && isFoco ? "rgba(255,255,255,.14)" : "var(--surface-2)", border: "1px solid " + (running && isFoco ? "rgba(255,255,255,.25)" : "var(--line)"), borderRadius: "var(--r)", padding: "12px 15px", color: running && isFoco ? "#fff" : "var(--tx-1)", fontFamily: "var(--font-body)", fontSize: 14, outline: "none" }}
            />
            <div className="row" style={{ gap: 12 }}>
              <button onClick={() => PomoStore.toggle()} className="btn" style={{ flex: 1, padding: "16px", fontSize: 16, background: running && isFoco ? "#fff" : "var(--grad)", color: running && isFoco ? "#1a1a22" : "#fff", boxShadow: "0 8px 22px -10px rgba(0,0,0,.5)" }}>
                <Icon name={running ? "pause" : "play"} size={18} />{running ? "Pausar" : "Iniciar"}
              </button>
              <button onClick={() => PomoStore.reset()} className="icon-btn" style={{ width: 54, height: 54, flex: "0 0 auto", background: running && isFoco ? "rgba(255,255,255,.14)" : "var(--surface-1)", borderColor: running && isFoco ? "rgba(255,255,255,.25)" : "var(--line)", color: running && isFoco ? "#fff" : "var(--tx-2)" }}>
                <Icon name="refresh" size={20} />
              </button>
            </div>
            <div className="mono" style={{ fontSize: 9.5, color: running && isFoco ? "rgba(255,255,255,.5)" : "var(--tx-3)", textAlign: "center" }}>Espacio para pausar</div>
          </div>
        </div>
      </div>

      {/* métricas */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 18 }}>
        <div className="card" style={{ textAlign: "center", padding: 22 }}><div className="display" style={{ fontSize: 42, color: "var(--violet-hi)" }}>{sessionLog.length}</div><div className="small" style={{ marginTop: 6 }}>Sesiones hoy</div></div>
        <div className="card" style={{ textAlign: "center", padding: 22 }}><div className="display" style={{ fontSize: 42, color: "#3ecf9a" }}>{focoMins}<span style={{ fontSize: 22 }}>m</span></div><div className="small" style={{ marginTop: 6 }}>Foco acumulado</div></div>
        <div className="card" style={{ textAlign: "center", padding: 22 }}><div className="display" style={{ fontSize: 42 }}>{Math.round(getPomoWeekMins() / 60 * 10) / 10}<span style={{ fontSize: 22 }}>h</span></div><div className="small" style={{ marginTop: 6 }}>Esta semana</div></div>
      </div>

      <div className="card card-flush">
        <div className="row between" style={{ padding: "18px 22px", borderBottom: "1px solid var(--line)" }}>
          <div className="h3">Sesiones de hoy</div>
          <span className="mono" style={{ fontSize: 10.5 }}>{sessionLog.length} registradas</span>
        </div>
        {sessionLog.length === 0
          ? <div style={{ padding: 30 }}><Empty icon="clock" title="Sin sesiones aún" sub="Iniciá tu primer pomodoro y se irá registrando acá." /></div>
          : sessionLog.map((l, i) => (
            <div key={i} className="row between" style={{ padding: "13px 22px", borderBottom: "1px solid var(--line)" }}>
              <span className="row" style={{ gap: 12, fontSize: 14 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: l.mode === "foco" ? "var(--violet-soft)" : "var(--surface-2)", color: l.mode === "foco" ? "var(--violet-hi)" : "#3ecf9a" }}>
                  <Icon name={l.mode === "foco" ? "clock" : "mug"} size={15} />
                </span>
                {l.task || (l.mode === "foco" ? "Sesión de foco" : "Descanso")}
              </span>
              <span className="mono" style={{ fontSize: 11 }}>{l.time}</span>
            </div>
          ))}
      </div>
    </div>
  );
};

/* ── CHAT IA (Gemini via /api/chat) ─────────────────────── */
const SUGGESTIONS = [
  ["list",     "Plan del día"],
  ["flag",     "Priorizar tareas"],
  ["mug",      "Estoy cansado"],
  ["fileText", "Resumen pendientes"],
  ["clock",    "Técnica Pomodoro"],
  ["target",   "Estrategia de repaso"],
];

const buildSystemPrompt = (data) => {
  const profile  = data.profile || {};
  const tasks    = data.tasks   || [];
  const subjects = data.subjects|| [];
  const events   = data.events  || [];
  const missions = data.missions|| [];
  const morning  = (data.morning || [])[0] || null;
  const weekMins = getPomoWeekMins();

  const pending  = tasks.filter(t => !t.done);
  const urgent   = pending.filter(t => t.prio === "alta");
  const today    = new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });

  const lines = [
    `Sos EstudioIA, el asistente de productividad universitaria de ${profile.name || "el usuario"}.`,
    `Hoy es ${today}. Hora: ${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2,"0")}.`,
    profile.career ? `El usuario estudia ${profile.career}${profile.uni ? " en " + profile.uni : ""}, cursando ${profile.year}° año.` : "",
    subjects.length ? `Materias activas: ${subjects.map(s => `${s.name} (${s.pct}%)`).join(", ")}.` : "Sin materias cargadas aún.",
    pending.length
      ? `Tareas pendientes (${pending.length}, ${urgent.length} urgentes):\n${pending.slice(0, 10).map(t => `- "${t.t}"${t.prio === "alta" ? " 🔴" : t.prio === "media" ? " 🟡" : ""}${t.date ? " — vence " + t.date : ""}${t.subject ? " [" + t.subject + "]" : ""}`).join("\n")}`
      : "No hay tareas pendientes.",
    events.length ? `Próximos eventos: ${events.slice(0,4).map(e => e.title).join(", ")}.` : "",
    missions.length ? `Misiones activas: ${missions.slice(0,3).map(m => m.t).join(", ")}.` : "",
    morning ? `Hoy el usuario tiene energía ${morning.energy}/5, durmió ${morning.sleep}h, humor: ${morning.mood}.` : "",
    weekMins > 0 ? `Esta semana estudió ${Math.round(weekMins)} minutos con Pomodoro.` : "",
    `Respondé en español, sé directo y práctico. Si tenés que hacer una lista, usá puntos. Máximo 4 párrafos cortos.`,
  ].filter(Boolean);

  return lines.join("\n");
};

const ChatIA = () => {
  const [data]            = useStore();
  const [msgs, setMsgs]   = React.useState([]);
  const [draft, setDraft] = React.useState("");
  const [typing, setTyping] = React.useState(false);
  const endRef = React.useRef();

  React.useEffect(() => {
    endRef.current?.scrollTo(0, endRef.current.scrollHeight);
  }, [msgs, typing]);

  const send = async (textOverride) => {
    const text = (textOverride || draft).trim();
    if (!text || typing) return;
    const userMsg = { role: "user", content: text };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs.map((m, i) => ({ ...m, displayTime: i === newMsgs.length - 1 ? new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) : m.displayTime, me: m.role === "user" })));
    setDraft(""); setTyping(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: buildSystemPrompt(data),
          messages: newMsgs,
        }),
      });

      const json = await resp.json();
      const reply = json.text || "No pude responder. Intentá de nuevo.";
      setTyping(false);
      setMsgs(m => [...m, { role: "assistant", content: reply, me: false, displayTime: new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) }]);
    } catch (e) {
      setTyping(false);
      setMsgs(m => [...m, { role: "assistant", content: "Error de conexión. Verificá tu conexión a internet.", me: false, displayTime: "ahora" }]);
    }
  };

  const initial = data.profile?.initial || "?";

  return (
    <div className="page page-wide" style={{ height: "100%", display: "flex", flexDirection: "column", paddingBottom: 32 }}>
      <PageHead title="Chat IA" meta="Planificá tu día, priorizá tareas, pedí ayuda." />
      <div className="card card-flush" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div className="wrap-gap" style={{ padding: 18, borderBottom: "1px solid var(--line)" }}>
          {SUGGESTIONS.map(([ic, l]) => (
            <button key={l} className="tab" onClick={() => send(l)}>
              <Icon name={ic} size={15} /> {l}
            </button>
          ))}
        </div>

        <div ref={endRef} style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {msgs.length === 0 && (
            <div style={{ margin: "auto", textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, margin: "0 auto", background: "var(--violet-soft)", color: "var(--violet-hi)", display: "grid", placeItems: "center", border: "1px solid var(--violet-line)" }}>
                <Icon name="sparkles" size={26} />
              </div>
              <div className="h3" style={{ marginTop: 14 }}>EstudioIA</div>
              <div className="small" style={{ marginTop: 6 }}>Preguntame lo que necesites o usá un atajo arriba.</div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className="row" style={{ gap: 11, alignItems: "flex-start", flexDirection: m.me ? "row-reverse" : "row" }}>
              <div className="avatar" style={{ width: 32, height: 32, borderRadius: 9, fontSize: 14, background: m.me ? "var(--surface-3)" : "var(--grad)" }}>
                {m.me ? initial : <Icon name="sparkles" size={16} />}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: m.me ? "flex-end" : "flex-start", maxWidth: "76%" }}>
                <div className={`bubble ${m.me ? "me" : "ai"}`} style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                <div className="mono" style={{ fontSize: 9.5, marginTop: 5 }}>{m.displayTime}</div>
              </div>
            </div>
          ))}
          {typing && (
            <div className="row" style={{ gap: 11 }}>
              <div className="avatar" style={{ width: 32, height: 32, borderRadius: 9, fontSize: 14, background: "var(--grad)" }}>
                <Icon name="sparkles" size={16} />
              </div>
              <div className="bubble ai typing" style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
        </div>

        <form className="row" style={{ gap: 11, padding: 18, borderTop: "1px solid var(--line)" }} onSubmit={e => { e.preventDefault(); send(); }}>
          <input className="input" placeholder="Preguntá, planificá, pedí ayuda…" value={draft} onChange={e => setDraft(e.target.value)} disabled={typing} />
          <Btn variant="primary" icon="arrowUp" style={{ flex: "0 0 auto", width: 48, height: 48, padding: 0, borderRadius: 14 }} disabled={typing}></Btn>
        </form>
      </div>
    </div>
  );
};

/* ── DIARIO + SUEÑO ─────────────────────────────────────── */
const shortDay = (d = "") => {
  const wd  = (d.split(",")[0] || "").trim().slice(0, 3);
  const num = (d.match(/\d+/) || [""])[0];
  return { wd: wd.charAt(0).toUpperCase() + wd.slice(1), num };
};
const ENERGY_LABELS = ["Agotado", "Bajo", "Normal", "Bien", "Con pilas"];

const SleepPanel = ({ morning, onRegister }) => {
  const series = [...morning].slice(0, 7).reverse();
  const sleeps = series.map(m => m.sleep);
  const avg    = sleeps.length ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : 0;
  const max    = Math.max(9, ...sleeps);
  const last   = morning[0];
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="row between" style={{ marginBottom: 22, flexWrap: "wrap", gap: 14 }}>
        <div className="row" style={{ gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div className="row" style={{ gap: 13 }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--violet-soft)", color: "var(--violet-hi)", display: "grid", placeItems: "center" }}><Icon name="bed" size={22} /></span>
            <div><div className="h3">Sueño y energía</div><div className="mono" style={{ marginTop: 5 }}>Últimas {series.length} noches</div></div>
          </div>
          <div style={{ display: "flex", gap: 26 }}>
            <div><div className="display" style={{ fontSize: 36, color: "var(--violet-hi)" }}>{avg.toFixed(1)}<span style={{ fontSize: 18 }}>h</span></div><div className="small" style={{ fontSize: 11.5 }}>Promedio</div></div>
            {last && <div><div className="display" style={{ fontSize: 36 }}>{last.sleep}<span style={{ fontSize: 18 }}>h</span></div><div className="small" style={{ fontSize: 11.5 }}>Anoche</div></div>}
          </div>
        </div>
        <Btn variant="secondary" icon="sun" onClick={onRegister}>Registrar hoy</Btn>
      </div>
      <div className="row" style={{ gap: "clamp(8px,2vw,20px)", alignItems: "flex-end", height: 168, paddingTop: 8 }}>
        {series.map((m, i) => {
          const { wd, num } = shortDay(m.date);
          const isLast = i === series.length - 1;
          const h = Math.max(10, (m.sleep / max) * 130);
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7, height: "100%", justifyContent: "flex-end" }}>
              <div style={{ fontSize: 17 }}>{m.mood}</div>
              <div className="mono" style={{ fontSize: 10, color: isLast ? "var(--violet-hi)" : "var(--tx-3)" }}>{m.sleep}h</div>
              <div title={`${m.sleep}h · ${ENERGY_LABELS[(m.energy || 1) - 1]}`} style={{ width: "78%", maxWidth: 46, height: h, borderRadius: 8, background: isLast ? "var(--fill)" : "var(--surface-3)", transition: "height .5s cubic-bezier(.2,.8,.2,1)" }}></div>
              <div className="mono" style={{ fontSize: 9.5, textAlign: "center", lineHeight: 1.3 }}>{wd}<br />{num}</div>
            </div>
          );
        })}
      </div>
      <div className="row between" style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
        <span className="small" style={{ fontSize: 12 }}>Recomendado: <b className="tx-1">7–9 h</b> por noche</span>
        <span className="chip" style={{ color: avg >= 7 ? "#3ecf9a" : "#e8b04e", borderColor: (avg >= 7 ? "#3ecf9a" : "#e8b04e") + "55" }}>{avg >= 7 ? "Buen descanso" : "Dormís poco"}</span>
      </div>
    </div>
  );
};

const Diario = () => {
  const [data, set]        = useStore();
  const [draft, setDraft]  = React.useState(data.journalDraft || "");
  const [open, setOpen]      = React.useState(null);
  const [viewEntry, setViewEntry] = React.useState(null);
  const [showMorning, setSM] = React.useState(false);
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  const save = () => {
    if (!draft.trim()) return toast("Escribí algo primero");
    set(s => {
      if (!Array.isArray(s.journal)) s.journal = [];
      s.journal.unshift({ id: uid(), date: new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" }), time: new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }), text: draft.trim() });
      s.journalDraft = "";
    });
    setDraft("");
    playSound("save");
    toast("Entrada archivada ✓");
  };

  return (
    <div className="page page-wide">
      <PageHead title="Diario" meta={`Hoy · ${new Date().toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}`}>
        <Chip>{words} palabras</Chip>
      </PageHead>

      <SleepPanel morning={data.morning || []} onRegister={() => setSM(true)} />

      <div className="grid" style={{ gridTemplateColumns: "1.7fr 1fr" }}>
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="row between" style={{ marginBottom: 14 }}>
            <div className="h3">Entrada de hoy</div>
            <span className="mono" style={{ fontSize: 10.5 }}>{words} palabras</span>
          </div>
          <textarea
            value={draft}
            onChange={e => { setDraft(e.target.value); set(s => { s.journalDraft = e.target.value; }); }}
            placeholder="¿Cómo fue tu día? ¿Qué pensaste mientras estudiabas? Anotá lo que sea…"
            style={{ width: "100%", minHeight: 320, background: "none", border: "none", outline: "none", resize: "vertical", color: "var(--tx-1)", fontFamily: "var(--font-body)", fontSize: 15.5, lineHeight: 1.7 }}
          />
          <div className="row between" style={{ borderTop: "1px solid var(--line)", paddingTop: 18, marginTop: 14 }}>
            <span className="small">Al guardar se archiva y el diario queda en blanco.</span>
            <Btn variant="primary" icon="check" onClick={save}>Guardar y archivar</Btn>
          </div>
        </div>

        <div className="card" style={{ alignSelf: "start" }}>
          <div className="h3" style={{ marginBottom: 18 }}>Entradas anteriores</div>
          {(!data.journal || data.journal.length === 0)
            ? <Empty icon="pen" title="Sin entradas aún" sub="Tus entradas guardadas aparecen acá." />
            : (
              <div style={{ display: "grid", gap: 12 }}>
                {data.journal.map(j => (
                  <div key={j.id} className="card card-2 hoverable" style={{ padding: 16, cursor: "pointer" }} onClick={() => setViewEntry(j)}>
                    <div className="row between" style={{ marginBottom: 8 }}>
                      <span className="mono" style={{ fontSize: 10.5 }}>{j.date} · {j.time}</span>
                      <Icon name="expand" size={13} color="var(--tx-3)" />
                    </div>
                    <div className="small" style={{ color: "var(--tx-2)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.6 }}>{j.text}</div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
      {showMorning && <MorningModal onClose={() => setSM(false)} />}
      {viewEntry && (
        <Modal title={viewEntry.date} sub={viewEntry.time} icon="pen" onClose={() => setViewEntry(null)}>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: 15, color: "var(--tx-1)", maxHeight: "60vh", overflowY: "auto" }}>
            {viewEntry.text}
          </div>
          <div className="row" style={{ marginTop: 18, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setViewEntry(null)}>Cerrar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Historial = Diario;

export { Pomodoro, ChatIA, Diario, Historial };