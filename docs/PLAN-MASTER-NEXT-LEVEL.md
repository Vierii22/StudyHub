# PLAN MAESTRO — StudyHub al siguiente nivel
> Creado: 2026-06-10. Objetivo: app comercializable, sensación nativa en celular, identidad visual propia, y un "modo trabajo" para profesionales (caso de uso: dueño de empresa).
> Este documento está pensado para ser ejecutado fase por fase por un modelo económico. Cada tarea tiene archivos concretos y criterio de aceptación. **Ejecutar en orden — las fases tempranas son fundación de las tardías.**

---

## Estado actual (contexto para quien ejecute)

- **Stack:** React 18 + Vite, ES modules en `src/app/*.jsx`, CSS inline en `index.html` (~52KB), Supabase (auth + postgres + edge function de Telegram), deploy en Vercel, PWA básica (`public/manifest.json`, `public/sw.js`).
- **Datos:** TODO el estado vive en un único blob JSON `sh_data` en localStorage, espejado a la tabla `app_data` de Supabase (`src/storage.js` + `src/app/syncEngine.js`). Las tablas relacionales del schema (`tasks`, `subjects`, etc.) existen pero NO se usan.
- **Secciones:** dashboard con widgets, facultad (materias con pizarrón), tareas, misiones (gamificación XP), calendario, pomodoro, chat IA ("Hubby"), diario, mi espacio (canvas libre), historial, cocina/recetas, finanzas, casa, ocio, config.
- **Extras ya hechos:** bot de Telegram, tutorial guiado, landing, feedback widget, error boundary, mini-pomodoro flotante.

---

## FASE 0 — Fundación técnica (obligatoria antes de comercializar)

Sin esto, todo lo demás se cae con más de ~5 usuarios reales.

### 0.1 Sync granular (el problema más grave hoy)
**Problema:** `sh_data` es un solo JSON gigante con last-write-wins. Dos dispositivos abiertos = pérdida de datos silenciosa (el poll de 60s de `storage.js` pisa todo el estado local).
**Tarea:**
- Partir `sh_data` en claves separadas por dominio: `sh_tasks`, `sh_subjects`, `sh_calendar`, `sh_diary`, `sh_finanzas`, `sh_profile`, `sh_settings`, etc. Cada una sigue siendo un JSON, pero el conflicto se reduce a un dominio.
- En `store.jsx`: el Store lee/escribe por dominio; `setItem` solo sube la clave que cambió.
- En `storage.js`: el realtime/poll ya soporta claves múltiples — solo hay que dejar de tratar `sh_data` como especial.
- Agregar `updated_at` por clave y, al recibir un sync, NO pisar si la versión local es más nueva (comparar timestamps).
- Script de migración al iniciar: si existe `sh_data` viejo, partirlo en las claves nuevas y borrar el blob (local y en `app_data`).
**Aceptación:** abrir la app en dos pestañas, editar una tarea en cada una con <60s de diferencia → no se pierde ninguna edición de dominios distintos.

### 0.2 Auditoría de seguridad (pendiente de antes)
- Verificar RLS con dos cuentas de prueba (que una no vea datos de la otra vía consola de red).
- Confirmar que la anon key no tiene permisos extra; revisar políticas de `feedback` (el INSERT con `WITH CHECK (true)` permite spam anónimo — agregar rate limit o exigir `auth.uid() IS NOT NULL`).
- Activar rate limiting de Auth en el dashboard de Supabase (manual).
- Revisar que `api/chat.js` (proxy IA en Vercel) valide el JWT de Supabase antes de gastar tokens — si no, cualquiera puede usar tu key de IA. **Crítico para comercializar.**

### 0.3 Higiene del repo
- Borrar `index-old.html` (957KB), `public/app.bundle.js` (430KB, build viejo), `public/app/*.jsx` (copias desactualizadas del src), zips de Electron de la raíz.
- Mover el CSS de `index.html` a `src/styles/*.css` importado desde `main.jsx` (Vite lo procesa, permite minificar y partir). Mantener variables CSS como están.
- `.env` está commiteado — verificar que solo tenga claves públicas (anon key/URL); si hay algo secreto, rotarlo y moverlo a variables de entorno de Vercel.

### 0.4 Analytics y errores (necesario para comercializar)
- Integrar **Vercel Analytics** (gratis, 1 línea) + **Sentry** (free tier) conectado al ErrorBoundary de `app.jsx` y a `window.onerror`.
- Eventos mínimos: signup, onboarding completado, sección visitada, tarea creada, retención D1/D7.
**Aceptación:** un error en producción aparece en Sentry con stack trace legible (subir sourcemaps en el build).

