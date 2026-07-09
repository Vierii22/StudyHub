# PLAN MAESTRO — Rediseño cálido de StudyHub (ejecución)

_Creado: 2026-07-08 · Para ejecutar fase por fase con Claude Code._
_Leer SIEMPRE antes: `C:\claude\studyhubv2\DESIGN.md` (decisiones de diseño confirmadas, es LA fuente de verdad visual) y `C:\claude\studyhubv2\CLAUDE.md`._

## Contexto en 30 segundos
- Repo local: `C:\claude\studyhub-app` (clonado de `github.com/Vierii22/StudyHub`). Stack: **Vite + React 18 + Supabase**. Corre con `npm run dev` → `localhost:5173`.
- `.env` ya creado con `VITE_SUPABASE_URL` + `VITE_SUPABASE_KEY` (publishable `sb_publishable_...`). Login verificado OK con la cuenta del usuario (sharkudo84@gmail.com).
- **Estrategia acordada:** conservar INTACTO el motor (`src/supabase.js`, `src/storage.js`, `src/app/store.jsx`, `src/app/syncEngine.js`, auth en `app.jsx`) y **rehacer de cero cada pantalla** con el diseño cálido. NO rehacer el motor.
- El usuario valida por screenshot. **NUNCA pushear a main sin que lo pida** ("subilo" / "pushea"). Vercel auto-deploya main.
- Único elemento viejo que pidió conservar: el **FeedbackWidget** (botón bugs/sugerencias abajo a la derecha).

## Estado: HECHO ✅ (verificado en vivo)
1. **Tokens**: paleta "Piedra & naranja quemado" en `:root` y en `[data-theme="medianoche"]` de `index.html` (el tema se sigue llamando "medianoche" porque app.jsx lo setea por default; ahora es cálido). Aliases nuevos: `--stone --card --field --off --ink --ink-2 --org --org-2 --org-deep --green --green-bg --mut --soft`. Las vars viejas `--violet*` AHORA SON NARANJA (truco de compatibilidad: todo lo viejo que usaba violeta se volvió naranja solo).
2. **Top nav** (`ui.jsx` → `Header` + CSS `.topbar/.tb-*`): logo temp (tile marrón + punto naranja — comentario `/* LOGO: cambiar acá */`) + wordmark `studyhub.` + ítems **Hoy · Calendario · Facultad · Notas · Pelis** + búsqueda + avatar. Sidebar eliminado del render de `app.jsx` (el componente `Sidebar` sigue exportado en ui.jsx, ya sin uso → borrar en Fase 6).
3. **Saludo** del dashboard sin serif itálica (`.hoy-saludo` → Outfit 700, nombre en naranja).
4. **Secciones borradas de la app** (rutas + imports en `app.jsx`): pomodoro, misiones, diario, historial, cocina, recetas, finanzas, casa, mi espacio, PomoMini flotante, MorningModal. Los archivos fuente TODAVÍA EXISTEN (borrado físico en Fase 6). Quedan rutas: dashboard, facultad (+SubjectView), tareas, calendario, chat, ocio, notas (stub), config.
5. **Mis materias** (`facultad.jsx`): grid editorial según mockup — `nº índice mono naranja + puntito color + nombre grande + tag "cursando" + próximo evento + tarjeta punteada "Nueva materia"`. CSS: `.subj-ed`, `.subj-new`.
6. **Interior de materia** (`facultad2.jsx`): REESCRITO ENTERO según mockup v5 — header (← Mis materias · nº · cursando + nombre grande + botón **Aula virtual estilo B** `.btnB-aula` + Editar `.btn-soft`), fila 1: **Qué tengo que hacer** (lists.tareas) + **Anotaciones** (lists.notas), fila 2: **Temario del parcial** (lists.temas con `resumido`/`estudiado` toggles `.ms` + contador de repasos `.rep` − ↻ +, puntito de estado gris→naranja→ink→verde, botón "Planificar la semana" = stub con toast), fila 3: **Parciales y TPs** (lists.fechas + lists.tps) + **Archivos en 3 carpetas** Material/Resúmenes/Clases (usa `f.folder` en cada archivo; default "material"). Chau modo pizarrón/CanvaBoard/paneles de widgets.
7. **FASE 1 — Dashboard "Hoy"** (`dashboard2.jsx`): reescrito de cero, layout fijo (sin modo edición ni widgets configurables). Hero + `CaptureBar` (IA) + menú de **5 íconos táctiles** (Hoy/Calendario/Facultad/Notas/Pelis — `.hoy-menu`/`.hoy-menu-btn` en `index.html`, activo relleno oscuro con punto naranja) + `CoachCard` + `TodayTimeline`. Se sacó XP/nivel/racha, `EditDrawer`, variantes editorial/grid/focus y el `HubbyBanner`. **Decisión sin confirmar del usuario:** se usaron 5 íconos, no 6 (DESIGN.md menciona un 6º "Progreso" pero no hay ruta propia todavía — mapea a `notas` cuando esa pantalla creciera). Commit `c5b0e86`.
8. **FASE 2 — Notas del cuatrimestre** (`notas.jsx` nuevo, reemplaza `NotasStub` de `app.jsx`): esquema de evaluación configurable por materia (`subject.eval`: parciales 1-3, coloquio, final, promoción con 3 modos + umbral, promedio on/off) y notas (`subject.grades`), estado derivado (`deriveEstado` en `store.jsx`: cursando/regular/recuperar/aprobada/promocionada), badge de promedio, marca manual de promoción siempre disponible (`subject.promoManual`). Animaciones de festejo con CSS puro (`.cele-*` en `index.html`): sello "PROMOCIONADA" + confetti + Hubby al promocionar; tilde verde dibujado + Hubby al aprobar (sobria). Migración de backfill en `applyMigrations` para materias existentes. Commit `9eb9bae`.
   - **Nota técnica observada:** en pruebas con ediciones muy rápidas/consecutivas se vio una materia perder sus notas tras reload — parece una carrera del sync engine existente (pull de Supabase pisando un write reciente), no relacionado al código nuevo. No se tocó el motor. Si se repite con uso normal, investigar `syncEngine.js`.
