import React from 'react';

import { Icon } from './icons.jsx';
import { SupabaseStorage, DOMAIN_MAP } from '../storage.js';

/* ============================================================
   STORE — persistencia Supabase + localStorage + realtime
   Todos los componentes escriben via Store.set(fn).
   La sincronización con la nube es transparente.
   ============================================================ */
const COLORS = ["#D9551F","#C68A2E","#7E8A4F","#5F7470","#9C4A2E","#A98A5C"];
const PRIO   = { alta: "#e8639b", media: "#e8b04e", baja: "#3ecf9a" };
const STATUS = { pendiente: "Pendiente", progreso: "En progreso", lista: "Lista" };

/* ── esquema de evaluación / notas del cuatrimestre ──────── */
const DEFAULT_EVAL = { parciales: 2, coloquio: false, final: true, promo: { on: true, mode: "promedio", threshold: 7 }, promedioOn: true };
const PASSING = 4; /* nota mínima para aprobar (escala 1-10) */

/* nota promedio de lo cargado (parciales + coloquio + final configurados) */
function subjectPromedio(s) {
  const ev = s.eval || DEFAULT_EVAL, g = s.grades || {};
  const keys = [...Array.from({ length: ev.parciales || 0 }, (_, i) => "p" + (i + 1)), ...(ev.coloquio ? ["coloquio"] : []), ...(ev.final ? ["final"] : [])];
  const vals = keys.map(k => g[k]).filter(v => v != null && v !== "");
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + Number(b), 0) / vals.length) * 10) / 10;
}

/* estado derivado de la materia: cursando | regular | recuperar | aprobada | promocionada */
function deriveEstado(s) {
  if (s.promoManual) return "promocionada";
  const ev = s.eval || DEFAULT_EVAL, g = s.grades || {};
  const promo = ev.promo || {};
  const parcialVals = Array.from({ length: ev.parciales || 0 }, (_, i) => g["p" + (i + 1)]).filter(v => v != null && v !== "").map(Number);
  const allParciales = (ev.parciales || 0) > 0 && parcialVals.length === ev.parciales;
  const anyFail = parcialVals.some(v => v < PASSING);

  if (promo.on && promo.mode !== "manual" && allParciales && !anyFail) {
    const thr = promo.threshold ?? 7;
    const meets = promo.mode === "parciales"
      ? parcialVals.every(v => v >= thr)
      : (parcialVals.reduce((a, b) => a + b, 0) / parcialVals.length) >= thr;
    if (meets) return "promocionada";
  }

  const finalVal = ev.final ? g.final : (ev.coloquio ? g.coloquio : null);
  if (finalVal != null && finalVal !== "") return Number(finalVal) >= PASSING ? "aprobada" : "recuperar";
  if (anyFail) return "recuperar";
  if (allParciales) return "regular";
  return "cursando";
}

/* SEED vacío — sólo estructura, sin datos de demo */
const SEED = {
  profile: { name: "", initial: "", role: "uni", uni: "", career: "", year: "1", email: "", photo: null, hubby: false },
  xp: 0, level: 1, streak: 0,
  subjects: [],
  tasks: [],
  missions: [],
  events: [],
  journal: [],
  journalDraft: "",
  morning: [],
  kitchen:  { heladera: [], almacen: [], freezer: [] },
  shopping: [],
  finance:  { budget: 200000, expenses: [] },
  home: [],
  ocio: [],
  pomoLog: [],           /* [{ date:"YYYY-MM-DD", mins:number }] */
  dashWidgets: ["tareas","agenda","xp","racha","completas","ring","materias","horas"],
  dashSpans: {},
  dashNote: "",
  widgetConfig: {},      /* { sectionId: { widgetKey: { colorOn, color, photoOn, photos[] } } } */
  bgImages: {},          /* { sectionId: "url" } */
  taskCalendarMap: {},   /* { taskId: eventId } — sync bidireccional */
  space: {
    activeId: "inicio",
    pages: [
      { id: "inicio", icon: "pin", title: "Inicio", kind: "doc", blocks: [
        { id: "d1", type: "h1",      text: "Mi espacio personal" },
        { id: "d2", type: "callout", emoji: "💡", accent: "#8b6dff", text: 'Tu lugar libre: escribí lo que quieras y sumá bloques con "/" o el botón ＋.' },
        { id: "d3", type: "h2",      text: "Para hoy" },
        { id: "d4", type: "todo",    text: "Revisar pendientes", checked: false },
        { id: "d5", type: "todo",    text: "Planear la semana",  checked: false },
      ]},
      { id: "notas",    icon: "note",   title: "Notas",      kind: "doc",    blocks: [{ id: "n1", type: "text", text: "" }] },
      { id: "habitos",  icon: "fire",   title: "Hábitos",    kind: "habits", habits: [
        { id: "hb1", name: "Ejercicio",    emoji: "🏃", done: [] },
        { id: "hb2", name: "Leer 30 min", emoji: "📖", done: [] },
        { id: "hb3", name: "Meditar",      emoji: "🧘", done: [] },
      ]},
    ],
  },
  settings: { uiScale: 40, glow: true, anim: true, sounds: false, accent: "violet" },
};