---

## FASE 1 — Sensación de app nativa en el celular

La diferencia entre "página web adaptada" y "app nativa" es una lista concreta de detalles. Todos van acá.

### 1.1 Bottom tab bar en mobile (el cambio #1)
Las apps nativas no usan hamburguesa + sidebar. En `≤768px`:
- Ocultar el Sidebar y agregar una **tab bar inferior fija** con 4 íconos + botón central destacado: Inicio · Tareas · **[+]** · Calendario · Más.
- El **[+]** abre un *bottom sheet* de captura rápida (ver 3.1).
- "Más" abre un sheet con el resto de las secciones (grilla de íconos).
- Archivo nuevo `src/app/tabbar.jsx`; montar en `app.jsx` con media query; respetar `env(safe-area-inset-bottom)` para iPhone.
**Aceptación:** en un viewport de 390px no existe hamburguesa; todo es alcanzable con el pulgar.

### 1.2 Checklist CSS "no soy una web"
Agregar a los estilos globales:
```css
html { -webkit-tap-highlight-color: transparent; -webkit-text-size-adjust: 100%; }
body { overscroll-behavior: none; }                 /* sin rebote blanco */
.app  { user-select: none; }                         /* texto no seleccionable, salvo inputs/diario */
input, textarea, [contenteditable] { user-select: text; }
input, select, textarea { font-size: 16px; }         /* evita el auto-zoom de iOS al enfocar */
@media (pointer: coarse) { .btn, .nav-item, [role=button] { min-height: 44px; } }
```
- `viewport-fit=cover` en el meta viewport + paddings con `safe-area-inset-*` en header y tab bar.
- `theme-color` dinámico que matchee el fondo real (`#18181d` ya está cerca, verificar contra `--bg`).

### 1.3 Transiciones y gestos nativos
- **View Transitions API** para el cambio de sección (slide horizontal en mobile, fade en desktop). Fallback: sin animación. Tocar `nav()` en `app.jsx` envolviendo el setState en `document.startViewTransition`.
- **Swipe-back**: gesto de arrastre desde el borde izquierdo para volver (en `SubjectView` y vistas de detalle). Implementar con pointer events, sin librerías.
- **Pull-to-refresh** propio en la vista de scroll (dispara el `fetchLatest` del sync) — y `overscroll-behavior-y: contain` para matar el nativo del browser.
- **Haptics:** `navigator.vibrate(10)` al completar tarea, cerrar pomodoro, subir de nivel (guard con `if ('vibrate' in navigator)`).
- **Bottom sheets** en vez de modales centrados en mobile: los modales existentes (`SubjectModal`, morning modal, formularios de tarea) deben deslizarse desde abajo con handle para arrastrar y cerrar. Hacer un componente `Sheet` genérico en `ui.jsx` y migrar los modales.

### 1.4 PWA pro
- **Manifest:** agregar `shortcuts` (Nueva tarea, Pomodoro, Hoy), `share_target` (compartir texto/links desde otras apps → entra como captura rápida), `screenshots` (mejora el prompt de instalación en Android), `orientation: portrait`.
- **iOS:** `apple-touch-icon`, `apple-mobile-web-app-status-bar-style: black-translucent`, splash screens generadas (usar `pwa-asset-generator` en un script npm).
- **Push notifications** (Web Push + VAPID): recordatorios de tareas con vencimiento, eventos del calendario, racha en peligro. Edge function de Supabase con cron (`pg_cron`) que consulta vencimientos y dispara push. UI de opt-in en Config > Notificaciones. *(En iOS requiere PWA instalada — mostrar instrucciones de instalación si no lo está.)*
- **Offline real:** el SW actual es network-first; agregar cola de escrituras offline (IndexedDB) en `storage.js`: si `_supabaseSet` falla, encolar y reintentar en `online`. Indicador sutil "sin conexión / sincronizando / al día" en el header.
- **Detección standalone:** `display-mode: standalone` → ocultar banners de instalación, ajustar paddings.

### 1.5 Percepción de velocidad
- Skeleton loaders en dashboard y listas (nunca spinner a pantalla completa salvo el boot).
- `prefetch` de secciones al hover/touchstart del nav.
- Optimizar imágenes: `hubby-bot.png` pesa 1.3MB y los íconos 210KB c/u → convertir a WebP y redimensionar (script con `sharp`).