9. **FASE 3 — Calendario** (`calendario.jsx` nuevo, reemplaza el `Calendario`/`EventModal` de `sections.jsx` — ese archivo ahora solo exporta Misiones + helpers de fecha/.ics reutilizados). Vistas **Semana/Mes/Año** con selector `Seg`: Semana = columnas Lun-Dom sin paneles, evento con hora mono (naranja si es "estudiar"), chip marrón con ícono de libro para clases, banderita para entregas, punto+nombre de materia; Mes = tira de color arriba (parcial=naranja, entrega=marrón), hoy=círculo naranja lleno, "+N más"; Año = 12 mini-meses 4×3 con sólo parcial/entrega/hoy marcados, cada mes clickeable abre esa vista Mes. Se extendió el modelo de evento (`store.jsx` migración): `event.kind` (evento|clase|estudio|parcial|entrega, inferido por regex del título para datos viejos), `event.time` (HH:MM), `event.subjectId` (opcional). El `EventModal` nuevo permite elegir tipo/hora/materia.
   - **Pendiente real (no bloquea esta fase):** todavía no hay fuente automática de eventos "clase" (falta `subject.schedule` — Fase 4) ni "Estudiar · materia" (falta el planificador — Fase 5); por ahora todos los eventos son manuales o importados por .ics. Cuando existan esos datos, empujar eventos con el `kind` correspondiente y aparecen solos en las 3 vistas.
   - Responsive de las 3 vistas (grillas de 7/4 columnas en mobile) queda para la FASE FINAL de QA, como ya preveía el plan.

