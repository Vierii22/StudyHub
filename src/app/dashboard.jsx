import React from 'react';

import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, COLORS, PRIO, STATUS, getPomoWeekMins, getPomoWeekByDay } from './store.jsx';
import { Btn, Chip, MonoLabel, PageHead, Empty, Toggle, ProgressRing, SubjectDot, TerminalCorners } from './ui.jsx';
import { SmartList } from './widgets.jsx';
import { useTaskForm, TaskFormModal } from './useTaskForm.jsx';

/* ============================================================
   DASHBOARD WIDGETS — conectados al store
   ============================================================ */
const greetingTime = () => { const h = new Date().getHours(); return h < 6 ? "noche" : h < 13 ? "mañana" : h < 20 ? "tarde" : "noche"; };

const _evDay  = (e) => e.date ? parseInt(e.date.slice(8,10)) : (e.day || 0);
const _evMonth= (e) => e.date ? parseInt(e.date.slice(5,7)) - 1 : new Date().getMonth();
const _evYear = (e) => e.date ? parseInt(e.date.slice(0,4)) : new Date().getFullYear();
const _isToday= (e) => { const t = new Date(); return _evDay(e) === t.getDate() && _evMonth(e) === t.getMonth() && _evYear(e) === t.getFullYear(); };

const WAgenda = ({ data }) => {
  const today = (data.events || []).filter(_isToday);
  return (
    <div className="card" style={{ height: "100%" }}>
      <div className="row between" style={{ marginBottom: 18 }}><div className="h3">Agenda de hoy</div><Icon name="calendar" size={18} color="var(--tx-3)" /></div>
      {today.length === 0
        ? <Empty icon="calendar" title="Sin eventos hoy" sub="Disfrutá el día libre." />
        : <div style={{ display: "grid", gap: 10 }}>
            {today.map(e => (
              <div key={e.id} className="row" style={{ gap: 14, padding: "12px 0", borderTop: "1px solid var(--line)" }}>
                <span style={{ width: 9, height: 9, borderRadius: 99, background: e.color }}></span>
                <div style={{ flex: 1, fontSize: 14.5, fontWeight: 500 }}>{e.title}</div>
              </div>
            ))}
          </div>}
    </div>
  );
};

const WXP = ({ data }) => (
  <div className="card card-hero tcorners" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
    <TerminalCorners />
    <div className="row between"><MonoLabel>XP total</MonoLabel><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.82)" }}>Nv {data.level}</span></div>
    <div>
      <div className="stat" style={{ fontSize: 34, color: "#fff" }}>{data.xp.toLocaleString("es")}</div>
      <div style={{ marginTop: 6, color: "rgba(255,255,255,.75)", fontSize: 12.5, display: "flex", alignItems: "center", gap: 5 }}>+120 hoy · <Icon name="fire" size={13} /> {data.streak}</div>
    </div>
  </div>
);

const WTareas = ({ data, set, onOpen }) => {
  const active = data.tasks.filter(t => !t.done);
  const [draft, setDraft] = React.useState("");
  const tf = useTaskForm();
  return (
    <div className="card card-flush" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="row between" style={{ padding: "20px 22px 14px", flexShrink: 0 }}>
        <div className="h3">Tareas activas</div>
        <div className="row" style={{ gap: 10 }}>
          <span className="link" style={{ fontSize: 13 }} onClick={() => onOpen("tareas")}>Ver todas →</span>
          <div className="icon-btn" style={{ width: 28, height: 28 }} title="Nueva tarea completa" onClick={() => tf.open()}>
            <Icon name="plus" size={14} />
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--line)", flex: 1, overflowY: "auto" }}>
        {active.length === 0 && <div className="empty" style={{ padding: 24 }}><span className="small">Sin tareas pendientes</span></div>}
        {active.slice(0, 5).map(t => (
          <div key={t.id} className="row" style={{ gap: 13, padding: "12px 22px", borderBottom: "1px solid var(--line)" }}>
            <div className="cbox" onClick={() => set(s => { const task = s.tasks.find(x => x.id === t.id); task.done = true; task.status = "lista"; })}></div>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 500, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} onClick={() => tf.open(t)}>{t.t}</div>
            <span className="prio" style={{ color: PRIO[t.prio], background: PRIO[t.prio] + "22", flexShrink: 0 }}>{t.prio}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: t.due === "Hoy" ? "var(--violet-hi)" : "var(--tx-3)", width: 56, textAlign: "right", flexShrink: 0 }}>{t.due}</span>
          </div>
        ))}
      </div>
      <form className="row" style={{ gap: 10, padding: "14px 22px", flexShrink: 0 }} onSubmit={e => { e.preventDefault(); if (draft.trim()) { set(s => s.tasks.push({ id: uid(), t: draft.trim(), desc: "", subject: null, due: "—", prio: "media", xp: 20, status: "pendiente", done: false })); setDraft(""); toast("Tarea agregada"); } }}>
        <input className="input" placeholder="Agregar tarea rápida y enter…" value={draft} onChange={e => setDraft(e.target.value)} style={{ padding: "11px 14px", fontSize: 14 }} />
        <Btn variant="secondary" icon="plus" style={{ flex: "0 0 auto" }} title="Agregar rápida"></Btn>
        <Btn variant="primary" icon="settings" type="button" style={{ flex: "0 0 auto" }} title="Agregar con opciones" onClick={() => tf.open()}></Btn>
      </form>
      <TaskFormModal hook={tf} />
    </div>
  );
};