### 1.6 (Camino futuro, fase comercial) Capacitor
Cuando quieras estar en App Store / Play Store: envolver con **Capacitor** (mismo código web). Da push nativo en iOS sin instalación PWA, haptics reales, widgets de pantalla de inicio. No hacerlo ahora — anotar como hito de la Fase 5.

---

## FASE 2 — Identidad visual: que no parezca template

Ya hay buena base (acentos, variantes, fuentes). Lo que falta es *personalidad y detalle*:

### 2.1 Microinteracciones (lo que más "premium" se siente)
- Animación al completar tarea: check que se dibuja (SVG stroke-dashoffset) + la fila se desvanece y colapsa, con contador que decrementa animado.
- Confetti/partículas al completar misión o subir de nivel (canvas propio, ~50 líneas, sin librería).
- Números que cuentan (XP, rachas, totales de finanzas) con animación de conteo.
- Transiciones de hover/press consistentes: `transform: scale(.97)` en press de cualquier botón/card (clase global `.pressable`).
- Sonidos sutiles opcionales (toggle en Config): tick del pomodoro, ding al completar. Web Audio, archivos <10KB.

### 2.2 Sistema visual propio
- **Empty states ilustrados:** cada sección vacía muestra una ilustración propia (estilo línea con el acento del tema) + CTA. Hoy probablemente hay texto plano. Crear `src/app/empty-states.jsx` con SVGs inline parametrizados por `--violet`.
- **Hubby como personaje:** la mascota (hubby-bot.png) debería aparecer más — en empty states, en el tutorial, celebrando logros, en el morning briefing. Generar 4-5 poses (pensando, celebrando, durmiendo, señalando). Eso es identidad que ningún template tiene.
- **Iconografía consistente:** auditar `icons.jsx` — un solo grosor de trazo, un solo estilo. Nada de emojis mezclados con SVG en la UI principal (los emojis quedan para contenido del usuario).
- **Texturas de fondo sutiles:** noise/grain muy leve sobre `--bg` (SVG feTurbulence como background, casi invisible) — mata la sensación de "fondo plano de template".
- **Tipografía display:** usar la font display con más coraje en headers de sección (tamaños grandes, tracking apretado) — estilo editorial que ya insinúa la variante "editorial".

### 2.3 Temas con personalidad
- Además de acentos, **temas completos con nombre**: "Medianoche" (actual), "Papel" (claro cálido tipo libreta), "Terminal" (verde fósforo, mono), "Sakura", "Océano". Cada uno cambia fondo, superficies, acento y font en conjunto. Son combinaciones de las variables CSS que ya existen — bajo esfuerzo, alto impacto percibido.
- Tema automático según hora (claro de día, oscuro de noche) — opcional en Config.

### 2.4 Dashboard que respira
- Saludo contextual grande con la hora/momento ("Buenas noches, Lautaro — última semana antes del parcial de Álgebra") en vez de header genérico.
- El fondo del dashboard cambia sutilmente con el momento del día (gradiente de amanecer/día/atardecer/noche detrás del noise).

---

## FASE 3 — Features que vuelan la cabeza

Ordenadas por relación impacto/esfuerzo. Las primeras cuatro son las que diferencian el producto.

### 3.1 Captura universal + Command Palette (⭐ hacer primero)
Un solo punto de entrada para TODO:
- **Mobile:** botón [+] central de la tab bar → sheet con un input de texto libre.
- **Desktop:** `Ctrl/Cmd+K` → command palette (buscar secciones, tareas, materias, acciones + crear).
- **Parser con IA:** lo que escribas se interpreta — "parcial de física el 20 a las 14" → evento de calendario; "comprar yerba" → ítem de cocina; "tarea: terminar TP de redes para el viernes prioridad alta" → tarea con due date. Usar el proxy `api/chat.js` con un prompt de extracción que devuelva JSON `{type, payload}`; mostrar preview de lo interpretado con botón confirmar. Fallback sin IA: heurísticas (palabras clave + fechas con regex).
- **Share target** (de 1.4) y **bot de Telegram** alimentan el mismo parser → capturás desde cualquier lado y aparece donde corresponde.
**Por qué vuela la cabeza:** convierte la app de "lugar donde organizo" a "cerebro al que le tiro cosas y se organizan solas".