## Cosas técnicas que YA se saben (no re-descubrir)
- **HMR/preview**: el navegador de preview a veces pierde el websocket de Vite y muestra código viejo o screenshots que timeoutean → reiniciar preview o `location.reload()`. Errores "PomoMini is not defined" en consola = caché viejo, no código actual.
- **Service worker**: `index.html` registra `public/sw.js` (cache `studyhub-v3-redesign`) INCLUSO en dev → puede servir stale. En Fase 6: bump a `studyhub-v4-calido` y NO registrar SW cuando `import.meta.env.DEV`.
- Warning inofensivo: `icons.jsx` tiene key duplicada `home` → limpiar de paso.
- `index.html` aún carga fuentes que sobran: **Instrument Serif** y **Space Grotesk** → quitar del `<link>` (queda Outfit + JetBrains Mono).
- `COLORS` en `store.jsx` = swatches viejos (violeta/cian/etc). **Cambiar a la paleta cálida aprobada**: `#D9551F #C68A2E #7E8A4F #5F7470 #9C4A2E #A98A5C`. Materias existentes conservan su color guardado (no migrar a la fuerza).
- El blob `sh_data` en Supabase tiene campos de secciones borradas (kitchen, finance, home, journal, missions, pomoLog...). **NO tocar el SEED ni borrar campos** — compatibilidad con datos en la nube y el bot de Telegram. Solo dejar de usarlos en UI.
- Git: el trabajo está en la rama **`rediseno-calido`** (verificado 2026-07-08), con `index.html, app.jsx, facultad.jsx, facultad2.jsx, ui.jsx` modificados y **SIN commitear**. Primer paso de la próxima sesión: pedirle al usuario OK y commitear el progreso en esa rama. Nunca push a main sin permiso explícito.

---

# FASES PENDIENTES (en orden recomendado)

## FASE 1 — Dashboard "Hoy" (rehacer `dashboard2.jsx` de cero)
Según mockup confirmado (DESIGN.md pantalla 1):
- Arriba: saludo (ya está) + **barra del anotador con IA** (input grande "Escribí cualquier cosa y se organiza sola…" — la lógica IA ya existe conectada a Gemini vía `/api/chat`; conservar el handler actual del capture).
- **Fila de 5-6 botones-ícono táctiles** (Hoy · Calendario · Facultad · Notas · Pelis) estilo "Hello Josh": redondeados, con relieve (`box-shadow: 0 2px 0` + hover levanta), el activo relleno oscuro con puntito naranja. Navegan con `onNav`.
- Tarjeta clara **"¿y ahora qué?"** (ya existe el motor coach en `coach.jsx` — conservar lógica, re-vestir).
- Tarjeta **"Hoy"** con tareas del día + eventos.
- **Sacar**: stats de XP/nivel/racha gamificadas (XP TOTAL, nv1, etc.), widgets configurables/spans/drag, variante editorial/grid/focus. El dashboard queda FIJO y minimalista. `dashboard.jsx` (viejo) muere en Fase 6; mover `greetingTime` a donde haga falta.
- Criterio de aceptación: sin `SmartList` en el dashboard; nada violeta; aire; botones táctiles con relieve.

