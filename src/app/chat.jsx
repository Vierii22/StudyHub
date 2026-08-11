import React from 'react';

import { Icon } from './icons.jsx';
import { useStore, ChatStore, useChatStore } from './store.jsx';
import { Btn, PageHead, Hubby } from './ui.jsx';
import { buildSystemPrompt } from './aiPrompt.js';
import { parseActions, applyActions, needsConfirm, describeAction } from './chatActions.js';

/* ============================================================
   CHAT IA (Gemini via /api/chat) — "Hubby", tu organizador in-app
   Dos funciones: (1) entender/usar la app, (2) organizarte y ejecutar.
   El prompt (manual de la app + protocolo de acciones) vive en
   aiPrompt.js, COMPARTIDO con la captura rápida del dashboard —
   mismo cerebro en los dos lugares.
   ============================================================ */
const SUGGESTIONS = [
  ["calendar", "Organizá mi semana"],
  ["flag",     "¿Qué priorizo hoy?"],
  ["target",   "¿Cómo voy con mis materias?"],
  ["info",     "¿Cómo uso la app?"],
];

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
      const { text, actions } = parseActions(reply);
      const confirmables = actions.filter(needsConfirm);
      const safe         = actions.filter(a => !needsConfirm(a));
      const done         = safe.length ? applyActions(safe) : [];
      ChatStore.setTyping(false);
      ChatStore.addMsg({ role: "assistant", content: text, me: false, displayTime: now(), done, confirm: confirmables });
    } catch {
      ChatStore.setTyping(false);
      ChatStore.addMsg({ role: "assistant", content: "Error de conexión. Verificá tu internet.", me: false, displayTime: "ahora" });
    }
  };

  /* confirmar / cancelar las acciones destructivas de un mensaje */
  const confirmActions = (i) => {
    const m = msgs[i];
    if (!m?.confirm?.length) return;
    const results = applyActions(m.confirm);
    ChatStore.setMsgs(msgs.map((mm, j) =>
      j === i ? { ...mm, confirm: [], done: [...(mm.done || []), ...results] } : mm));
  };
  const cancelActions = (i) => {
    ChatStore.setMsgs(msgs.map((mm, j) =>
      j === i ? { ...mm, confirm: [], canceled: true } : mm));
  };

  const initial = data.profile?.initial || "?";

  return (
    <div className="page page-wide chat-page" style={{ height: "100%", display: "flex", flexDirection: "column", paddingBottom: 32 }}>
      <PageHead title="Hubby" meta="Tu organizador: te ayudo a usar la app y a organizarte con tus datos." />
      <div className="card card-flush chat-shell" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div className="chat-sugg" style={{ display: "flex", gap: 10, padding: 16, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          {SUGGESTIONS.map(([ic, l]) => (
            <button key={l} className="tab" onClick={() => send(l)}>
              <Icon name={ic} size={15} /> {l}
            </button>
          ))}
        </div>

        <div ref={endRef} style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {msgs.length === 0 && (
            <div style={{ margin: "auto", width: "100%", maxWidth: 440 }}>
              <div style={{ textAlign: "center" }}>
                <Hubby pose="saluda" size={92} className="hubby-float" style={{ margin: "0 auto" }} />
                <div className="h3" style={{ marginTop: 6 }}>¡Hola! Soy Hubby</div>
                <div className="small" style={{ marginTop: 6, marginBottom: 18 }}>Tu organizador dentro de la app. Te doy una mano con dos cosas:</div>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <button className="chat-fn" onClick={() => send("¿Cómo uso la app? Explicame las funciones principales")}>
                  <span className="chat-fn-ic"><Icon name="info" size={19} /></span>
                  <div><div className="chat-fn-t">Entender y usar la app</div><div className="chat-fn-s">Te explico cómo se hace algo, o te lo agrego yo si a mano cuesta.</div></div>
                </button>
                <button className="chat-fn" onClick={() => send("Organizá mi semana con lo que tengo pendiente")}>
                  <span className="chat-fn-ic"><Icon name="target" size={19} /></span>
                  <div><div className="chat-fn-t">Organizarte y ejecutar</div><div className="chat-fn-s">Planifico, priorizo y te aconsejo con tus datos — y lo hago por vos.</div></div>
                </button>
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className="row" style={{ gap: 11, alignItems: "flex-start", flexDirection: m.me ? "row-reverse" : "row" }}>
              <div className="avatar" style={{ width: 32, height: 32, borderRadius: 9, fontSize: 14, background: m.me ? "var(--field)" : "var(--grad)", color: m.me ? "var(--ink)" : "#fff" }}>
                {m.me ? initial : <Icon name="sparkles" size={16} />}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: m.me ? "flex-end" : "flex-start", maxWidth: "76%" }}>
                <div className={`bubble ${m.me ? "me" : "ai"}`} style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>

                {/* acciones ya aplicadas */}
                {m.done?.length > 0 && (
                  <div className="chat-acts">
                    {m.done.map((r, k) => (
                      <div key={k} className={`chat-act ${r.ok ? "ok" : "bad"}`}>
                        <Icon name={r.ok ? "check" : "x"} size={13} /> {r.label}
                      </div>
                    ))}
                  </div>
                )}

                {/* acciones destructivas pendientes de confirmar */}
                {m.confirm?.length > 0 && (
                  <div className="chat-confirm">
                    <div className="chat-confirm-t"><Icon name="trash" size={14} /> ¿Confirmás?</div>
                    {m.confirm.map((a, k) => (
                      <div key={k} className="chat-confirm-i">{describeAction(a)}</div>
                    ))}
                    <div className="chat-confirm-btns">
                      <button className="chat-confirm-yes" onClick={() => confirmActions(i)}>Sí, hacelo</button>
                      <button className="chat-confirm-no" onClick={() => cancelActions(i)}>Cancelar</button>
                    </div>
                  </div>
                )}
                {m.canceled && <div className="chat-act muted"><Icon name="x" size={13} /> Cancelado</div>}

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
