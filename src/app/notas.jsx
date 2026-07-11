import React from 'react';

import { Icon } from './icons.jsx';
import { useStore, toast, DEFAULT_EVAL, subjectPromedio, deriveEstado } from './store.jsx';
import { Modal, Field, Seg, Toggle, Hubby } from './ui.jsx';

/* ============================================================
   NOTAS DEL CUATRIMESTRE (DESIGN.md punto 8)
   Una tarjeta por materia con su recorrido de evaluación,
   estado derivado, y animaciones al aprobar/promocionar.
   ============================================================ */

const ESTADO_META = {
  cursando:     { label: "Cursando",            color: "var(--tx-2)",    bg: "var(--off)" },
  regular:      { label: "Regular · falta final", color: "var(--org-deep)", bg: "#F7E4D3" },
  recuperar:    { label: "A recuperar",         color: "var(--org-deep)", bg: "#F7E4D3" },
  aprobada:     { label: "Aprobada",            color: "#2f5e10",        bg: "var(--green-bg)" },
  promocionada: { label: "Promocionada",        color: "#2f5e10",        bg: "var(--green-bg)" },
};

const gradeKeys = (ev) => [
  ...Array.from({ length: ev.parciales || 0 }, (_, i) => ({ k: "p" + (i + 1), label: `Parcial ${i + 1}` })),
  ...(ev.coloquio ? [{ k: "coloquio", label: "Coloquio" }] : []),
  ...(ev.final ? [{ k: "final", label: "Final" }] : []),
];

/* ---------- modal de esquema de evaluación (⚙️) ---------- */
const EvalConfigModal = ({ subject, onClose, onSave }) => {
  const [ev, setEv] = React.useState({ ...DEFAULT_EVAL, ...subject.eval, promo: { ...DEFAULT_EVAL.promo, ...(subject.eval?.promo || {}) } });
  const up = (k, v) => setEv(x => ({ ...x, [k]: v }));
  const upPromo = (k, v) => setEv(x => ({ ...x, promo: { ...x.promo, [k]: v } }));
  return (
    <Modal title="Esquema de evaluación" sub={subject.name} icon="gear" onClose={onClose}
      footer={<><span className="link" style={{ color: "var(--tx-3)" }} onClick={onClose}>Cancelar</span>
        <button className="btn btn-primary" onClick={() => { onSave(ev); onClose(); }}>Guardar</button></>}>
      <Field label="Parciales">
        <Seg opts={[{ id: 1, label: "1" }, { id: 2, label: "2" }, { id: 3, label: "3" }]} value={ev.parciales} onChange={v => up("parciales", Number(v))} />
      </Field>
      <Field label="Coloquio">
        <div className="row between"><span className="small">¿Esta materia tiene coloquio?</span><Toggle on={ev.coloquio} onChange={v => up("coloquio", v)} /></div>
      </Field>
      <Field label="Final">
        <div className="row between"><span className="small">¿Esta materia tiene final?</span><Toggle on={ev.final} onChange={v => up("final", v)} /></div>
      </Field>
      <Field label="Promoción" hint="siempre se puede marcar a mano en la tarjeta">
        <div className="row between" style={{ marginBottom: ev.promo.on ? 12 : 0 }}><span className="small">¿Se puede promocionar?</span><Toggle on={ev.promo.on} onChange={v => upPromo("on", v)} /></div>
        {ev.promo.on && <>
          <Seg opts={[{ id: "promedio", label: "Promedio" }, { id: "parciales", label: "Todos ≥ X" }, { id: "manual", label: "Manual" }]} value={ev.promo.mode} onChange={v => upPromo("mode", v)} />
          {ev.promo.mode !== "manual" && (
            <div className="row" style={{ gap: 10, marginTop: 12, alignItems: "center" }}>
              <span className="small">Umbral</span>
              <input type="number" min="1" max="10" step="0.5" value={ev.promo.threshold}
                onChange={e => upPromo("threshold", Number(e.target.value))}
                style={{ width: 70, background: "var(--field)", border: "1px solid var(--line)", borderRadius: 9, padding: "7px 10px", color: "var(--soft)", fontFamily: "var(--font-body)" }} />
            </div>
          )}
        </>}
      </Field>
      <Field label="Promedio final" hint="mostrar el promedio en la tarjeta">
        <div className="row between"><span className="small">¿Mostrar promedio?</span><Toggle on={ev.promedioOn} onChange={v => up("promedioOn", v)} /></div>
      </Field>
    </Modal>
  );
};