const ALL_WIDGETS = {
  xp:         { label: "Total XP",             w: 4 },
  tareas:     { label: "Tabla de tareas",       w: 8 },
  agenda:     { label: "Agenda de hoy",         w: 6 },
  materias:   { label: "Materias",              w: 6 },
  racha:      { label: "Racha actual",          w: 4 },
  horas:      { label: "Horas estudiadas",      w: 6 },
  completas:  { label: "Tareas completas",      w: 4 },
  ring:       { label: "Ring cuatrimestre",     w: 4 },
  semana:     { label: "Gráfico semana",        w: 8 },
  reloj:      { label: "Reloj y fecha",         w: 4 },
  nota:       { label: "Nota rápida",           w: 4 },
  proximo:    { label: "Próximo evento",        w: 4 },
  habitos:    { label: "Hábitos de hoy",        w: 4 },
  frase:      { label: "Frase del día",         w: 6 },
  objetivos:  { label: "Objetivos de hoy",      w: 6 },
  fotos:      { label: "Galería de fotos",       w: 6 },
  captura:    { label: "Captura universal",      w: 8 },
  coach:      { label: "¿Y ahora qué?",          w: 6 },
};

/* ── helpers ────────────────────────────────────────────── */
const uid = () => Math.random().toString(36).slice(2, 9);

/* slider 1–100 → zoom 0.72–1.22 (40 ≈ 0.92) */
const scaleToZoom = (v) => (0.72 + (v / 100) * 0.5).toFixed(3);

/* lee desde SupabaseStorage (con fallback a localStorage puro) */
function _rawGet(key) {
  try {
    return (SupabaseStorage || localStorage).getItem(key);
  } catch { return null; }
}