### 3.2 Hubby proactivo: briefing diario + revisión semanal con IA
Ya existe el MorningModal — convertirlo en el momento estrella:
- **Briefing matutino generado por IA:** "Hoy tenés 3 tareas (1 vencida), el parcial de Álgebra en 6 días, ayer estudiaste 2h 15m. Te sugiero arrancar por X porque vence antes." Input: snapshot del estado (tareas, calendario, pomodoros, energía del diario). Una llamada IA, cacheada por día.
- **Revisión semanal (domingo):** resumen de la semana — horas de foco por materia, tareas completadas vs creadas, racha, mood promedio del diario, y 2-3 sugerencias concretas. Compartible como imagen (canvas → PNG) estilo "Spotify Wrapped semanal".
- **Push diario opcional** (de 1.4) con la primera línea del briefing.

### 3.3 Estudio con IA: flashcards + spaced repetition
La feature que justifica que un estudiante PAGUE:
- En cada materia: subir apuntes (texto pegado o PDF — extraer texto client-side con `pdfjs-dist`).
- IA genera **flashcards** (pregunta/respuesta) y **quizzes** del material.
- Repaso con **SM-2** (algoritmo de Anki, ~30 líneas): la app te dice qué repasar cada día; widget "Repasos de hoy: 12" en el dashboard; sesión de repaso con swipe (fácil/difícil/otra vez) — gesto nativo en mobile.
- El calendario sugiere intensificar repasos cuando se acerca un examen.

### 3.4 Time-blocking asistido: "Planificá mi día"
Botón en el dashboard: la IA toma tus tareas pendientes (con prioridades y vencimientos), tus eventos del calendario y tu patrón de energía (del diario/energy_log) y propone bloques en el calendario del día — editables antes de confirmar. Cada bloque se puede arrancar como sesión de pomodoro con un tap.

### 3.5 Estadísticas que enganchan
- **Heatmap anual** estilo GitHub de actividad (pomodoros + tareas completadas).
- Horas de foco por materia (semana/mes), mejor hora del día, racha actual y récord.
- Sección "Stats" nueva o pestaña en Historial. Sin librerías de charts: SVG propio (barras + heatmap son simples y quedan mejor que Chart.js genérico).

### 3.6 Social liviano (motor de crecimiento)
- **Salas de estudio:** compartís un link, los dos corren pomodoro a la vez y se ven en vivo ("Juan está en foco · 18:32 restantes"). Supabase Realtime (presence) ya está en el stack — es ~1 tabla + 1 canal.
- **Ligas semanales** entre amigos por XP (opt-in, código de invitación).
- Compartir el wrapped semanal (3.2) → loop de adquisición orgánico.
*(Marcar como fase tardía si hay poco tiempo — requiere moderación/social features bien pensadas.)*

---

## FASE 4 — Modo Trabajo: StudyHub para profesionales

**Insight de producto:** no crear "otra app". El 80% ya sirve para un profesional — lo que sobra es el naming estudiantil. La jugada es **espacios/personas**.

### 4.1 Arquitectura de personas
- En el onboarding (y en Config): "¿Para qué vas a usar la app?" → **Estudio / Trabajo / Ambos**.
- Una capa de configuración mapea nombres y secciones visibles por persona. Implementar como diccionario en `store.jsx`:

| Concepto interno | Persona Estudio | Persona Trabajo |
|---|---|---|
| `subjects` | Materias | **Proyectos / Clientes** |
| `facultad` | Facultad | **Trabajo** |
| exámenes | Parciales/Finales | **Entregas / Vencimientos** |
| misiones | Misiones XP | Objetivos (gamificación opcional) |
| diario | Diario | Bitácora / Notas del día |

- Las secciones Cocina/Casa/Ocio quedan en "Vida" para ambas personas (ocultables).
- El pizarrón por materia se vuelve pizarrón por proyecto/cliente gratis.

### 4.2 Features específicas del modo trabajo (caso: dueño de empresa, como tu papá)
1. **Clientes/Proyectos** (= materias renombradas) con: estado, notas, archivos, pizarrón, y un **timeline de interacciones** ("llamé al proveedor, quedó en mandar presupuesto") — un CRM ultraliviano. Cada entrada puede generar una tarea de seguimiento ("si no responde en 3 días, recordame").
2. **Delegación:** una tarea puede tener "responsable" (texto libre: nombre del empleado) y estado *esperando respuesta*. Vista "Qué estoy esperando de quién" — esto es ORO para un dueño de pyme y casi ninguna app simple lo tiene.
3. **Modo reunión:** captura rápida durante una reunión → al terminar, la IA separa notas / decisiones / tareas con responsables y fechas. (Reusa el parser de 3.1.)
4. **Finanzas pro:** la sección finanzas con etiquetas por proyecto/cliente, cuentas por cobrar/pagar con vencimientos (alimentan el calendario y los push).
5. **Briefing laboral** (reusa 3.2): "Hoy: reunión 10hs con X, 2 seguimientos vencen (Juan no respondió lo del presupuesto), vence factura de Y."
6. **Semana laboral vs total:** el calendario y stats filtran por persona — el modo trabajo no te muestra el parcial de Álgebra y viceversa, con un switch global Estudio/Trabajo/Todo en el header.

