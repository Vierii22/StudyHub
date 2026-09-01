/* ============================================================
   QA-ONLY entry — NUNCA commitear. Renderiza la app real con datos
   de muestra, sin pasar por el login de Supabase, para poder
   inspeccionar visualmente las pantallas internas en mobile.
   ============================================================ */
import React from 'react';
import ReactDOM from 'react-dom/client';

import { Store, useStore, uid, ToastHost } from './app/store.jsx';
import { Header, MobileMenu, HubbyChatFab } from './app/ui.jsx';
import { Dashboard } from './app/dashboard2.jsx';
import { Facultad } from './app/facultad.jsx';
import { SubjectView } from './app/facultad2.jsx';
import { Tareas } from './app/tareas.jsx';
import { Calendario } from './app/calendario.jsx';
import { ChatIA } from './app/chat.jsx';
import { Ocio } from './app/ocio.jsx';
import { Notas } from './app/notas.jsx';
import { ConfigSection } from './app/config.jsx';
import { FeedbackWidget } from './app/feedback.jsx';
import { WeekPlanner } from './app/weekplanner.jsx';
import { Onboarding } from './app/login.jsx';

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const plusDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };

const sampleData = {
  profile: { name: "Juli", initial: "J", role: "uni", uni: "UTN FRBA", career: "Ing. en Sistemas", year: "3", email: "juli@test.com", photo: null, hubby: false },
  streak: 4,
  subjects: [
    { id: "s1", name: "Análisis Matemático II", color: "#D9551F", photo: null, profs: ["Dra. Pérez"], files: [], eval: { parciales: 2, coloquio: false, final: true, promo: { on: true, mode: "promedio", threshold: 7 }, promedioOn: true }, grades: { p1: 8 }, promoManual: false, schedule: [], commission: "K3001", year: "2", studyPlan: [], lists: { unidades: [{ id: "u1", name: "Límites y continuidad", collapsed: false }], temas: [{ id: "t1", t: "Límites", unidadId: "u1", resumido: true, estudiado: true, repasos: 2 }, { id: "t2", t: "Derivadas", unidadId: "u1", resumido: false, estudiado: false, repasos: 0 }], tareas: [{ id: "ta1", t: "Practica 3", done: false }], notas: [{ id: "n1", t: "Repasar regla de L'Hôpital antes del parcial" }], fechas: [{ id: "f1", t: "Primer parcial", date: plusDays(3), important: true }] } },
    { id: "s2", name: "Programación I", color: "#C68A2E", photo: null, profs: [], files: [], eval: { parciales: 2, coloquio: false, final: true, promo: { on: true, mode: "parciales", threshold: 7 }, promedioOn: true }, grades: {}, promoManual: false, schedule: [], commission: "K1002", year: "1", studyPlan: [], lists: { unidades: [], temas: [], tareas: [], notas: [], fechas: [] } },
    { id: "s3", name: "Física I", color: "#7E8A4F", photo: null, profs: [], files: [], eval: { parciales: 2, coloquio: false, final: true, promo: { on: false, mode: "promedio", threshold: 7 }, promedioOn: true }, grades: { p1: 9, p2: 8, final: 8 }, promoManual: false, schedule: [], commission: "", year: "1", studyPlan: [], lists: { unidades: [], temas: [], tareas: [], notas: [], fechas: [] } },
  ],
  tasks: [
    { id: "tk1", t: "Terminar TP de redes", due: "Hoy", dueDate: iso(today), desc: "", subject: "s2", prio: "alta", status: "pendiente", done: false },
    { id: "tk2", t: "Leer capítulo 4", due: plusDays(2).slice(8,10) + "/" + plusDays(2).slice(5,7), dueDate: plusDays(2), desc: "", subject: "s1", prio: "media", status: "pendiente", done: false },
    { id: "tk3", t: "Entregar informe de laboratorio", due: "—", dueDate: "", desc: "", subject: "s3", prio: "baja", status: "progreso", done: false },
    { id: "tk4", t: "Repasar apuntes", due: "—", dueDate: "", desc: "", subject: null, prio: "media", status: "lista", done: true, completedAt: iso(today) },
  ],
  missions: [],
  events: [
    { title: "Primer parcial Análisis II", date: plusDays(3), day: parseInt(plusDays(3).slice(8,10)), time: "14:00", kind: "parcial", important: true, subjectId: "s1", color: "#D9551F", id: "e1" },
    { title: "Clase de Programación", date: plusDays(1), day: parseInt(plusDays(1).slice(8,10)), time: "09:00", kind: "clase", subjectId: "s2", color: "#C68A2E", id: "e2" },
    { title: "Entrega TP redes", date: iso(today), day: today.getDate(), time: "", kind: "entrega", subjectId: "s2", color: "#C68A2E", id: "e3" },
  ],
  journal: [], journalDraft: "", morning: [],
  kitchen: { heladera: [], almacen: [], freezer: [] }, shopping: [],
  finance: { budget: 200000, expenses: [] }, home: [],
  ocio: {
    pelis: [{ id: "o1", title: "Interstellar", year: "2014", platform: "HBO Max", status: "visto", rating: 9, progress: 0, hours: 0, cover: null, notes: [] },
            { id: "o2", title: "Dune Parte 2", year: "2024", platform: "Cine", status: "quiero_ver", rating: 0, progress: 0, hours: 0, cover: null, notes: [] }],
    series: [{ id: "o3", title: "Breaking Bad", year: "2008", platform: "Netflix", status: "viendo", rating: 10, progress: 60, hours: 30, cover: null, notes: [] }],
    juegos: [],
  },
  plan: { subjects: [] }, pomoLog: [],
  dashWidgets: ["tareas","agenda","racha","completas","ring","materias","horas"], dashSpans: {}, dashNote: "",
  widgetConfig: {}, bgImages: {}, taskCalendarMap: {},
  space: { activeId: "inicio", pages: [{ id: "inicio", icon: "pin", title: "Inicio", kind: "doc", blocks: [] }] },
  settings: { uiScale: 40, glow: true, anim: true, sounds: false, accent: "violet", tutorialDone: true },
};