const WMaterias = ({ data, onOpen }) => (
  <div className="card" style={{ height: "100%" }}>
    <div className="row between" style={{ marginBottom: 18 }}><div className="h3">Materias</div><span className="link" style={{ fontSize: 13 }} onClick={() => onOpen("facultad")}>Ver todas →</span></div>
    <div style={{ display: "grid", gap: 15 }}>
      {data.subjects.slice(0, 3).map(s => (
        <div key={s.id} className="row" style={{ gap: 13 }}>
          <SubjectDot s={s} size={34} />
          <div style={{ flex: 1 }}>
            <div className="row between" style={{ marginBottom: 6 }}><span style={{ fontSize: 14, fontWeight: 500 }}>{s.name}</span><span className="mono" style={{ fontSize: 11 }}>{s.pct}%</span></div>
            <div className="bar"><i style={{ width: s.pct + "%", background: s.color }}></i></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const WRacha = ({ data }) => {
  const days = ["L","M","M","J","V","S","D"];
  const filled = [true, false, false, false, false, false, false];
  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
      <MonoLabel>Racha</MonoLabel>
      <div className="stat" style={{ fontSize: 32 }}>{data.streak}<span style={{ fontSize: 14, color: "var(--tx-3)", fontWeight: 500, marginLeft: 5 }}>{data.streak === 1 ? "día" : "días"}</span></div>
      <div className="row" style={{ gap: 5 }}>
        {days.map((d, i) => <div key={i} title={d} style={{ flex: 1, height: 20, borderRadius: 5, background: filled[i] ? "var(--fill)" : "var(--surface-3)" }}></div>)}
      </div>
    </div>
  );
};

const WHoras = () => {
  const days = ["L","M","M","J","V","S","D"];
  const vals = getPomoWeekByDay(); /* horas reales de pomoLog */
  const totalH = Math.round(getPomoWeekMins() / 60 * 10) / 10;
  const max = Math.max(0.5, ...vals);
  const todayIdx = (new Date().getDay() + 6) % 7; /* 0=Lun … 6=Dom */
  return (
    <div className="card" style={{ height: "100%" }}>
      <div className="row between"><MonoLabel>Horas estudiadas</MonoLabel><span className="accent-tx" style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>{totalH}h esta semana</span></div>
      <div className="row" style={{ gap: 9, alignItems: "flex-end", height: 92, marginTop: 18 }}>
        {vals.map((v, i) => <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: "100%", height: Math.max(4, 66 * (v / max)), borderRadius: 6, background: i === todayIdx ? "var(--fill)" : "var(--surface-3)" }}></div>
          <div className="mono" style={{ fontSize: 9 }}>{days[i]}</div>
        </div>)}
      </div>
    </div>
  );
};

const WCompletas = ({ data }) => {
  const total = data.tasks.length, done = data.tasks.filter(t => t.done).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
      <MonoLabel>Tareas hechas</MonoLabel>
      <div className="stat" style={{ fontSize: 32 }}>{done}<span style={{ fontSize: 16, color: "var(--tx-3)", fontWeight: 500 }}>/{total}</span></div>
      <div><div className="bar"><i style={{ width: pct + "%" }}></i></div><div className="small" style={{ marginTop: 7, fontSize: 11.5 }}>{pct}% del día</div></div>
    </div>
  );
};