/* ---------- tarjeta de una materia ---------- */
const SubjectNoteCard = ({ s, onGrade, onPromoManual, onOpenConfig }) => {
  const ev = s.eval || DEFAULT_EVAL;
  const estado = deriveEstado(s);
  const meta = ESTADO_META[estado];
  const keys = gradeKeys(ev);
  const promedio = ev.promedioOn ? subjectPromedio(s) : null;
  const showPromedioBadge = promedio != null && (estado === "aprobada" || estado === "promocionada");

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: s.color, flex: "0 0 auto" }} />
            <div style={{ fontWeight: 700, fontSize: 15.5, color: "var(--tx-1)" }}>{s.name}</div>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: meta.color, background: meta.bg, padding: "4px 11px", borderRadius: 20 }}>{meta.label}</span>
            {showPromedioBadge && <span style={{ fontSize: 11.5, fontWeight: 700, color: "#2f5e10", background: "var(--green-bg)", padding: "4px 11px", borderRadius: 20 }}>prom. {promedio}</span>}
          </div>
        </div>
        <div className="icon-btn" style={{ width: 30, height: 30, flex: "0 0 auto" }} title="Esquema de evaluación" onClick={onOpenConfig}><Icon name="gear" size={15} /></div>
      </div>

      {keys.length === 0
        ? <div className="small" style={{ color: "var(--tx-3)" }}>Sin evaluaciones configuradas — abrí el ⚙️ para definir el esquema.</div>
        : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {keys.map(({ k, label }) => (
              <label key={k} style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 80px", minWidth: 80 }}>
                <span className="mono" style={{ fontSize: 9.5, color: "var(--tx-3)" }}>{label.toUpperCase()}</span>
                <input type="number" min="1" max="10" step="0.5" placeholder="—"
                  value={s.grades?.[k] ?? ""}
                  onChange={e => onGrade(k, e.target.value === "" ? null : Number(e.target.value))}
                  style={{ background: "var(--field)", border: "1px solid var(--line)", borderRadius: 9, padding: "8px 10px", color: "var(--soft)", fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, width: "100%" }} />
              </label>
            ))}
          </div>
        )}

      <div className="row" style={{ gap: 8, marginTop: -2 }}>
        <span
          className="small"
          style={{ cursor: "pointer", color: s.promoManual ? "var(--org-deep)" : "var(--tx-3)", display: "flex", alignItems: "center", gap: 6 }}
          onClick={() => onPromoManual(!s.promoManual)}
        >
          <span style={{ width: 15, height: 15, borderRadius: 4, border: "1.5px solid currentColor", display: "grid", placeItems: "center" }}>
            {s.promoManual && <Icon name="check" size={10} />}
          </span>
          Marcar promocionada a mano
        </span>
      </div>
    </div>
  );
};

/* ---------- animación de festejo ---------- */
const CONFETTI_COLORS = ["#D9551F", "#F4A94E", "#3A332B", "#639922", "#96360F"];

const Celebration = ({ info, onClose }) => {
  if (!info) return null;
  const isPromo = info.type === "promocionada";
  const pieces = React.useMemo(() => Array.from({ length: 26 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    dur: 1.6 + Math.random() * 1,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    rot: Math.random() * 360,
    size: 6 + Math.random() * 6,
  })), [info]);

  return (
    <div className="cele-overlay" onClick={onClose}>
      {isPromo && pieces.map((p, i) => (
        <span key={i} className="cele-confetti" style={{
          left: `${p.left}%`, background: p.color, width: p.size, height: p.size * 0.5,
          animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, transform: `rotate(${p.rot}deg)`,
        }} />
      ))}
      <div className="cele-card" onClick={e => e.stopPropagation()}>
        <img src={`/assets/hubby/hubby-${isPromo ? "festejo" : "contento"}.png`} alt="Hubby" className="cele-hubby" />
        {isPromo ? (
          <div className="cele-stamp">PROMOCIONADA<span>promedio {info.promedio}</span></div>
        ) : (
          <>
            <svg className="cele-check" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="23" fill="none" stroke="#3B6D11" strokeWidth="3" />
              <path fill="none" stroke="#3B6D11" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" d="M15 27l7 7 16-16" />
            </svg>
            <div className="cele-title">¡Aprobada!</div>
          </>
        )}
        <div className="small" style={{ marginTop: 6, color: "var(--tx-2)" }}>{info.subjectName}</div>
        <div className="row" style={{ gap: 10, marginTop: 18, justifyContent: "center" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onClose(true)}>Repetir</button>
          <button className="btn btn-primary btn-sm" onClick={() => onClose(false)}>Cerrar</button>
        </div>
      </div>
    </div>
  );
};

