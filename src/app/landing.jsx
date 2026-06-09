import React from 'react';

/* ============================================================
   LANDING — pantalla de bienvenida con blobs interactivos
   Blobs reaccionan al movimiento del mouse (parallax)
   ============================================================ */

const BLOBS = [
  { x: 18, y: 22, size: 480, color: '#8b6dff', opacity: 0.28, depth: 0.06, delay: 0 },
  { x: 72, y: 65, size: 420, color: '#c264e8', opacity: 0.22, depth: 0.04, delay: 1.2 },
  { x: 50, y: 10, size: 350, color: '#4ec5e8', opacity: 0.15, depth: 0.08, delay: 0.6 },
  { x: 80, y: 30, size: 300, color: '#8b6dff', opacity: 0.18, depth: 0.05, delay: 2 },
  { x: 10, y: 75, size: 360, color: '#c264e8', opacity: 0.16, depth: 0.07, delay: 0.3 },
  { x: 60, y: 85, size: 280, color: '#6d8bff', opacity: 0.12, depth: 0.03, delay: 1.8 },
  { x: 35, y: 50, size: 200, color: '#a48cff', opacity: 0.20, depth: 0.09, delay: 0.9 },
  { x: 88, y: 80, size: 250, color: '#8b6dff', opacity: 0.14, depth: 0.05, delay: 1.5 },
];

function Landing({ onStart }) {
  const mouseRef = React.useRef({ x: 0.5, y: 0.5 });
  const currentRef = React.useRef({ x: 0.5, y: 0.5 });
  const rafRef = React.useRef(null);
  const blobRefs = React.useRef([]);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  React.useEffect(() => {
    if (reducedMotion) return;

    const onMove = (e) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };

    const onTouch = (e) => {
      const t = e.touches[0];
      if (t) mouseRef.current = {
        x: t.clientX / window.innerWidth,
        y: t.clientY / window.innerHeight,
      };
    };

    const animate = () => {
      /* smooth interpolation toward mouse position */
      currentRef.current.x += (mouseRef.current.x - currentRef.current.x) * 0.04;
      currentRef.current.y += (mouseRef.current.y - currentRef.current.y) * 0.04;

      const cx = currentRef.current.x - 0.5;
      const cy = currentRef.current.y - 0.5;

      blobRefs.current.forEach((el, i) => {
        if (!el) return;
        const blob = BLOBS[i];
        const dx = cx * blob.depth * window.innerWidth;
        const dy = cy * blob.depth * window.innerHeight;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onTouch, { passive: true });
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onTouch);
      cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion]);

  return (
    <div className="landing-root">
      {/* blobs de fondo */}
      <div className="landing-blobs" aria-hidden="true">
        {BLOBS.map((b, i) => (
          <div
            key={i}
            ref={el => { blobRefs.current[i] = el; }}
            className="landing-blob"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: b.size,
              height: b.size,
              background: b.color,
              opacity: b.opacity,
              animationDelay: `${b.delay}s`,
            }}
          />
        ))}
      </div>

      {/* contenido central */}
      <div className="landing-center">
        <div className="landing-logo-wrap">
          <img src="assets/logo.png" alt="StudyHub" className="landing-logo" />
          <div className="landing-glow" />
        </div>

        <h1 className="landing-title">
          Study<span className="landing-accent">Hub</span>
        </h1>
        <p className="landing-sub">
          Tu centro de estudio universitario.<br />
          Tareas, materias, pomodoro y más — todo en un lugar.
        </p>

        <button className="landing-btn" onClick={onStart} autoFocus>
          <span>Comenzar</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <p className="landing-hint">Ya tenés cuenta? Iniciá sesión después de entrar.</p>
      </div>
    </div>
  );
}

export { Landing };
