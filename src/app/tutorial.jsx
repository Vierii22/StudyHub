import React from 'react';

import { Icon } from './icons.jsx';
import { Hubby } from './ui.jsx';
import { useStore } from './store.jsx';

/* ============================================================
   TUTORIAL — recorrido de bienvenida (primera vez que entrás)
   Se vuelve a abrir desde Configuración con el evento
   window "sh:open-tutorial".
   ============================================================ */
const STEPS = [
  { pose: "saluda",   icon: null,       title: "¡Hola! Soy Hubby",      body: "Te muestro StudyHub en un minuto. Podés saltarte esto cuando quieras y verlo de nuevo desde Configuración." },
  { pose: "idea",     icon: "home",     title: "Hoy",                   body: "Tu inicio: escribí cualquier cosa en el anotador y la IA la organiza sola. Mirá el “¿y ahora qué?” y las tareas del día." },
  { pose: "vamos",    icon: "calendar", title: "Calendario",            body: "Semana, mes y año. Arrastrá eventos entre días, tocá un día para ver todo, y destacá los parciales importantes." },
  { pose: "pensando", icon: "layers",   title: "Facultad",              body: "Tus materias: temario dividido en unidades, archivos, aula virtual y “Planificar la semana” arrastrando los temas." },
  { pose: "contento", icon: "check",    title: "Tareas",                body: "Todas tus tareas juntas, agrupadas por materia o por fecha. Lo que completás hoy se cuenta y se reinicia cada día." },
  { pose: "festejo",  icon: "target",   title: "Progreso",              body: "Cargá tus notas y el estado de cada materia se calcula solo. Acá también está tu Plan de correlatividades." },
  { pose: "idle",     icon: "film",     title: "Ocio",                  body: "Pelis, series y juegos con estado y puntaje — para cuando cortás de estudiar." },
  { pose: "chat",     icon: "chat",     title: "Hablá conmigo",         body: "Tocá mi carita abajo a la izquierda para el chat con IA. También me podés escribir por Telegram (se activa en Configuración)." },
];

function Tutorial() {
  const [data, set] = useStore();
  const [forced, setForced] = React.useState(false);
  const [i, setI] = React.useState(0);

  React.useEffect(() => {
    const open = () => { setI(0); setForced(true); };
    window.addEventListener("sh:open-tutorial", open);
    return () => window.removeEventListener("sh:open-tutorial", open);
  }, []);

  const show = forced || !data.settings?.tutorialDone;
  if (!show) return null;

  const finish = () => {
    set(s => { s.settings = { ...s.settings, tutorialDone: true }; });
    setForced(false);
    setI(0);
  };

  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="tut-overlay" onClick={finish}>
      <div className="tut-card" onClick={e => e.stopPropagation()}>
        <button className="tut-skip" onClick={finish}>Saltar</button>
        <div className="tut-hubby"><Hubby pose={step.pose} size={104} className="hubby-float" /></div>
        {step.icon && <div className="tut-badge"><Icon name={step.icon} size={19} /></div>}
        <div className="tut-title" key={"t" + i}>{step.title}</div>
        <div className="tut-body" key={"b" + i}>{step.body}</div>
        <div className="tut-dots">
          {STEPS.map((_, j) => <span key={j} className={j === i ? "on" : ""} onClick={() => setI(j)} />)}
        </div>
        <div className="tut-nav">
          {i > 0
            ? <button className="btn btn-secondary btn-sm" onClick={() => setI(i - 1)}>Atrás</button>
            : <span className="mono" style={{ fontSize: 10.5, color: "var(--tx-3)" }}>{i + 1} / {STEPS.length}</span>}
          {last
            ? <button className="btn btn-primary btn-sm" onClick={finish}>¡Empezar!</button>
            : <button className="btn btn-primary btn-sm" onClick={() => setI(i + 1)}>Siguiente</button>}
        </div>
      </div>
    </div>
  );
}

export { Tutorial };