const WRing = ({ data }) => (
  <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
    <MonoLabel>Cuatrimestre</MonoLabel>
    <div className="row" style={{ gap: 14, alignItems: "center" }}>
      <ProgressRing value={62} size={62} />
      <div><div className="h2" style={{ fontSize: 20 }}>62%</div><div className="small" style={{ marginTop: 3, fontSize: 11.5 }}>43 días</div></div>
    </div>
  </div>
);

const WSemana = () => {
  const days = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"]; const vals = [5,3,7,2,6,1,0]; const max = 8;
  return (
    <div className="card" style={{ height: "100%" }}>
      <div className="row between" style={{ marginBottom: 20 }}><div className="h3">Actividad de la semana</div><span className="mono" style={{ fontSize: 11 }}>tareas / día</span></div>
      <div className="row" style={{ gap: 12, alignItems: "flex-end", height: 130 }}>
        {vals.map((v, i) => <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
          <div style={{ width: "100%", height: 95 * (v / max) + 4, borderRadius: 7, background: i === 4 ? "var(--fill)" : "var(--surface-3)" }}></div>
          <div className="mono" style={{ fontSize: 9.5 }}>{days[i]}</div>
        </div>)}
      </div>
    </div>
  );
};

const WReloj = () => {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const hh = String(now.getHours()).padStart(2, "0"), mm = String(now.getMinutes()).padStart(2, "0");
  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <MonoLabel>Hora</MonoLabel>
      <div className="display" style={{ fontSize: 40, marginTop: 8, fontFeatureSettings: '"tnum"' }}>{hh}:{mm}</div>
      <div className="small" style={{ marginTop: 4, textTransform: "capitalize" }}>{now.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}</div>
    </div>
  );
};

const WNota = ({ data, set }) => (
  <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
    <MonoLabel>Nota rápida</MonoLabel>
    <textarea value={data.dashNote || ""} onChange={e => set(s => s.dashNote = e.target.value)} placeholder="Algo para no olvidar…"
      style={{ flex: 1, marginTop: 12, minHeight: 90, background: "none", border: "none", outline: "none", resize: "none", color: "var(--tx-1)", fontFamily: "var(--font-body)", fontSize: 14, lineHeight: 1.6 }} />
  </div>
);

const MONTHS_ABBR = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

const WProximo = ({ data, onOpen }) => {
  const now = new Date();
  const sortedFuture = [...(data.events||[])].sort((a,b) => {
    const da = a.date ? new Date(a.date) : new Date(now.getFullYear(), now.getMonth(), _evDay(a));
    const db = b.date ? new Date(b.date) : new Date(now.getFullYear(), now.getMonth(), _evDay(b));
    return da - db;
  });
  const next = sortedFuture.find(e => {
    const d = e.date ? new Date(e.date) : new Date(now.getFullYear(), now.getMonth(), _evDay(e));
    return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }) || sortedFuture[0];
  const nextLabel = next ? (next.date ? `${String(_evDay(next)).padStart(2,"0")} de ${MONTHS_ABBR[_evMonth(next)]}` : `${String(_evDay(next)).padStart(2,"0")}`) : "";
  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer" }} onClick={() => onOpen("calendario")}>
      <div className="row between"><MonoLabel>Próximo evento</MonoLabel><Icon name="calendar" size={16} color="var(--tx-3)" /></div>
      {next ? <><div className="h2" style={{ marginTop: 10 }}>{next.title}</div><div className="row" style={{ gap: 9, marginTop: 10 }}><span style={{ width: 9, height: 9, borderRadius: 99, background: next.color }}></span><span className="small">{nextLabel}</span></div></> : <div className="small" style={{ marginTop: 10 }}>Sin eventos próximos</div>}
    </div>
  );
};

const WHabitos = ({ data, onOpen }) => {
  const hp = (data.space && data.space.pages.find(p => p.kind === "habits")) || { habits: [] };
  const k = `${new Date().getMonth() + 1}-${new Date().getDate()}`;
  const total = hp.habits.length, done = hp.habits.filter(h => (h.done || []).includes(k)).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer" }} onClick={() => onOpen("espacio")}>
      <div className="row between"><MonoLabel>Hábitos de hoy</MonoLabel><Icon name="fire" size={17} color="var(--violet-hi)" /></div>
      <div className="stat" style={{ fontSize: 34, marginTop: 10 }}>{done}<span style={{ fontSize: 18, color: "var(--tx-3)" }}>/{total}</span></div>
      <div style={{ marginTop: 14 }}><div className="bar"><i style={{ width: pct + "%" }}></i></div></div>
    </div>
  );
};