### 4.3 Por qué esto comercializa
- Un solo código, dos mercados (estudiantes pagan poco; profesionales pagan 5-10x).
- Pitch: *"La app que te acompaña de la facultad al trabajo"* — el estudiante que la ama en 3° año la sigue usando cuando se recibe.
- Tu papá es el beta tester perfecto del modo trabajo: entrevistalo 30 min ("¿qué anotás en papelitos? ¿qué se te pierde? ¿qué le perseguís a la gente?") antes de implementar 4.2 y ajustá la lista.

---

## FASE 5 — Comercialización

1. **Pricing freemium:**
   - *Free:* todo lo manual, 1 persona (estudio o trabajo), sin IA o con N usos/mes.
   - *Pro (~USD 3-5/mes estudiantes, precio regional ARS):* IA ilimitada (briefing, flashcards, parser, planificador), ambas personas, push, temas premium, salas de estudio.
   - Cobro: **Mercado Pago** (suscripciones) para Argentina + Lemon Squeezy/Paddle para afuera (merchant of record = sin lío fiscal internacional).
   - Tabla `subscriptions` en Supabase + webhook en Vercel; gatear features por `profile.plan`.
2. **Control de costos de IA:** contador de usos por usuario/mes en Supabase, verificado en `api/chat.js` (server-side, no client). Free: 20 llamadas/mes. Modelo barato (Haiku) para el parser, modelo mejor para briefings.
3. **Landing comercial:** la landing actual es de la app; hacer una página de marketing (puede ser `/` con la app en `/app`): screenshots reales, video de 30s, pricing, testimonios de los primeros usuarios, SEO en español ("app para organizar la facultad").
4. **Legal mínimo:** términos y privacidad (plantilla adaptada), aviso de que los datos van a Supabase (EE.UU./UE), botón "exportar mis datos" (JSON) y "borrar cuenta" — esto último es obligatorio para tiendas y genera confianza.
5. **Distribución:** PWA primero; cuando haya tracción, Capacitor → Play Store (barato, USD 25 una vez) y después App Store. Mientras tanto el mostrador es: TikTok/Reels de "cómo organizo mi semestre" (a estudiantes se les vende ahí), y el wrapped compartible (3.6).
6. **Nombre/marca:** "StudyHub" limita el modo trabajo y está muy usado (hay riesgo de marca). Antes de invertir en marketing, evaluar un rebrand corto y propio (que funcione para estudio y trabajo). No bloquea nada técnico — decisión de negocio.

---

## Orden de ejecución sugerido (sprints para el modelo económico)

| Sprint | Contenido | Resultado visible |
|---|---|---|
| 1 | 0.1 sync granular + 0.2 seguridad + 0.3 higiene | Base sólida (invisible pero crítico) |
| 2 | 1.1 tab bar + 1.2 checklist CSS + 1.3 sheets/transiciones | **El celular ya se siente nativo** |
| 3 | 1.4 PWA pro (push, share target, offline) + 1.5 performance | App instalada de verdad |
| 4 | 3.1 captura universal + command palette | La feature estrella |
| 5 | 2.1 microinteracciones + 2.2 identidad + 2.3 temas | Deja de parecer template |
| 6 | 3.2 briefing IA + 3.5 stats | Retención diaria |
| 7 | 4.1 personas + 4.2 modo trabajo (con feedback de tu papá) | Segundo mercado |
| 8 | 3.3 flashcards + 3.4 planificador | Razón para pagar |
| 9 | 5.x pagos + landing + legal | **Lanzamiento comercial** |
| 10 | 3.6 social + 1.6 Capacitor/tiendas | Crecimiento |

### Reglas para el modelo que ejecute
- Un sprint por sesión; leer este doc + la sección relevante del código antes de tocar nada.
- No agregar dependencias pesadas: nada de UI kits, charts ni animation libs — todo a mano como el resto del código.
- Mantener el estilo existente: CSS variables, español rioplatense en la UI, comentarios estilo bloque `/* ── … ── */`.
- Probar en viewport 390px SIEMPRE (el usuario valida por screenshot mobile).
- Deploy: commit + push → Vercel auto-deploya. No tocar `main` sin build verde (`npm run build`).
