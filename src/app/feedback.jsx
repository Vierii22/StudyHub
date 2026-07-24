import React from 'react';

import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast } from './store.jsx';
import { Btn, TerminalCorners } from './ui.jsx';
import { supabase } from '../supabase.js';

/* ============================================================
   FEEDBACK — botón flotante + panel "Ideas y comentarios"
   ============================================================ */
const FB_TYPES = [
  { id: "bug", label: "Bug", icon: "bug", color: "#B8461A", ph: "¿Qué dejó de funcionar? Contanos los pasos para reproducirlo." },
  { id: "sugerencia", label: "Sugerencia", icon: "idea", color: "#C68A2E", ph: "¿Qué mejorarías de la app?" },
  { id: "idea", label: "Idea", icon: "sparkles", color: "#3B6D11", ph: "Tirá esa idea nueva que se te ocurrió ✨" },
];

const FeedbackWidget = ({ section }) => {
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState("sugerencia");
  const [text, setText] = React.useState("");
  const [contact, setContact] = React.useState("");
  const cur = FB_TYPES.find(t => t.id === type);
  /* en el Chat el bot\u00f3n de enviar vive abajo a la derecha \u2192 escondemos el FAB ah\u00ed */
  const hideFab = section === "chat";

  const [sending, setSending] = React.useState(false);

  const send = async () => {
    if (!text.trim()) return toast("Escribí tu mensaje primero");
    setSending(true);
    try {
      // Obtener user_id si está logueado
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;

      const { error } = await supabase.from("feedback").insert({
        type,
        message: text.trim(),
        contact: contact.trim() || null,
        section: section || null,
        user_id: userId,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
      toast("¡Gracias por tu feedback! 🙌");
      setText(""); setContact(""); setOpen(false);
    } catch (e) {
      console.error("Feedback error:", e);
      toast("Error al enviar, intentá de nuevo");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* botón flotante (oculto en el Chat para no chocar con el enviar) */}
      {!hideFab && (
        <button className="fb-fab" onClick={() => setOpen(o => !o)} title="Ideas y comentarios" aria-label="Feedback">
          <Icon name={open ? "x" : "chat"} size={20} />
        </button>
      )}

      {/* panel */}
      {open && (
        <div className="fb-scrim" onClick={() => setOpen(false)}>
        <div className="fb-panel tcorners" onClick={e => e.stopPropagation()}>
        <TerminalCorners />
        <div className="row between" style={{ marginBottom: 6 }}>
          <div className="h2">Ideas y comentarios</div>
          <div className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setOpen(false)}><Icon name="x" size={16} /></div>
        </div>
        <div className="small" style={{ marginBottom: 22, textWrap: "pretty" }}>
          Contanos qué te gustaría ver en StudyHub, reportá un bug o dejanos cualquier sugerencia.
        </div>

        <div className="mono" style={{ marginBottom: 11 }}>¿Qué tipo de mensaje es?</div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 22 }}>
          {FB_TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)}
              className="fb-type"
              style={{
                borderColor: type === t.id ? t.color : "var(--line-2)",
                background: type === t.id ? t.color + "1c" : "var(--surface-2)",
                color: type === t.id ? t.color : "var(--tx-2)",
              }}>
              <Icon name={t.icon} size={22} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="mono" style={{ marginBottom: 11 }}>Tu mensaje</div>
        <textarea className="input" rows={5} value={text} onChange={e => setText(e.target.value)}
          placeholder={cur.ph} style={{ resize: "vertical", marginBottom: 22 }} />

        <div className="mono" style={{ marginBottom: 11 }}>¿Cómo te contactamos?</div>
        <input className="input" value={contact} onChange={e => setContact(e.target.value)}
          placeholder="Email, link de X/Twitter, Discord, etc." />
        <div className="small" style={{ marginTop: 9, fontSize: 11.5, color: "var(--tx-3)", textWrap: "pretty" }}>
          Opcional — dejalo si querés que te respondamos.
        </div>

        <Btn variant="primary" icon="send" onClick={send} disabled={sending} style={{ width: "100%", marginTop: 22, padding: "14px", fontSize: 15 }}>{sending ? "Enviando…" : "Enviar"}</Btn>
        </div>
        </div>
      )}
    </>
  );
};

export { FeedbackWidget };