## FASE 2 — Notas del cuatrimestre (sección NUEVA, `notas.jsx`)
Reemplaza el stub `NotasStub` de app.jsx. Según DESIGN.md punto 8:
- **Modelo de datos** (agregar por materia, NO romper lo existente): `subject.eval = { parciales: 2, coloquio: false, final: true, promo: { on: true, mode: 'promedio'|'parciales'|'manual', threshold: 7 }, promedioOn: true }` y `subject.grades = { p1, p2, p3, coloquio, final }` + `subject.promoManual: bool` + `subject.estado` derivado (`cursando | regular | recuperar | aprobada | promocionada`).
- Tarjeta por materia: recorrido según SU esquema (lo no configurado NO aparece), notas editables inline, promedio (badge verde si aprobó/promocionó), estado con colores (verde aprobada/promo, naranja en curso/recuperar). Mini-resumen arriba (X promo · X aprobadas · X en curso). ⚙️ abre modal de esquema (parciales 1/2/3, coloquio on/off, final on/off, promoción con 3 modos + umbral, promedio on/off). SIEMPRE se puede marcar/desmarcar promoción a mano.
- **ANIMACIONES (prioridad alta del usuario)**: al guardar nota que aprueba → animación "Aprobada" (sobria: tilde verde que se dibuja + Hubby contento + chispas). Al promocionar → festejo grande (confeti paleta cálida + sello "PROMOCIONADA · promedio" que estampa con pop + Hubby brazos arriba). Implementar con CSS keyframes (ya diseñadas en mockups; portar) o `canvas-confetti`. Hubby: usar `public/assets/hubby-*.png` cuando el usuario los suba; mientras tanto placeholder `hubby-bot.png` existente.

## FASE 3 — Calendario (rehacer `Calendario` de `sections.jsx` → `calendario.jsx` nuevo)
Según DESIGN.md punto 6 (vistas CONFIRMADAS):
- **Semana**: columnas por día Lun–Dom, fondo limpio SIN paneles. Evento = horario (mono, naranja si es estudio), título principal = el tema/asunto, materia en gris con puntito del color de la materia. Clases en crema con chip marrón oscuro + ícono escuela. Entrega con banderita naranja. Contraste por DETALLES (números de día en marrón, barrita naranja bajo el título, puntito en pestaña activa). PROHIBIDO: bloques negros, paneles por columna, franjas mañana/tarde/noche como grilla.
- **Mes**: celdas con tira de color arriba (parcial=naranja, entrega=marrón), hoy=círculo naranja lleno, items chiquitos con puntito (clase gris-marrón, estudiar naranja), "+N más" si desborda.
- **Año**: 12 meses en 4×3, solo parciales (círculo naranja), entregas (círculo marrón) y hoy (aro). **Cada mes clickeable** → abre ese mes.
- **Fuentes de eventos**: eventos manuales existentes (`data.events`) + derivados: clases desde horarios de materias (Fase 4), bloques "Estudiar · materia" desde el planificador (Fase 5), parciales/entregas desde `lists.fechas`/`tps` con fecha. Mantener import/export .ics existente (parseICS/exportToICS).

## FASE 4 — Formulario "Nueva materia" (rehacer `SubjectModal` en `facultad.jsx`)
Según DESIGN.md punto 7: una hoja, campos caja cálida `#F1EAD9` texto marrón suave — **REGLA DURA: nada oscuro sobre lo editable**. Secciones con chip de ícono naranja: Datos (nombre con borde naranja activo, año, estado cursando/terminada, color de paleta cálida SIN violeta), **Horarios por día** (`subject.schedule = [{day:'lun', from:'18:00', to:'22:00'}, ...]` — distintos horarios por día, agregar/quitar filas), comisión, aula virtual (link), **Temario** inicial (carga de temas con orden). SIN campo aula física, SIN foto de portada, índice automático. Botones: **Crear = estilo C** (claro con chip naranja `+`), Cancelar claro. Borrar `TemplatePicker` (plantillas exactas/prog/human) y `ProfsEditor` si no se usa (profesores opcional: decidir con el usuario o dejar campo simple).

## FASE 5 — Estudio: detalle de tema + planificador semanal (NUEVO)
- **Detalle de tema** (DESIGN.md punto 4): al clickear un tema del temario → vista propia: estado + repasos arriba, **"Mi explicación"** (textarea persistente `tema.explicacion`), **Videos/links** (`tema.videos[]`) y **Material** (`tema.files[]`, mismos helpers de SubjectFiles). Datos: extender items de `lists.temas`.
- **Planificador semanal por materia** (DESIGN.md punto 5): página con "Temas sin ubicar" (SOLO de esa materia) + grilla días Lun–Dom (columnas) × franjas Mañana/Tarde/Noche (filas), varios temas por celda, **drag & drop** (nativo HTML5 drag o dnd-kit si hace falta). Datos: `subject.studyPlan = [{temaId, date:'YYYY-MM-DD', franja:'m'|'t'|'n'}]`.
- **Sync SÍ o SÍ**: los bloques del planificador aparecen en el calendario general como "Estudiar · [materia]" y clickearlos vuelve al planificador de esa materia.

