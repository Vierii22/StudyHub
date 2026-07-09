import React from 'react';

import { Icon } from './icons.jsx';
import { useStore, getPomoWeekMins, ChatStore, useChatStore } from './store.jsx';
import { Btn, PageHead } from './ui.jsx';
import { APP_GUIDE } from './help-content.js';

/* ============================================================
   CHAT IA (Gemini via /api/chat) — "Hubby"
   ============================================================ */
const SUGGESTIONS = [
  ["list",     "Plan del día"],
  ["flag",     "Priorizar tareas"],
  ["fileText", "Resumen pendientes"],
  ["target",   "Estrategia de repaso"],
];

const buildSystemPrompt = (data) => {
  const profile  = data.profile || {};
  const tasks    = data.tasks   || [];
  const subjects = data.subjects|| [];
  const events   = data.events  || [];
  const weekMins = getPomoWeekMins();

  const pending  = tasks.filter(t => !t.done);
  const urgent   = pending.filter(t => t.prio === "alta");
  const today    = new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });

  const lines = [
    `Sos Hubby, el asistente de productividad universitaria de ${profile.name || "el usuario"}.`,
    `Hoy es ${today}. Hora: ${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2,"0")}.`,
    profile.career ? `El usuario estudia ${profile.career}${profile.uni ? " en " + profile.uni : ""}, cursando ${profile.year}° año.` : "",
    subjects.length ? `Materias activas: ${subjects.map(s => s.name).join(", ")}.` : "Sin materias cargadas aún.",
    pending.length
      ? `Tareas pendientes (${pending.length}, ${urgent.length} urgentes):\n${pending.slice(0, 10).map(t => `- "${t.t}"${t.prio === "alta" ? " 🔴" : t.prio === "media" ? " 🟡" : ""}${t.date ? " — vence " + t.date : ""}${t.subject ? " [" + t.subject + "]" : ""}`).join("\n")}`
      : "No hay tareas pendientes.",
    events.length ? `Próximos eventos: ${events.slice(0,4).map(e => e.title).join(", ")}.` : "",
    weekMins > 0 ? `Esta semana estudió ${Math.round(weekMins)} minutos con Pomodoro.` : "",
    `Respondé en español, sé directo y práctico. Si tenés que hacer una lista, usá puntos. Máximo 4 párrafos cortos.`,
    APP_GUIDE,
  ].filter(Boolean);

  return lines.join("\n");
};

const ChatIA = () => {
  const [data] = useStore();
  /* ChatStore — los mensajes sobreviven al navegar a otra sección */
  const chat   = useChatStore();
  const msgs   = chat.msgs;
  const draft  = chat.draft;
  const typing = chat.typing;
  const endRef = React.useRef();

  React.useEffect(() => {
    endRef.current?.scrollTo(0, endRef.current.scrollHeight);
  }, [msgs, typing]);

  const send = async (textOverride) => {
    const text = (textOverride || draft).trim();
    if (!text || typing) return;
    const now = () => new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    const userMsg = { role: "user", content: text, me: true, displayTime: now() };
    const newMsgs = [...msgs, userMsg];
    ChatStore.setMsgs(newMsgs);
    ChatStore.setDraft("");
    ChatStore.setTyping(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: buildSystemPrompt(data),
          messages: newMsgs.map(m => ({ role: m.me ? "user" : "assistant", content: m.content })),
        }),
      });
      const json  = await resp.json();
      const reply = json.text || "No pude responder. Intentá de nuevo.";
      ChatStore.setTyping(false);
      ChatStore.addMsg({ role: "assistant", content: reply, me: false, displayTime: now() });
    } catch {
      ChatStore.setTyping(false);
      ChatStore.addMsg({ role: "assistant", content: "Error de conexión. Verificá tu internet.", me: false, displayTime: "ahora" });
    }
  };

  const initial = data.profile?.initial || "?";

  return (
    <div className="page page-wide" style={{ height: "100%", display: "flex", flexDirection: "column", paddingBottom: 32 }}>
      <PageHead title="Hubby" meta="Planificá tu día, priorizá tareas, pedí ayuda." />
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
              <div style={{ width: 56, height: 56, borderRadius: 16, margin: "0 auto", background: "var(--field)", color: "var(--org)", display: "grid", placeItems: "center", border: "1px solid var(--line)" }}>
                <Icon name="sparkles" size={26} />
              </div>
              <div className="h3" style={{ marginTop: 14 }}>Hubby</div>
              <div className="small" style={{ marginTop: 6 }}>Preguntame lo que necesites o usá un atajo arriba.</div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className="row" style={{ gap: 11, alignItems: "flex-start", flexDirection: m.me ? "row-reverse" : "row" }}>
              <div className="avatar" style={{ width: 32, height: 32, borderRadius: 9, fontSize: 14, background: m.me ? "var(--field)" : "var(--grad)", color: m.me ? "var(--ink)" : "#fff" }}>
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
          <input className="input" placeholder="Preguntá, planificá, pedí ayuda…" value={draft} onChange={e => ChatStore.setDraft(e.target.value)} disabled={typing} />
          <Btn variant="primary" icon="arrowUp" style={{ flex: "0 0 auto", width: 48, height: 48, padding: 0, borderRadius: 14 }} disabled={typing}></Btn>
        </form>
      </div>
    </div>
  );
};

export { ChatIA };