// Seed ANTES de que se monte cualquier cosa que lea el store
try { localStorage.setItem("sh_data", JSON.stringify(sampleData)); } catch {}
Store._replace(sampleData);

const SECTIONS = ["dashboard", "facultad", "facultad-subject", "tareas", "calendario", "planner", "chat", "ocio", "notas", "config", "onboarding"];

function QAApp() {
  const [data] = useStore();
  const [section, setSection] = React.useState("dashboard");
  const [openSubject, setOpenSubject] = React.useState(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [isMobile] = React.useState(true); // forzado: sólo nos interesa mobile acá

  const nav = (s) => { setOpenSubject(null); setSection(s); };

  const render = () => {
    if (section === "facultad" && openSubject)
      return <SubjectView subjectId={openSubject} onBack={() => setOpenSubject(null)} autoOpenPlanner={false} onPlannerConsumed={() => {}} />;
    switch (section) {
      case "dashboard":  return <Dashboard onNav={nav} />;
      case "facultad":   return <Facultad onOpenSubject={setOpenSubject} onNav={nav} />;
      case "tareas":     return <Tareas onOpenSubject={(id) => { setSection("facultad"); setOpenSubject(id); }} autoNew={false} />;
      case "calendario": return <Calendario onOpenSubjectPlanner={(id) => { setSection("facultad"); setOpenSubject(id); }} />;
      case "planner":    return <WeekPlanner onBack={() => nav("dashboard")} />;
      case "onboarding": return <Onboarding onDone={() => nav("dashboard")} />;
      case "chat":       return <ChatIA />;
      case "ocio":       return <Ocio />;
      case "notas":      return <Notas onNav={nav} />;
      case "config":     return <ConfigSection onLogout={() => {}} />;
      default: return <Dashboard onNav={nav} />;
    }
  };

  return (
    <div className="app app-mobile">
      {/* selector de sección para QA — no es parte de la app real */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999, display: "flex", gap: 4, padding: 4, background: "#000", overflowX: "auto" }}>
        {SECTIONS.map(s => <button key={s} onClick={() => { setSection(s === "facultad-subject" ? "facultad" : s); if (s === "facultad-subject") setOpenSubject("s1"); }} style={{ fontSize: 9, padding: "4px 6px", flex: "0 0 auto", background: section === s ? "#D9551F" : "#333", color: "#fff", border: "none", borderRadius: 4 }}>{s}</button>)}
      </div>
      <div className="main" style={{ marginTop: 24 }}>
        <Header profile={data.profile} onNav={nav} section={section} onMenu={() => setMenuOpen(true)} />
        <div className="scroll" style={{ paddingBottom: "90px" }}>
          {render()}
        </div>
      </div>
      <MobileMenu open={menuOpen} section={section} onNav={nav} onClose={() => setMenuOpen(false)} />
      <HubbyChatFab section={section} onNav={nav} />
      <FeedbackWidget section={section} />
      <ToastHost />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<QAApp />);