/* aplica migraciones estructurales al blob de datos */
function applyMigrations(data) {
  if (!data) data = JSON.parse(JSON.stringify(SEED));

  /* ── backfill campos críticos (nunca deben ser undefined) ── */
  if (!data.profile)  data.profile  = { ...SEED.profile };
  else                data.profile  = { ...SEED.profile, ...data.profile };
  if (!Array.isArray(data.subjects))  data.subjects  = [];
  if (!Array.isArray(data.tasks))     data.tasks     = [];
  if (!Array.isArray(data.missions))  data.missions  = [];
  if (!Array.isArray(data.events))    data.events    = [];
  if (!Array.isArray(data.journal))   data.journal   = [];
  if (data.xp    == null) data.xp    = 0;
  if (data.level == null) data.level = 1;
  if (data.streak== null) data.streak= 0;
  if (data.journalDraft == null) data.journalDraft = "";

  /* backfill de claves nuevas */
  if (!data.settings)    data.settings    = { ...SEED.settings };
  else                   data.settings    = { ...SEED.settings, ...data.settings };
  if (!data.dashWidgets) data.dashWidgets = [...SEED.dashWidgets];
  if (!data.dashSpans)   data.dashSpans   = {};
  if (data.dashNote == null) data.dashNote = "";
  if (!data.space)       data.space       = JSON.parse(JSON.stringify(SEED.space));
  if (!Array.isArray(data.pomoLog)) data.pomoLog = [];
  if (!data.kitchen || !data.kitchen.heladera) data.kitchen = { ...SEED.kitchen };
  if (!Array.isArray(data.shopping)) data.shopping = [];
  if (!Array.isArray(data.home))     data.home     = [];
  if (!Array.isArray(data.ocio))     data.ocio     = [];
  if (!data.finance)                 data.finance  = { ...SEED.finance };

  /* layout dashboard v2 (reset si viene de versión vieja) */
  if (data.dashV !== 2) {
    data.dashWidgets = [...SEED.dashWidgets];
    data.dashSpans   = {};
    data.dashV       = 2;
  }

  /* migración: íconos de páginas de emoji a nombre de línea */
  if (data.spaceIconsV !== 1 && data.space && Array.isArray(data.space.pages)) {
    const MAP = { "📌":"pin","📄":"file","📓":"note","📝":"pen","✅":"check","🎯":"target","🔥":"fire","💡":"idea","🎨":"palette","📚":"book","⭐":"star","🧠":"idea","💪":"dumbbell","🎵":"note","🍿":"film","✈️":"send","🌱":"sparkles" };
    data.space.pages = data.space.pages.map(p => MAP[p.icon] ? { ...p, icon: MAP[p.icon] } : p);
    data.spaceIconsV = 1;
  }

  /* migración: páginas canvas → doc */
  if (data.space && Array.isArray(data.space.pages)) {
    data.space.pages = data.space.pages.map(p => {
      if (p.kind !== "canvas") return p;
      const blocks = (p.items || []).flatMap(it => {
        if (it.kind === "heading")  return [{ id: uid(), type: "h1",      text: it.text || "" }];
        if (it.kind === "callout")  return [{ id: uid(), type: "callout", emoji: it.emoji || "💡", accent: it.accent || "#8b6dff", text: it.text || "" }];
        if (it.kind === "code")     return [{ id: uid(), type: "code",    lang: it.lang || "js",   text: it.text || "" }];
        if (it.kind === "divider")  return [{ id: uid(), type: "divider", text: "" }];
        if (it.kind === "list")     return [{ id: uid(), type: "h2",      text: it.title || "Lista" }, ...((it.items||[]).map(x => ({ id: uid(), type: "todo", text: x.t||"", checked: !!x.done })))];
        return [{ id: uid(), type: "text", text: it.text || "" }];
      });
      return { id: p.id, icon: p.icon, title: p.title, kind: "doc", blocks: blocks.length ? blocks : [{ id: uid(), type: "text", text: "" }] };
    });
  }

  /* backfill morning */
  if (!Array.isArray(data.morning)) data.morning = [];
  data.morning = data.morning.map(m => ({ wake: "08:00", ...m }));

  /* backfill materias: campos nuevos */
  if (Array.isArray(data.subjects)) {
    data.subjects = data.subjects.map(s => ({
      ...s,
      photo: s.photo ?? null,
      profs: Array.isArray(s.profs) ? s.profs : (s.prof ? [s.prof] : []),
      files: Array.isArray(s.files) ? s.files : [],
      eval: s.eval || { ...DEFAULT_EVAL },
      grades: s.grades || {},
      promoManual: s.promoManual || false,
      schedule: Array.isArray(s.schedule) ? s.schedule : [],
      commission: s.commission ?? "",
      year: s.year ?? "",
    }));
  }

  /* backfill eventos: kind (evento|clase|estudio|parcial|entrega), hora, materia vinculada */
  if (Array.isArray(data.events)) {
    data.events = data.events.map(e => ({
      kind: /parcial|final|examen/i.test(e.title || "") ? "parcial" : /entrega|\btp\b/i.test(e.title || "") ? "entrega" : "evento",
      time: "",
      subjectId: null,
      ...e,
    }));
  }

  /* backfill widget config, bg images, sync map */
  if (!data.widgetConfig) data.widgetConfig = {};
  if (!data.bgImages) data.bgImages = {};
  if (!data.taskCalendarMap) data.taskCalendarMap = {};

  return data;
}

