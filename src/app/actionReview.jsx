import React from 'react';

import { Field, DatePicker, Seg } from './ui.jsx';
import { describeAction } from './chatActions.js';

/* ============================================================
   REVISAR ANTES DE GUARDAR (temporal)
   Mientras la IA no sea 100% confiable, el usuario puede tocar
   los campos que propuso antes de aceptar — no se aplica nada
   hasta que confirme. Para volver a que las acciones seguras se
   apliquen solas, ver ALWAYS_CONFIRM en chatActions.js.
   ============================================================ */

const WEEKDAYS = [{ lbl: "Lun", dow: 1 }, { lbl: "Mar", dow: 2 }, { lbl: "Mié", dow: 3 }, { lbl: "Jue", dow: 4 }, { lbl: "Vie", dow: 5 }, { lbl: "Sáb", dow: 6 }, { lbl: "Dom", dow: 0 }];
const PRIO_OPTS = [{ id: "alta", label: "Alta" }, { id: "media", label: "Media" }, { id: "baja", label: "Baja" }];
const KIND_OPTS = [{ id: "evento", label: "Evento" }, { id: "clase", label: "Clase" }, { id: "estudio", label: "Estudiar" }, { id: "parcial", label: "Parcial" }, { id: "entrega", label: "Entrega" }];

/* tipos para los que tiene sentido mostrar campos editables — el resto
   (completar/borrar por nombre) sólo muestra el resumen + aceptar/cancelar */
const EDITABLE_TYPES = new Set(["add_task", "edit_task", "add_event", "add_recurring_event", "note_subject"]);

const SubjectSelect = ({ value, subjects, onChange }) => (
  !subjects?.length ? null : (
    <Field label="Materia" hint="opcional">
      <select className="input" value={value || ""} onChange={e => onChange(e.target.value || null)}>
        <option value="">— sin materia —</option>
        {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
      </select>
    </Field>
  )
);

const ActionEditor = ({ action, subjects, onChange }) => {
  const up = (k, v) => onChange({ ...action, [k]: v });
  if (!EDITABLE_TYPES.has(action.type)) return null;

  switch (action.type) {
    case "add_task":
    case "edit_task":
      return (
        <div className="ar-fields">
          <Field label="Título"><input className="input" value={action.t || ""} onChange={e => up("t", e.target.value)} /></Field>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Fecha"><DatePicker value={action.due || ""} onChange={v => up("due", v)} placeholder="Sin fecha" /></Field>
            <Field label="Prioridad"><Seg opts={PRIO_OPTS} value={action.prio || "media"} onChange={v => up("prio", v)} /></Field>
          </div>
          <SubjectSelect value={action.subject} subjects={subjects} onChange={v => up("subject", v)} />
        </div>
      );

    case "add_event":
      return (
        <div className="ar-fields">
          <Field label="Título"><input className="input" value={action.title || ""} onChange={e => up("title", e.target.value)} /></Field>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Fecha"><DatePicker value={action.date || ""} onChange={v => up("date", v)} allowClear={false} /></Field>
            <Field label="Hora"><input className="input" type="time" value={action.time || ""} onChange={e => up("time", e.target.value)} /></Field>
          </div>
          <Field label="Tipo"><Seg opts={KIND_OPTS} value={action.kind || "evento"} onChange={v => up("kind", v)} /></Field>
          <SubjectSelect value={action.subject} subjects={subjects} onChange={v => up("subject", v)} />
        </div>
      );

    case "add_recurring_event": {
      const dows = action.dows || [];
      const toggleDow = (d) => up("dows", dows.includes(d) ? dows.filter(x => x !== d) : [...dows, d]);
      return (
        <div className="ar-fields">
          <Field label="Título"><input className="input" value={action.title || ""} onChange={e => up("title", e.target.value)} /></Field>
          <Field label="Días">
            <div className="rep-days">
              {WEEKDAYS.map(w => <button type="button" key={w.dow} className={`rep-day${dows.includes(w.dow) ? " on" : ""}`} onClick={() => toggleDow(w.dow)}>{w.lbl}</button>)}
            </div>
          </Field>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Desde"><DatePicker value={action.from || ""} onChange={v => up("from", v)} allowClear={false} /></Field>
            <Field label="Hasta"><DatePicker value={action.until || ""} onChange={v => up("until", v)} allowClear={false} /></Field>
          </div>
          <Field label="Hora"><input className="input" type="time" value={action.time || ""} onChange={e => up("time", e.target.value)} /></Field>
          <SubjectSelect value={action.subject} subjects={subjects} onChange={v => up("subject", v)} />
        </div>
      );
    }

    case "note_subject":
      return (
        <div className="ar-fields">
          <SubjectSelect value={action.subject} subjects={subjects} onChange={v => up("subject", v)} />
          <Field label="Texto"><textarea className="input" rows={2} value={action.text || ""} onChange={e => up("text", e.target.value)} /></Field>
        </div>
      );

    default:
      return null;
  }
};

/* ============================================================
   UNA acción a confirmar. Antes se mostraba el formulario
   editable SIEMPRE, para cada acción — mucho para algo que el
   mensaje de Hubby ya explicó en texto. Ahora por defecto solo
   se ve la descripción; el formulario queda un toque atrás de
   "Editar", para cuando algo salió mal y hay que corregirlo.
   ============================================================ */
const ConfirmItem = ({ action, subjects, onChange }) => {
  const [editando, setEditando] = React.useState(false);
  const editable = EDITABLE_TYPES.has(action.type);

  return (
    <div className="chat-confirm-item">
      <div className="chat-confirm-i">{describeAction(action)}</div>
      {editable && (
        editando
          ? <ActionEditor action={action} subjects={subjects} onChange={onChange} />
          : <button type="button" className="chat-confirm-edit" onClick={() => setEditando(true)}>Editar</button>
      )}
    </div>
  );
};

export { ActionEditor, ConfirmItem };