## FASE 6 — Limpieza física + shell final
- **Borrar archivos**: `board.jsx`, `space.jsx`, `space-table.jsx`, `dashboard.jsx` (tras mover lo que use dashboard2), `tutorial.jsx` (+ quitar `Tutorial`/`TUTORIAL_KEY`/`showTutorial` de app.jsx y el botón "Ver tour" en config), y de `sections*.jsx` todo lo que no sea Calendario/ChatIA/Ocio (mejor: extraer a `calendario.jsx`, `chat.jsx`, `ocio.jsx` y borrar `sections.jsx/2/3`).
- **ui.jsx**: borrar `Sidebar`, `NAV*`, `AppearanceControl`, `TerminalCorners`/`tcorners`, `BrandBanner`, `HubbyIcon` SVG viejo (lo reemplazan los PNG), `FONT_OPTS/ACCENT_OPTS/VARIANT_OPTS`.
- **config.jsx**: sacar temas con nombre (carbon/papel/terminal/sakura/oceano), acentos, variantes, tipografías conmutables — queda UN tema. Conservar: perfil, contraseña, Telegram/integraciones, borrar datos, PWA install.
- **palette.jsx** (Ctrl+K): actualizar destinos a las secciones vivas.
- **tabbar.jsx** (mobile): ítems = Hoy · Calendario · Facultad · Notas · Pelis.
- **index.html**: purgar CSS muerto (sidebar, ambient glow violeta, tcorners, temas viejos, searchbar vieja) — cuidado: hacerlo AL FINAL para no romper pantallas aún no migradas. Quitar fuentes Instrument Serif/Space Grotesk. `theme-color` → `#E6DFD3`.
- **sw.js**: cache `studyhub-v4-calido`; registrar solo en producción.
- **help-content.js** (APP_GUIDE del bot/chat): reescribir describiendo la app NUEVA (sin cocina/finanzas/etc.). Redeploy del edge function de Telegram lo hace el usuario a mano.
- `landing.jsx` viejo (blobs violeta): reemplazar — ver Fase 7.

## FASE 7 — Landing + Login + Onboarding (rediseño aprobado)
- **Login**: mockup APROBADO — fondo piedra con **orbes cálidos con parallax al mouse** + tarjeta crema que se inclina apenas (los estilos están en el historial del chat/mockup `login_mockup`); campos cálidos, botón "Entrar" estilo C con chip naranja, link registro. Logo provisional (tile S) con comentario `/* LOGO: cambiar acá */`.
- **Landing**: misma onda (piedra + naranja, wordmark studyhub., frase, botón Comenzar táctil, Hubby saludando cuando haya PNG).
- **Onboarding**: re-vestir los 4 pasos (perfil, ocupación, detalles, Telegram/Hubby) con campos cálidos; evaluar simplificar (rol "secundaria" ya no se usa en Facultad).
- **ConfirmEmail**: re-vestir.