/* ── store singleton ────────────────────────────────────── */
function makeStore() {
  let raw;
  try { raw = _rawGet("sh_data"); } catch { raw = null; }
  let data = raw ? applyMigrations(JSON.parse(raw)) : applyMigrations(null);

  const subs = new Set();

  /* Snapshot de un dominio para detectar cambios */
  const _snap = (domainKey) => {
    const fields = DOMAIN_MAP[domainKey];
    if (!fields) return "";
    return JSON.stringify(fields.reduce((acc, f) => { acc[f] = data[f]; return acc; }, {}));
  };

  const persist = (changedDomains = null) => {
    try {
      /* localStorage: siempre el blob completo (lectura rápida al arrancar) */
      localStorage.setItem("sh_data", JSON.stringify(data));

      /* Supabase: solo los dominios que cambiaron */
      if (!SupabaseStorage) return;
      const toUpload = changedDomains || Object.keys(DOMAIN_MAP);
      for (const dk of toUpload) {
        const fields = DOMAIN_MAP[dk];
        if (!fields) continue;
        const domainData = fields.reduce((acc, f) => { acc[f] = data[f]; return acc; }, {});
        SupabaseStorage.setItem(dk, JSON.stringify(domainData));
      }
    } catch {
      toast("⚠️ Almacenamiento lleno — probá con archivos más chicos");
    }
  };

  const notify = () => subs.forEach(s => s());

  return {
    get: () => data,
    set: (fn) => {
      /* Snapshot antes de la mutación para detectar qué dominio cambió */
      const before = {};
      for (const dk of Object.keys(DOMAIN_MAP)) before[dk] = _snap(dk);

      fn(data);

      const changed = Object.keys(DOMAIN_MAP).filter(dk => _snap(dk) !== before[dk]);
      persist(changed.length ? changed : null);
      notify();
    },
    sub: (f)  => { subs.add(f); return () => subs.delete(f); },
    reset: () => {
      data = applyMigrations(null);
      persist(); notify();
    },
    /* reemplaza el blob completo desde la nube (legacy sh_data) */
    _replace: (incoming) => {
      const next = applyMigrations(typeof incoming === "string" ? JSON.parse(incoming) : incoming);
      const nextJson = JSON.stringify(next);
      if (nextJson === JSON.stringify(data)) return;
      data = next;
      notify();
    },
    /* merge parcial de un dominio (realtime de clave granular) */
    _mergeDomain: (domainKey, incoming) => {
      const fields = DOMAIN_MAP[domainKey];
      if (!fields) return;
      const parsed = typeof incoming === "string" ? JSON.parse(incoming) : incoming;
      let changed = false;
      for (const f of fields) {
        if (!(f in parsed)) continue;
        if (JSON.stringify(parsed[f]) !== JSON.stringify(data[f])) changed = true;
        data[f] = parsed[f];
      }
      if (!changed) return;
      /* actualizar localStorage sin subir a Supabase (ya vino de la nube) */
      try { localStorage.setItem("sh_data", JSON.stringify(data)); } catch {}
      notify();
    },
  };
}

const Store = makeStore();

function useStore() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => Store.sub(force), []);
  return [Store.get(), Store.set];
}

/* ── realtime & auth sync ───────────────────────────────── */
window.addEventListener("sh:storage-sync", (e) => {
  if (!e.detail || e.detail.value == null) return;
  const { key, value } = e.detail;
  if (key === "sh_data") {
    /* legacy: blob completo */
    Store._replace(value);
  } else if (DOMAIN_MAP[key]) {
    /* granular: solo el dominio que cambió */
    Store._mergeDomain(key, value);
  }
});