const FRASES = [
  "Hecho es mejor que perfecto.", "Un paso a la vez también es avanzar.", "La constancia vence al talento.",
  "Estudiá ahora, agradecé después.", "El secreto es empezar.", "Pequeños hábitos, grandes resultados.", "Concentrate en hoy.",
];
const WFrase = () => {
  const f = FRASES[new Date().getDate() % FRASES.length];
  return (
    <div className="card card-hero tcorners" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <TerminalCorners />
      <MonoLabel>Frase del día</MonoLabel>
      <div className="h2" style={{ color: "#fff", marginTop: 12, lineHeight: 1.3, textWrap: "pretty" }}>“{f}”</div>
    </div>
  );
};

/* ── Objetivos de hoy ────────────────────────────────────────
   Widget interactivo que crea/sincroniza la misión "Objetivos de hoy".
   Los ítems se guardan directamente como subtareas de esa misión.
   ─────────────────────────────────────────────────────────── */
const HOY_TITLE = "Objetivos de hoy";

const WObjetivos = ({ data, set, onOpen }) => {
  const todayKey = new Date().toDateString(); // e.g. "Mon Jun 10 2026"
  const [draft, setDraft] = React.useState("");

  /* Buscar (o describir) la misión de hoy */
  const mission = data.missions?.find(m => m.t === HOY_TITLE && m.todayKey === todayKey);

  /* Crear la misión si no existe */
  const ensureMission = () => {
    let m = data.missions?.find(m => m.t === HOY_TITLE && m.todayKey === todayKey);
    if (!m) {
      m = { id: uid(), t: HOY_TITLE, desc: new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" }), prio: "alta", xp: 500, subtasks: [], expanded: true, todayKey };
      set(s => { if (!s.missions) s.missions = []; s.missions.unshift(m); });
    }
    return m;
  };

  const addItem = () => {
    if (!draft.trim()) return;
    const t = draft.trim();
    setDraft("");
    ensureMission();
    set(s => {
      const mm = s.missions.find(m => m.t === HOY_TITLE && m.todayKey === todayKey);
      if (mm) mm.subtasks.push({ t, done: false });
    });
    toast("Objetivo agregado");
  };

  const toggle = (i) => {
    set(s => {
      const mm = s.missions.find(m => m.t === HOY_TITLE && m.todayKey === todayKey);
      if (mm) mm.subtasks[i].done = !mm.subtasks[i].done;
    });
  };

  const removeItem = (i) => {
    set(s => {
      const mm = s.missions.find(m => m.t === HOY_TITLE && m.todayKey === todayKey);
      if (mm) mm.subtasks.splice(i, 1);
    });
  };

  const items = mission?.subtasks || [];
  const done = items.filter(i => i.done).length;
  const pct = items.length ? Math.round(done / items.length * 100) : 0;

  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* header */}
      <div className="row between" style={{ marginBottom: 12, flexShrink: 0 }}>
        <div className="row" style={{ gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--violet-soft)", display: "grid", placeItems: "center" }}>
            <Icon name="target" size={15} color="var(--violet-hi)" />
          </div>
          <div>
            <div className="h3" style={{ fontSize: 14 }}>Objetivos de hoy</div>
            {items.length > 0 && <div className="mono" style={{ fontSize: 10, marginTop: 1 }}>{done}/{items.length} completos</div>}
          </div>
        </div>
        {items.length > 0 && (
          <span
            className="link"
            style={{ fontSize: 12 }}
            onClick={() => onOpen("misiones")}
          >
            Ver misión →
          </span>
        )}
      </div>

      {/* barra de progreso — solo si hay items */}
      {items.length > 0 && (
        <div className="bar" style={{ marginBottom: 12, flexShrink: 0 }}>
          <i style={{ width: pct + "%" }}></i>
        </div>
      )}

      {/* lista scrolleable */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
        {items.length === 0 && (
          <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center", color: "var(--tx-3)" }}>
            <div>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
              <div className="small">Escribí tus objetivos del día</div>
            </div>
          </div>
        )}
        {items.map((item, i) => (
          <div
            key={i}
            className="row"
            style={{ gap: 10, padding: "7px 4px", borderRadius: 6, transition: "background .1s" }}
          >
            <div
              className={`cbox${item.done ? " on" : ""}`}
              onClick={() => toggle(i)}
              style={{ flexShrink: 0 }}
            >
              {item.done && <Icon name="check" size={13} color="#fff" />}
            </div>
            <span style={{
              flex: 1,
              fontSize: 14,
              textDecoration: item.done ? "line-through" : "none",
              opacity: item.done ? .45 : 1,
              transition: "opacity .2s",
              lineHeight: 1.35,
            }}>
              {item.t}
            </span>
            <span
              style={{ cursor: "pointer", color: "var(--tx-3)", flexShrink: 0, opacity: 0.6 }}
              onClick={() => removeItem(i)}
            >
              <Icon name="x" size={12} />
            </span>
          </div>
        ))}
      </div>

      {/* input */}
      <form
        style={{ display: "flex", gap: 8, marginTop: 10, flexShrink: 0 }}
        onSubmit={e => { e.preventDefault(); addItem(); }}
      >
        <input
          className="input"
          placeholder="Agregar objetivo…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          style={{ flex: 1, padding: "9px 12px", fontSize: 13 }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          style={{ flexShrink: 0, padding: "0 14px" }}
        >
          <Icon name="plus" size={15} />
        </button>
      </form>
    </div>
  );
};

/* ── Galería de fotos ─────────────────────────────────────────
   Muestra una foto aleatoria de las subidas, con botón shuffle.
   Las fotos se guardan en widgetConfig.dashboard.fotos.photos[]
   ─────────────────────────────────────────────────────────── */
const WFotos = ({ data, set }) => {
  const photos = data.widgetConfig?.dashboard?.fotos?.photos || [];
  const [idx, setIdx] = React.useState(() => photos.length ? Math.floor(Math.random() * photos.length) : 0);
  const fileRef = React.useRef();

  const shuffle = () => {
    if (photos.length < 2) return;
    setIdx(i => {
      let next = Math.floor(Math.random() * photos.length);
      while (next === i && photos.length > 1) next = Math.floor(Math.random() * photos.length);
      return next;
    });
  };

  const upload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target.result;
      set(s => {
        if (!s.widgetConfig) s.widgetConfig = {};
        if (!s.widgetConfig.dashboard) s.widgetConfig.dashboard = {};
        if (!s.widgetConfig.dashboard.fotos) s.widgetConfig.dashboard.fotos = { photos: [] };
        s.widgetConfig.dashboard.fotos.photos.push(url);
      });
      setIdx(photos.length); // nuevo índice = última foto
      toast("Foto agregada ✓");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removePhoto = (i) => {
    set(s => {
      const arr = s.widgetConfig?.dashboard?.fotos?.photos;
      if (arr) arr.splice(i, 1);
    });
    setIdx(prev => Math.max(0, prev - 1));
  };

  const current = photos[idx] || null;

  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
      {/* foto principal */}
      <div style={{ flex: 1, position: "relative", background: "var(--surface-2)", minHeight: 140 }}>
        {current
          ? <img src={current} alt="foto" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : (
            <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "var(--tx-3)", flexDirection: "column", gap: 8, padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 36 }}>📷</div>
              <div className="small">Subí fotos para verlas aquí</div>
            </div>
          )
        }
        {/* overlay con contador */}
        {photos.length > 0 && (
          <div className="mono" style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 10, padding: "3px 8px", borderRadius: 20 }}>
            {idx + 1} / {photos.length}
          </div>
        )}
      </div>

      {/* controles */}
      <div className="row between" style={{ padding: "11px 14px", borderTop: "1px solid var(--line)", flexShrink: 0, gap: 8 }}>
        <MonoLabel style={{ fontSize: 10 }}>Galería de fotos</MonoLabel>
        <div className="row" style={{ gap: 6 }}>
          {current && (
            <div className="icon-btn" style={{ width: 28, height: 28 }} title="Eliminar esta foto" onClick={() => removePhoto(idx)}>
              <Icon name="trash" size={13} />
            </div>
          )}
          {photos.length > 1 && (
            <div className="icon-btn" style={{ width: 28, height: 28 }} title="Foto aleatoria" onClick={shuffle}>
              <Icon name="refresh" size={14} />
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={upload} />
          <div className="icon-btn" style={{ width: 28, height: 28 }} title="Agregar foto" onClick={() => fileRef.current?.click()}>
            <Icon name="plus" size={14} />
          </div>
        </div>
      </div>
    </div>
  );
};

const WIDGET_COMP = {
  agenda: WAgenda, xp: WXP, tareas: WTareas, materias: WMaterias,
  racha: WRacha, horas: WHoras, completas: WCompletas, ring: WRing, semana: WSemana,
  reloj: WReloj, nota: WNota, proximo: WProximo, habitos: WHabitos, frase: WFrase,
  objetivos: WObjetivos, fotos: WFotos,
};

export { WIDGET_COMP, greetingTime };