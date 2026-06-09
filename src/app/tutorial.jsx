import React from 'react';
import ReactDOM from 'react-dom';
import { Icon } from './icons.jsx';

/* ============================================================
   TUTORIAL — tour guiado primera vez
   ============================================================ */

export const TUTORIAL_KEY = 'sh_tutorial_done';

const STEPS = [
  {
    section: 'dashboard',
    selector: '[data-tour="dashboard"]',
    title: '👋 Bienvenido a StudyHub',
    text: 'Este es tu Dashboard. Acá ves tu XP, racha, tareas del día y próximos eventos de un vistazo. Los widgets se personalizan desde Configuración.',
  },
  {
    section: 'facultad',
    selector: '[data-tour="facultad"]',
    title: '🎓 Facultad — tus materias',
    text: 'Acá manejás tus materias. Cada una tiene su pizarrón libre, widgets de temas, TPs, notas, fechas, links y archivos adjuntos.',
  },
  {
    section: 'tareas',
    selector: '[data-tour="tareas"]',
    title: '✅ Tareas',
    text: 'Todas tus tareas en un lugar. Filtrá por materia, prioridad o estado. El botón "+" agrega nuevas.',
  },
  {
    section: 'misiones',
    selector: '[data-tour="misiones"]',
    title: '⚡ Misiones',
    text: 'Tus objetivos personales tipo videojuego. Completar hitos te da XP y sube tu nivel de estudiante.',
  },
  {
    section: 'pomodoro',
    selector: '[data-tour="pomodoro"]',
    title: '🍅 Pomodoro',
    text: 'Timer de 25 min foco + 5 descanso. Registra tus horas automáticamente. Usá Espacio para pausar.',
  },
  {
    section: 'chat',
    selector: '[data-tour="chat"]',
    title: '🤖 EstudioIA',
    text: 'Tu asistente inteligente. Preguntale cómo usar la app, que priorice tus tareas, o que te arme un plan de repaso.',
  },
  {
    section: 'espacio',
    selector: '[data-tour="espacio"]',
    title: '🎨 Mi Espacio',
    text: 'Tu pizarrón libre. Notas, listas, post-its, tablas, código, imágenes... organizá como más te guste.',
  },
  {
    section: 'config',
    selector: '[data-tour="config"]',
    title: '⚙️ Configuración',
    text: '¡Ya terminaste el tour! Desde acá personalizás el tema, conectás Telegram (Hubby), editás tu perfil y podés volver a ver este tutorial.',
  },
];

const PAD = 10;
const TT_W = 320;
const TT_H = 180;

function getTooltipPos(rect) {
  if (!rect) return { left: window.innerWidth / 2 - TT_W / 2, top: window.innerHeight / 2 - TT_H / 2 };

  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const left = Math.max(PAD, Math.min(rect.left + rect.width / 2 - TT_W / 2, window.innerWidth - TT_W - PAD));

  if (spaceBelow >= TT_H + PAD * 2) {
    return { left, top: rect.bottom + PAD };
  } else if (spaceAbove >= TT_H + PAD * 2) {
    return { left, top: rect.top - TT_H - PAD };
  }
  /* fallback: right side */
  return { left: Math.min(rect.right + PAD, window.innerWidth - TT_W - PAD), top: rect.top };
}

function Tutorial({ onDone, currentSection, onNavigate }) {
  const [step, setStep] = React.useState(0);
  const [rect, setRect] = React.useState(null);
  const pendingNav = React.useRef(false);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const measureTarget = React.useCallback(() => {
    const el = document.querySelector(current.selector);
    if (el) setRect(el.getBoundingClientRect());
    else setRect(null);
  }, [current.selector]);

  React.useEffect(() => {
    if (current.section && current.section !== currentSection && !pendingNav.current) {
      pendingNav.current = true;
      onNavigate(current.section);
      return;
    }
    pendingNav.current = false;
    const t = setTimeout(measureTarget, 280);
    window.addEventListener('resize', measureTarget);
    return () => { clearTimeout(t); window.removeEventListener('resize', measureTarget); };
  }, [step, currentSection]);

  const next = () => {
    if (isLast) { localStorage.setItem(TUTORIAL_KEY, '1'); onDone(); }
    else setStep(s => s + 1);
  };

  const skip = () => { localStorage.setItem(TUTORIAL_KEY, '1'); onDone(); };

  const ttPos = getTooltipPos(rect);
  const highlightStyle = rect ? {
    position: 'fixed',
    left: rect.left - PAD,
    top: rect.top - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
    borderRadius: 14,
    boxShadow: '0 0 0 9999px rgba(0,0,0,.72)',
    zIndex: 998,
    pointerEvents: 'none',
  } : {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,.72)',
    zIndex: 998, pointerEvents: 'none',
  };

  return ReactDOM.createPortal(
    <>
      {/* spotlight */}
      <div style={highlightStyle} />

      {/* backdrop clickable to skip */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 997 }} onClick={skip} />

      {/* tooltip */}
      <div style={{
        position: 'fixed',
        left: ttPos.left,
        top: ttPos.top,
        width: TT_W,
        zIndex: 999,
        background: '#16151e',
        border: '1px solid rgba(139,109,255,.45)',
        borderRadius: 18,
        padding: '20px 22px',
        boxShadow: '0 24px 60px -16px rgba(0,0,0,.8), 0 0 0 1px rgba(139,109,255,.12)',
        fontFamily: 'var(--font-body)',
      }} onClick={e => e.stopPropagation()}>

        {/* progress dots */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              height: 3, flex: 1, borderRadius: 99,
              background: i <= step ? 'var(--violet)' : 'var(--line-2)',
              transition: 'background .2s',
            }} />
          ))}
        </div>

        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, lineHeight: 1.3 }}>{current.title}</div>
        <div style={{ fontSize: 13.5, color: 'var(--tx-2)', lineHeight: 1.6, marginBottom: 18 }}>{current.text}</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={skip} style={{ background: 'none', border: 'none', color: 'var(--tx-3)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'var(--font-body)' }}>
            Saltar tour
          </button>
          <button onClick={next} style={{
            background: 'var(--grad)', color: '#fff',
            border: 'none', borderRadius: 10,
            padding: '9px 18px', fontSize: 13.5, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            {isLast ? 'Empezar' : 'Siguiente'} <Icon name="chevR" size={14} color="#fff" />
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

export { Tutorial };