/* cuando el usuario se loguea y el sync inicial termina */
window.addEventListener("sh:user-synced", () => {
  const raw = _rawGet("sh_data");
  if (raw) {
    try { Store._replace(JSON.parse(raw)); } catch {}
  }
});

/* ── toasts ─────────────────────────────────────────────── */
let toastFn = () => {};
const toast = (msg) => toastFn(msg);

function ToastHost() {
  const [items, setItems] = React.useState([]);
  React.useEffect(() => {
    toastFn = (msg) => {
      const id = uid();
      setItems(x => [...x, { id, msg }]);
      setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 2800);
    };
  }, []);
  return (
    <div className="toast-wrap">
      {items.map(i => (
        <div className="toast" key={i.id}>
          <span className="ok"><Icon name="check" size={17} /></span>{i.msg}
        </div>
      ))}
    </div>
  );
}

/* ── sonidos (Web Audio API) ─────────────────────────────── */
const _sfx = (() => {
  let ctx = null;
  const getCtx = () => {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} }
    return ctx;
  };
  const play = (freq, type, dur, gain, delay = 0) => {
    const c = getCtx(); if (!c) return;
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.connect(env); env.connect(c.destination);
    osc.type = type; osc.frequency.value = freq;
    const t = c.currentTime + delay;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur);
  };
  return {
    tick:     () => { play(880,  "sine",     0.08, 0.18); },
    complete: () => { play(523,  "sine",     0.18, 0.22); play(659, "sine", 0.18, 0.22, 0.1); play(784, "sine", 0.28, 0.2, 0.2); },
    save:     () => { play(440,  "sine",     0.12, 0.15); play(550, "sine", 0.18, 0.12, 0.08); },
    error:    () => { play(220,  "sawtooth", 0.15, 0.12); },
  };
})();

const playSound = (name) => {
  try {
    const data = Store.get();
    if (!data.settings.sounds) return;
    _sfx[name]?.();
  } catch(e) {}
};

/* ── Pomodoro helpers ────────────────────────────────────── */
const addPomoMinutes = (mins) => {
  const today = new Date().toISOString().slice(0, 10);
  Store.set(s => {
    if (!Array.isArray(s.pomoLog)) s.pomoLog = [];
    const existing = s.pomoLog.find(e => e.date === today);
    if (existing) existing.mins = (existing.mins || 0) + mins;
    else s.pomoLog.push({ date: today, mins });
    /* mantener sólo últimos 60 días */
    if (s.pomoLog.length > 60) s.pomoLog = s.pomoLog.slice(-60);
  });
};

const getPomoWeekMins = () => {
  const log = Store.get().pomoLog || [];
  const today = new Date();
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const entry = log.find(e => e.date === key);
    if (entry) total += entry.mins || 0;
  }
  return total;
};

const getPomoWeekByDay = () => {
  const log = Store.get().pomoLog || [];
  const today = new Date();
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const entry = log.find(e => e.date === key);
    result.push((entry?.mins || 0) / 60); /* en horas */
  }
  return result;
};

/* ── POMO STORE — timer global que sobrevive navegación ──── */
const _pomoDur  = { foco: 25, corto: 5, largo: 15 };
const _pomoSubs = new Set();
const _ps = {
  running: false, started: false,
  mode: "foco", cycles: 0,
  secs: 1500,
  task: (() => { try { return localStorage.getItem("sh_pomo_task") || ""; } catch { return ""; } })(),
  _iv: null,
};
const _snap = () => ({ running: _ps.running, started: _ps.started, mode: _ps.mode, cycles: _ps.cycles, secs: _ps.secs, task: _ps.task });
const _pomoNotify = () => _pomoSubs.forEach(fn => fn(_snap()));

