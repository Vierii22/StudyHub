import React from 'react';
import { Icon } from './icons.jsx';
import { useStore, uid, toast, getAllTasks } from './store.jsx';

/* ============================================================
   COMMAND PALETTE — Ctrl/Cmd+K
   Busca secciones, tareas, materias, acciones + crear rápido
   ============================================================ */

const SECTION_ITEMS = [
  { type: "section", id: "dashboard",  label: "Hoy — Dashboard",       icon: "layout" },
  { type: "section", id: "facultad",   label: "Facultad — Materias",    icon: "book" },
  { type: "section", id: "tareas",     label: "Tareas",                 icon: "check" },
  { type: "section", id: "misiones",   label: "Misiones — XP",          icon: "star" },
  { type: "section", id: "calendario", label: "Calendario",             icon: "calendar" },
  { type: "section", id: "pomodoro",   label: "Pomodoro — Enfoque",     icon: "timer" },
  { type: "section", id: "chat",       label: "Hubby — Chat IA",        icon: "chat" },
  { type: "section", id: "diario",     label: "Diario",                 icon: "edit" },
  { type: "section", id: "espacio",    label: "Mi Espacio",             icon: "space" },
  { type: "section", id: "historial",  label: "Historial",              icon: "clock" },
  { type: "section", id: "cocina",     label: "Cocina — Recetas",       icon: "chef" },
  { type: "section", id: "finanzas",   label: "Finanzas",               icon: "cash" },
  { type: "section", id: "casa",       label: "Casa",                   icon: "home" },
  { type: "section", id: "config",     label: "Configuración",          icon: "gear" },
];

function fuzzy(str, query) {
  const s = str.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return true;
  let i = 0;
  for (const ch of q) {
    const idx = s.indexOf(ch, i);
    if (idx < 0) return false;
    i = idx + 1;
  }
  return true;
}

/* Parsea texto libre y sugiere una acción de creación */
function parseCapture(text, subjects) {
  const t = text.trim();
  if (!t) return null;

  /* Evento de calendario: contiene fecha en formato "el DD" o "el DD/MM" */
  const dateMatch = t.match(/el\s+(\d{1,2})(?:\/(\d{1,2}))?/i);
  if (dateMatch) {
    return {
      type: "create-event",
      label: `Crear evento: "${t}"`,
      icon: "calendar",
      payload: { title: t, date: dateMatch[0] },
    };
  }

  /* Tarea: empieza con "tarea:" o contiene "para el" / "para mañana" */
  if (/^tarea:/i.test(t) || /para (el|mañana|hoy|el lunes|el martes|el miércoles|el jueves|el viernes)/i.test(t)) {
    const prio = /prioridad alta/i.test(t) ? "alta" : /prioridad baja/i.test(t) ? "baja" : "media";
    const title = t.replace(/^tarea:\s*/i, "").replace(/prioridad (alta|media|baja)/i, "").trim();
    return {
      type: "create-task",
      label: `Crear tarea: "${title}"`,
      icon: "check",
      payload: { t: title, prio, status: "pendiente", done: false },
    };
  }

  /* Compra/cocina: contiene "comprar" */
  if (/comprar|lista de compras/i.test(t)) {
    return {
      type: "create-shopping",
      label: `Agregar a compras: "${t.replace(/comprar\s*/i, "")}"`,
      icon: "chef",
      payload: { item: t.replace(/comprar\s*/i, "").trim() },
    };
  }

  /* Default: crear tarea */
  return {
    type: "create-task",
    label: `Crear tarea: "${t}"`,
    icon: "check",
    payload: { t, prio: "media", status: "pendiente", done: false },
  };
}

