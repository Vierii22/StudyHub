import React from 'react';

/* ============================================================
   INSTALAR LA APP — hook para el botón "Instalar" del menú.
   Android/Chrome/Edge: escucha 'beforeinstallprompt' y dispara
   el prompt nativo del navegador. iOS Safari no tiene esa API
   (Apple no la permite) — ahí mostramos instrucciones manuales
   ("Compartir → Agregar a pantalla de inicio").
   ============================================================ */
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

function usePWAInstall() {
  const [deferred, setDeferred] = React.useState(null);
  const [standalone, setStandalone] = React.useState(isStandalone());

  React.useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setDeferred(null); setStandalone(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferred) return false;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome === "accepted";
  };

  return {
    isStandalone: standalone,
    canPrompt: !!deferred,
    isIOS: isIOS(),
    promptInstall,
  };
}

export { usePWAInstall };