const PomoStore = {
  get: _snap,
  sub(fn) { _pomoSubs.add(fn); fn(_snap()); return () => _pomoSubs.delete(fn); },
  start() {
    if (_ps._iv) return;
    _ps.running = true; _ps.started = true; _pomoNotify();
    _ps._iv = setInterval(() => {
      if (_ps.secs <= 1) {
        clearInterval(_ps._iv); _ps._iv = null; _ps.running = false;
        if (_ps.mode === "foco") {
          _ps.cycles++; addPomoMinutes(25); playSound("complete");
          window.dispatchEvent(new CustomEvent("pomo:complete", { detail: { mode: _ps.mode, task: _ps.task } }));
        } else {
          playSound("save");
          window.dispatchEvent(new CustomEvent("pomo:complete", { detail: { mode: _ps.mode, task: _ps.task } }));
        }
        toast("¡Sesión completa! 🎉");
        _ps.secs = _pomoDur[_ps.mode] * 60;
        _ps.started = false;
        _pomoNotify(); return;
      }
      _ps.secs--; _pomoNotify();
    }, 1000);
  },
  pause() { clearInterval(_ps._iv); _ps._iv = null; _ps.running = false; _pomoNotify(); },
  toggle() { _ps.running ? PomoStore.pause() : PomoStore.start(); },
  reset() { clearInterval(_ps._iv); _ps._iv = null; _ps.running = false; _ps.started = false; _ps.secs = _pomoDur[_ps.mode] * 60; _pomoNotify(); },
  dismiss() { PomoStore.reset(); },
  setMode(m) { clearInterval(_ps._iv); _ps._iv = null; _ps.running = false; _ps.started = false; _ps.mode = m; _ps.secs = _pomoDur[m] * 60; _pomoNotify(); },
  setTask(t) { _ps.task = t; try { localStorage.setItem("sh_pomo_task", t); } catch {} _pomoNotify(); },
};

function usePomoStore() {
  const [s, set] = React.useState(() => PomoStore.get());
  React.useEffect(() => PomoStore.sub(set), []);
  return s;
}

/* ── CHAT STORE — mensajes globales, sobreviven navegación ── */
const _chatSubs = new Set();
const _chatState = {
  msgs:    [],   /* [{role, content, me, displayTime}] */
  draft:   "",
  typing:  false,
};
const _chatSnap  = () => ({ ..._chatState, msgs: [..._chatState.msgs] });
const _chatNotify = () => _chatSubs.forEach(fn => fn(_chatSnap()));

const ChatStore = {
  get: _chatSnap,
  sub(fn) { _chatSubs.add(fn); fn(_chatSnap()); return () => _chatSubs.delete(fn); },
  addMsg(msg)      { _chatState.msgs = [..._chatState.msgs, msg]; _chatNotify(); },
  setMsgs(msgs)    { _chatState.msgs = msgs; _chatNotify(); },
  setDraft(v)      { _chatState.draft = v; _chatNotify(); },
  setTyping(v)     { _chatState.typing = v; _chatNotify(); },
  clear()          { _chatState.msgs = []; _chatState.draft = ""; _chatState.typing = false; _chatNotify(); },
};

function useChatStore() {
  const [s, set] = React.useState(() => ChatStore.get());
  React.useEffect(() => ChatStore.sub(set), []);
  return s;
}

/* Fuente única de verdad para la racha actual */
const getStreak = () => Store.get().streak || 0;

/* Todas las tareas: globales + las de materia que aún no están en data.tasks */
const getAllTasks = (data) => {
  const global = data.tasks || [];
  const globalIds = new Set(global.map(t => t.id));
  const subjectTasks = [];
  for (const s of (data.subjects || [])) {
    const items = s.lists?.tareas || [];
    for (const item of items) {
      if (item.id && !globalIds.has(item.id) && item.t) {
        subjectTasks.push({
          ...item,
          subject: s.id,
          status: item.status || (item.done ? "lista" : "pendiente"),
        });
      }
    }
  }
  return [...global, ...subjectTasks];
};

export {
  Store, useStore, uid, scaleToZoom, toast, ToastHost,
  COLORS, PRIO, STATUS, ALL_WIDGETS,
  playSound, addPomoMinutes, getPomoWeekMins, getPomoWeekByDay,
  getStreak, getAllTasks,
  DEFAULT_EVAL, PASSING, subjectPromedio, deriveEstado,
  PomoStore, usePomoStore,
  ChatStore, useChatStore,
};