const Palette = ({ onNav, onClose }) => {
  const [data, set] = useStore();
  const [query, setQuery] = React.useState("");
  const [sel, setSel] = React.useState(0);
  const inputRef = React.useRef(null);

  React.useEffect(() => { inputRef.current?.focus(); }, []);

  const tasks = getAllTasks(data).filter(t => !t.done);
  const subjects = data.subjects || [];

  /* Construir lista de items */
  const items = React.useMemo(() => {
    const q = query.trim();
    const result = [];

    /* Captura rápida al haber texto */
    const capture = parseCapture(q, subjects);
    if (capture) result.push(capture);

    /* Secciones */
    SECTION_ITEMS.filter(s => fuzzy(s.label, q)).forEach(s => result.push(s));

    /* Materias */
    subjects.filter(s => fuzzy(s.name, q)).forEach(s =>
      result.push({ type: "section", id: "facultad", label: `Materia: ${s.name}`, icon: "book", subjectId: s.id })
    );

    /* Tareas activas */
    if (q) tasks.filter(t => fuzzy(t.t, q)).slice(0, 5).forEach(t =>
      result.push({ type: "task", id: t.id, label: t.t, icon: "check", task: t })
    );

    return result;
  }, [query, tasks, subjects]);

  /* Ajustar selección al cambiar items */
  React.useEffect(() => { setSel(0); }, [query]);

  const execute = (item) => {
    if (!item) return;
    if (item.type === "section") {
      onNav(item.id);
      onClose();
    } else if (item.type === "task") {
      onNav("tareas");
      onClose();
    } else if (item.type === "create-task") {
      set(s => s.tasks.push({ id: uid(), ...item.payload }));
      toast(`Tarea creada: ${item.payload.t}`);
      onClose();
    } else if (item.type === "create-event") {
      toast("Evento: abrí el Calendario para completar el detalle.");
      onNav("calendario");
      onClose();
    } else if (item.type === "create-shopping") {
      set(s => {
        if (!s.kitchen) s.kitchen = {};
        if (!Array.isArray(s.kitchen.shopping)) s.kitchen.shopping = [];
        s.kitchen.shopping.push({ id: uid(), name: item.payload.item, done: false });
      });
      toast(`Agregado a compras: ${item.payload.item}`);
      onClose();
    }
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, items.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter")     { e.preventDefault(); execute(items[sel]); }
    if (e.key === "Escape")    { onClose(); }
  };

  const typeLabel = { section: "Sección", task: "Tarea", "create-task": "Crear", "create-event": "Crear", "create-shopping": "Crear" };
  const typeColor = { section: "var(--violet-hi)", task: "var(--tx-3)", "create-task": "#3ecf9a", "create-event": "#4ec5e8", "create-shopping": "#e8b04e" };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,.65)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      paddingTop: "13vh",
    }} onClick={onClose}>
      <div style={{
        width: "min(640px,95vw)", background: "var(--surface-1)",
        border: "1px solid var(--line-2)", borderRadius: "var(--r-xl)",
        boxShadow: "0 32px 80px -12px rgba(0,0,0,.7)",
        overflow: "hidden",
      }} onClick={e => e.stopPropagation()}>

        {/* Input */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <Icon name="search" size={18} color="var(--tx-3)" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Buscá secciones, tareas, materias o escribí para crear…"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: 16, color: "var(--tx-1)", fontFamily: "var(--font-body)",
            }}
          />
          <kbd style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--tx-3)", padding: "2px 6px", border: "1px solid var(--line-2)", borderRadius: 5 }}>Esc</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 380, overflowY: "auto", padding: "8px 0" }}>
          {items.length === 0 && (
            <div style={{ padding: "24px 20px", color: "var(--tx-3)", fontSize: 14, textAlign: "center" }}>
              Sin resultados — seguí escribiendo para crear
            </div>
          )}
          {items.map((item, i) => (
            <div
              key={i}
              onClick={() => execute(item)}
              onMouseEnter={() => setSel(i)}
              style={{
                display: "flex", alignItems: "center", gap: 13,
                padding: "11px 20px", cursor: "pointer",
                background: sel === i ? "var(--surface-2)" : "transparent",
                borderRadius: 8, margin: "0 8px",
                transition: "background .1s",
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--surface-2)", display: "grid", placeItems: "center", flex: "0 0 auto", border: "1px solid var(--line)" }}>
                <Icon name={item.icon} size={15} color={typeColor[item.type] || "var(--tx-2)"} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</div>
              </div>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: typeColor[item.type] || "var(--tx-3)", flex: "0 0 auto" }}>
                {typeLabel[item.type]}
              </span>
              {sel === i && <Icon name="enter" size={12} color="var(--tx-3)" />}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 20px", borderTop: "1px solid var(--line)", display: "flex", gap: 16, color: "var(--tx-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}>
          <span>↑↓ navegar</span>
          <span>↵ confirmar</span>
          <span>Esc cerrar</span>
        </div>
      </div>
    </div>
  );
};

export { Palette, parseCapture };
