# Plan de trabajo StudyHub — Pendientes (Junio 2026)

> Documento de handoff para continuar el desarrollo en un chat nuevo.
> Generado 2026-06-09. Autor del proyecto: Vierii (Lautaro Bonadeo).

---

## 📋 Contexto rápido del proyecto

- **Stack**: React 18 (npm) + Vite 5 nativo (ES modules) + Supabase (auth/DB/realtime) + Vercel
- **Carpeta local**: `C:\StudyHub\StudyHub\studyhub-web\`
- **URL producción**: https://study-hub-theta-one.vercel.app
- **Repo**: https://github.com/Vierii22/StudyHub
- **Código de la app**: `src/app/*.jsx` (20 archivos, ES modules con imports explícitos)
- **Entry point**: `src/main.jsx` → `src/app/app.jsx`
- **Estilos**: TODO el CSS está inline en `index.html` dentro de un `<style>` gigante (incluyendo media queries mobile @768px y @480px)
- **Modelo de datos**: un solo blob `sh_data` en Supabase, manejado por `Store` (en `store.jsx`)

### Reglas de trabajo IMPORTANTES
- **NUNCA pushear a main sin que Vierii lo pida explícitamente.** Frases que autorizan: "subilo", "subí a producción", "pushea".
- **Nunca usar `--no-verify`** ni saltar git hooks.
- Cerrar los mensajes de commit con: `Co-Authored-By: Claude <noreply@anthropic.com>`
- Después de cada cambio: `npm run build` para verificar que compila antes de dar por terminado.
- Vierii valida por screenshot. Es directo, quiere resultados concretos.

### Cómo verificar imports (importante en ES modules)
Cada `.jsx` debe importar explícitamente lo que usa de otros módulos. Un símbolo usado sin importar = pantalla negra + `ReferenceError: X is not defined` en producción. Antes de dar por cerrado cualquier archivo, revisar que todo lo que usa esté en sus líneas de `import`.

---

## 🔴 PARTE 1 — BUGS PENDIENTES (arrancar por acá)

### B6 — Selector de colores (🎨) no funciona al editar widgets de una materia
**Síntoma**: En una materia abierta, en modo edición, al hacer click en el ícono 🎨 de un widget, el popover de colores no aparece o aparece en posición incorrecta.
**Dónde mirar**: `src/app/facultad2.jsx` (vista de materia / `SubjectView`). Buscar `colorPickerIdx` o el estado que controla qué popover está abierto.
**Causa probable**: conflicto entre `position:absolute` del popover y el contenedor del widget (overflow hidden o stacking context), o el estado no dispara re-render.
**Fix esperado**: que el popover se renderice por `ReactDOM.createPortal` o con `position:fixed` calculando coordenadas, igual que se hizo en el board del Mi Espacio.

### B7 — Tab "Cuenta" mal alineada en Configuración
**Síntoma**: La pestaña "Cuenta" se ve desalineada respecto a los otros tabs del modal de Configuración.
**Dónde mirar**: `src/app/config.jsx` línea ~24 (array de tabs: `["cuenta", "Cuenta", "gear"]`) y el CSS `.cfg-tabs` en `index.html`.
**Fix esperado**: revisar el orden/CSS de los tabs para que "Cuenta" quede alineada con el resto. Verificar también en mobile.

---

## 🟡 PARTE 2 — PÁGINA DE INICIO (landing) con fondo interactivo

**Objetivo**: Reemplazar/preceder la pantalla de Login actual por una landing linda y moderna.

**Requisitos de diseño**:
- Un **botón de "Iniciar" / "Comenzar" centrado** en el medio de la pantalla.
- **Fondo con elementos flotantes que reaccionan al mouse**: formas/blobs/partículas que se mueven sutilmente siguiendo o esquivando el cursor (efecto parallax o repulsión).
- Estética coherente con la app: violeta `#8b6dff`, fondo oscuro `#0d0d12`, fuentes Outfit + Space Grotesk.
- El botón de inicio lleva a la pantalla de Login actual (o la landing ES la nueva primera pantalla antes del login).

**Implementación técnica sugerida**:
- Componente nuevo `src/app/landing.jsx` con `export { Landing }`.
- Fondo interactivo: usar `<canvas>` con requestAnimationFrame, O divs con `transform` actualizados por `mousemove`, O un SVG con blobs animados. **Sin dependencias externas pesadas** (no three.js salvo que Vierii lo apruebe). Lo más liviano: ~8-15 "blobs" con `position:absolute`, cada uno con un offset que se interpola hacia la posición del mouse con un factor distinto (parallax por profundidad).
- Wire en `app.jsx`: agregar estado `"landing"` antes de `"login"` en la máquina de auth, o mostrar Landing cuando `auth === "login"` y el usuario todavía no tocó "Comenzar".
- Respetar `prefers-reduced-motion` para accesibilidad.
- Debe verse bien en mobile (los blobs reaccionan al touch o se quedan en animación idle).

**Archivos a tocar**: nuevo `landing.jsx`, `app.jsx` (router/auth), `index.html` (CSS de la landing).

---

## 🟡 PARTE 3 — TUTORIAL guiado (primera vez que iniciás sesión)

**Objetivo**: Apenas el usuario entra por primera vez, un tour interactivo lo pasea por toda la app y le enseña cada función. Se muestra **una sola vez**.

**Requisitos**:
- Se dispara automáticamente la primera vez que `auth === "app"` y no existe el flag de "tutorial visto".
- Recorre las secciones/funciones principales: Dashboard, Tareas, Misiones, Calendario, Pomodoro, Chat IA, Mi Espacio, Facultad/Materias, Configuración.
- Cada paso resalta un elemento de la UI (spotlight/highlight) con un tooltip explicativo y botones "Siguiente / Saltar".
- Al terminar (o saltar), guarda un flag para no volver a mostrarse.
- Botón en Configuración para "Volver a ver el tutorial" (resetea el flag).

**Implementación técnica sugerida**:
- Componente `src/app/tutorial.jsx` con `export { Tutorial }`.
- Flag de persistencia: `localStorage.setItem("sh_tutorial_done", "1")` o, mejor, dentro de `sh_data.settings` para que sincronice entre dispositivos.
- Spotlight: un overlay oscuro fijo con un "agujero" recortado sobre el elemento target (usar `getBoundingClientRect()` del elemento + un box-shadow gigante para el efecto de oscurecer todo menos el target, o `clip-path`).
- Cada paso define `{ selector, titulo, texto, seccion }`. Antes de mostrar un paso que vive en otra sección, navegar a esa sección (`setSection`) y esperar un tick para que el elemento exista.
- Marcar elementos clave con `data-tour="dashboard-xp"` etc. en el JSX para anclar el spotlight de forma estable (no depender de clases que cambian).
- **Sin librerías externas** preferentemente. Si se quiere acelerar, evaluar `driver.js` (liviano, ~5kb) pero confirmarlo con Vierii antes.
- Pensar bien el orden del recorrido y los textos (que sean claros y cortos, en español rioplatense).

**Archivos a tocar**: nuevo `tutorial.jsx`, `app.jsx` (disparar el tour + navegación entre pasos), varios `*.jsx` (agregar atributos `data-tour`), `config.jsx` (botón "ver tutorial de nuevo"), `index.html` (CSS del spotlight).

---

## 🟡 PARTE 4 — Bot (Hubby) responde dudas sobre cómo usar la app

**Objetivo**: El Chat IA (y/o el bot de Telegram) debe poder responder preguntas del usuario sobre **cómo usar StudyHub** ("¿cómo agrego una materia?", "¿dónde veo mis misiones?", "¿cómo funciona el pomodoro?").

**Implementación técnica sugerida**:
- El Chat IA usa Gemini 2.5 Flash vía `api/chat.js` (proxy serverless en Vercel). El contexto se arma en `src/app/sections2.jsx` (componente `ChatIA`, función que construye el system/context prompt).
- **Agregar al system prompt** una sección de "Manual de uso de StudyHub": una descripción estructurada de cada función y cómo se accede. Ej: "Para agregar una materia, andá a Facultad y tocá '+ Nueva materia'. El Pomodoro está en la sección Pomodoro, sirve para…". 
- Mantener ese manual en una constante reutilizable (ej. `src/app/help-content.js` con `export const APP_GUIDE = "..."`) para que lo usen TANTO el Chat IA como el bot de Telegram.
- Para el **bot de Telegram**: el Edge Function (`telegram-bot-edge-function.ts`) también llama a Gemini — agregarle el mismo `APP_GUIDE` al contexto. (Ojo: el deploy del Edge Function es MANUAL por Vierii en el dashboard de Supabase, ver Parte 6.)

**Archivos a tocar**: nuevo `help-content.js`, `sections2.jsx` (inyectar guía en el prompt del Chat IA), `telegram-bot-edge-function.ts` (inyectar guía en el bot).

---

## 🟢 PARTE 5 — Auditoría de seguridad (antes de abrir a usuarios reales)

Revisión profesional pendiente de:
- **RLS de Supabase**: confirmar que las policies (`auth.uid() = user_id`) impiden que un usuario lea/escriba datos de otro. Probar con dos cuentas.
- **Claves en el bundle**: `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY` son visibles en el client-side (es normal con anon key + RLS, pero confirmar que la anon key NO tiene permisos de más).
- **XSS**: inputs del usuario que se renderizan (diario, notas de materia, Mi Espacio, post-its). Verificar que React escapa todo y que no hay `dangerouslySetInnerHTML` sin sanitizar.
- **Service Worker** (`public/sw.js`): que no cachee tokens ni datos sensibles.
- **Auth**: política de contraseñas y rate limiting en Supabase Auth.

Hacer ANTES de lanzar a usuarios que no sean Vierii.

---

## 🟡 PARTE 6 — Pendiente MANUAL de Vierii (no lo hace el modelo)

### Re-deploy del bot de Telegram en Supabase
El archivo `telegram-bot-edge-function.ts` fue reescrito para leer/escribir el blob `sh_data`, pero **el deploy es manual**: Supabase Dashboard → Edge Functions → reemplazar el código. Si se hace la Parte 4 (bot responde dudas), hay que re-deployar de nuevo con el `APP_GUIDE` incluido.

---

## 🟢 PARTE 7 — Futuro lejano (no urgente)

### App de escritorio / instalable
En orden de recomendación:
1. **PWA + landing** (la landing de la Parte 2 puede incluir un botón "Instalar app" usando el evento `beforeinstallprompt` que ya está cableado en `window._pwaPrompt`). Gratis, funciona hoy.
2. **Tauri** (Rust + web actual, ~10MB, moderno). Vierii dijo "menos tauri" por ahora → dejarlo para después.
3. ~~Electron~~ — muy pesado, no vale la pena.

### F7 — Pizarrón libre por materia
El canvas libre tipo Canva/Miro YA existe en "Mi Espacio" (`board.jsx`). Si se quiere que CADA materia tenga su propio pizarrón, hay que extender el modelo de datos del layout de materias (`{id, x, y, w, h}` por widget). Es el proyecto más grande — planear aparte.

---

## ✅ Ya terminado en la sesión anterior (NO rehacer)

- Migración completa a ES modules + Vite nativo (React desde npm, no CDN)
- Chat IA persiste mensajes al cambiar de pestaña (ChatStore en `store.jsx`)
- Rediseño mobile completo: Tareas (cards + task-row), Mi Espacio (rail overlay), Dashboard (grid 1 col), Calendario (celdas compactas), Misiones (header wrap)
- App siempre abre en Dashboard (ya no restaura la última sección)
- Fix `PRIO is not defined` (pantalla negra en Misiones/Calendario)
- Mini-Pomodoro flotante que persiste al navegar (`PomoMini` + `PomoStore`)
- Pizarrón rediseñado en Mi Espacio: fullscreen, widgets (tabla, frame, link con favicon), pointer events (touch), fix esquinitas (z-index/bringToFront)

---

## 🎯 Orden sugerido de ataque

1. **B6 + B7** (bugs rápidos, desbloquean uso real)
2. **Parte 4** — Bot responde dudas (rápido, alto valor, solo agregar contexto al prompt)
3. **Parte 3** — Tutorial guiado (medio, alto valor para nuevos usuarios)
4. **Parte 2** — Landing interactiva (medio, mucho impacto visual)
5. **Parte 5** — Auditoría de seguridad (antes de abrir a otros)
6. Parte 7 — Futuro

> Recordatorio: build (`npm run build`) tras cada cambio, y NO pushear sin que Vierii diga "subilo / pushea".