## FASE 8 — Ocio (rehacer `Ocio` de `sections3.jsx` → `ocio.jsx`)
Según DESIGN.md punto 9: sección "Ocio" con pestañas **Pelis / Series / Juegos** + filtro por estado. Puntaje numérico ★N/10. Pelis/series: quiero ver · viendo (barra %) · visto. **Juegos = LO MÁS IMPORTANTE**: a jugar · jugando · terminado, horas, y detalle con **"Mis anotaciones"** (diario fechado con tag Jugando/Al terminar). Datos: revisar shape actual de `data.ocio` y migrar suave a `{pelis:[], series:[], juegos:[]}` con `{id,title,year,platform,status,rating,progress,hours,cover,notes:[{date,tag,text}]}`.
- **Carátulas por API** (aprobado): TMDB para pelis/series, RAWG para juegos. Necesita API keys → proxy serverless en `/api/` (como api/chat.js) para no exponerlas. PEDIR al usuario crear las cuentas/keys. Hasta entonces: placeholder de color cálido.

## FASE 9 — Hubby + animaciones + logo
- Usuario genera los **PNG transparentes** de Hubby (una imagen por expresión, ~512px): `hubby-saluda hubby-festejo hubby-pensando hubby-vamos hubby-duerme hubby-idea ...` en `public/assets/hubby/`. Diseño confirmado: robotito crema, cara-pantalla negra con ojos/sonrisa naranja glow, antenitas, auriculares naranja, buzo negro con S naranja (imagen de referencia ya aprobada).
- Integrar: dashboard (saludo/coach), empty states (reemplaza `HubbyIcon`), animaciones de Notas, chat.
- **Lenguaje de movimiento** (afinar en vivo): botones se levantan hover / hunden click; cards aparecen con fade+rise; check de tarea con pop; transiciones de sección (ya hay View Transitions — mantener); idle de Hubby flotando.
- **Logo**: pendiente de que el usuario lo genere (brief ya entregado: S transformada en marca, naranja, ver DESIGN.md sección Logo). Al llegar: reemplazar `public/assets/icon*.png logo*.png` + favicon + manifest + los 2 puntos `/* LOGO: cambiar acá */` (Header y Login).

## FASE 10 — Correlatividades (BETA, al final)
DESIGN.md punto en "Pendientes": lienzo único **zoomeable** (sin ventanas por año) con transición fluida: alejado = 5 años; zoom = cuatrimestres + anuales + materias. `react-zoom-pan-pinch` + SVG. Correlativas fuerte=llena / débil=punteada. Config por materia: para CURSAR vs para RENDIR FINAL, cada una Regularizada|Final aprobado. **Lo único que DEBE andar perfecto: el cálculo "¿puedo cursarla?"** con motivo. Datos: `data.plan = { years:[...], subjects:[{id, name, year, semester|anual, correlativas:{cursar:[{id, req:'regular'|'final', tipo:'fuerte'|'debil'}], final:[...]}, estado}] }`, vinculable a materias reales.

## FASE FINAL — QA + deploy
1. Pasada responsive completa (mobile ≤768: tabbar, grids a 1 columna, topbar compacta).
2. Probar TODO logueado: crear materia con horarios, temario, notas+animación, planificador→calendario, ocio, chat IA, bot Telegram (sigue escribiendo en sh_data — verificar que lo que escribe cae en secciones vivas).
3. `npm run build` sin errores. Lighthouse rápido.
4. Commit prolijo en la rama → mostrar al usuario → SOLO con su OK explícito: merge/push a main (Vercel deploya).

## Reglas de oro (violarlas = "mal" del usuario)
- NADA violeta, NADA negro frío, NADA serif itálica, NADA gradientes exagerados, NADA apretado. El oscuro siempre es marrón cálido (#3A332B / #201B16).
- Naranja = chispas chiquitas repartidas; el calor viene del CONTRASTE.
- NADA oscuro sobre campos editables (inputs siempre caja cálida beige).
- Botones táctiles con relieve (sombra escalón). Aula virtual = estilo B (marrón + ícono naranja). Crear = estilo C (claro + chip naranja).
- Menú arriba. Sin sidebar. Mockups del chat = layout; el pulido fino se hace acá en código.
- El usuario valida por screenshot; mostrarle antes de dar por cerrada cada fase. No preguntarle de más: ejecutar y mostrar.