/* ---------- pantalla principal ---------- */
const Notas = () => {
  const [data, set] = useStore();
  const subjects = data.subjects || [];
  const [configFor, setConfigFor] = React.useState(null);
  const [celebrate, setCelebrate] = React.useState(null);
  const [replayInfo, setReplayInfo] = React.useState(null);

  const counts = subjects.reduce((acc, s) => {
    const e = deriveEstado(s);
    if (e === "promocionada") acc.promo++;
    else if (e === "aprobada") acc.aprobadas++;
    else acc.curso++;
    return acc;
  }, { promo: 0, aprobadas: 0, curso: 0 });

  const maybeCelebrate = (s, prevEstado, nextEstado) => {
    if (nextEstado === prevEstado) return;
    if (nextEstado === "promocionada" && prevEstado !== "promocionada") {
      const info = { type: "promocionada", subjectName: s.name, promedio: subjectPromedio({ ...s }) };
      setCelebrate(info); setReplayInfo(info);
    } else if (nextEstado === "aprobada" && !["aprobada", "promocionada"].includes(prevEstado)) {
      const info = { type: "aprobada", subjectName: s.name };
      setCelebrate(info); setReplayInfo(info);
    }
  };

  const setGrade = (s, k, v) => {
    const prevEstado = deriveEstado(s);
    set(st => { const sub = st.subjects.find(x => x.id === s.id); sub.grades = { ...(sub.grades || {}), [k]: v }; });
    const next = { ...s, grades: { ...(s.grades || {}), [k]: v } };
    maybeCelebrate(s, prevEstado, deriveEstado(next));
  };

  const setPromoManual = (s, v) => {
    const prevEstado = deriveEstado(s);
    set(st => { st.subjects.find(x => x.id === s.id).promoManual = v; });
    maybeCelebrate(s, prevEstado, deriveEstado({ ...s, promoManual: v }));
    if (v) toast(`${s.name} marcada como promocionada`);
  };

  const saveEval = (s, ev) => {
    set(st => { st.subjects.find(x => x.id === s.id).eval = ev; });
    toast("Esquema actualizado");
  };

  return (
    <div className="page page-cozy">
      <div className="row between" style={{ marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="h2">Notas del cuatrimestre</div>
          <div className="small" style={{ marginTop: 4, color: "var(--tx-2)" }}>
            {counts.promo} promocionadas · {counts.aprobadas} aprobadas · {counts.curso} en curso
          </div>
        </div>
      </div>

      {subjects.length === 0 ? (
        <div className="empty"><div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}><Hubby pose="idle" size={92} /><div className="h3" style={{ marginTop: 10 }}>Todavía no tenés materias</div><div className="small" style={{ marginTop: 6 }}>Creá tu primera materia desde Facultad.</div></div></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {subjects.map(s => (
            <SubjectNoteCard
              key={s.id}
              s={s}
              onGrade={(k, v) => setGrade(s, k, v)}
              onPromoManual={v => setPromoManual(s, v)}
              onOpenConfig={() => setConfigFor(s)}
            />
          ))}
        </div>
      )}

      {configFor && <EvalConfigModal subject={configFor} onClose={() => setConfigFor(null)} onSave={ev => saveEval(configFor, ev)} />}

      <Celebration
        info={celebrate}
        onClose={(repeat) => { setCelebrate(null); if (repeat) setTimeout(() => setCelebrate(replayInfo), 50); }}
      />
    </div>
  );
};

export { Notas };
