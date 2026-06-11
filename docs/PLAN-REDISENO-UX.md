# PLAN REDISEÑO UX — "Que se sienta viva, simple y propia"
> Creado: 2026-06-10 tras navegar la app en producción (study-hub-theta-one.vercel.app) logueado, todas las secciones.
> Complementa a PLAN-MASTER-NEXT-LEVEL.md. Este doc cubre: bugs observados, reorganización de la app, Hubby como mascota viva, sistema de animaciones, flashcards vía IA externa (con el prompt listo), notificaciones, y portada de inicio para PC.
> Ejecutar con un modelo económico, una parte por sesión. Probar siempre en viewport 390px.

---

## A. BUGS E INCONSISTENCIAS OBSERVADAS EN PRODUCCIÓN

### A1. Las tareas están fragmentadas (el bug más importante) 🔴
- La materia "Arquitectura de Computadoras" tiene 2 tareas pendientes, pero la sección **Tareas dice "0 en total"** y el dashboard dice "0 tareas activas". Las tareas por materia NO cuentan en el sistema global.
- Hay **cinco sistemas de "cosas por hacer" que no se hablan entre sí**: Tareas (global), tareas dentro de cada materia, "Objetivos de hoy" (que es una misión), checklists de Mi Espacio, y tareas de Casa.
**Fix (modelo unificado):** una sola colección `tasks` con campos `{id, title, done, due, subjectId?, context: 'facu'|'personal'|'casa', priority}`. Todas las vistas (Tareas, materia, dashboard, Casa) son FILTROS sobre esa colección. Los contadores del dashboard y de Tareas salen de ahí. Esto resuelve el "despelote de organización" de raíz.

### A2. Racha inconsistente
Header dice "RACHA 1" (chip con fuego) y el subtítulo del dashboard dice "racha 0" al mismo tiempo. Unificar la fuente (un solo selector `getStreak()` usado por ambos).

### A3. Diario — gráfico de sueño roto
- Etiquetas de días mal: aparece "VIE 5" dos veces seguidas (JUE 4, VIE 5, VIE 5, SÁB 6...). Bug en el cálculo de fechas (probablemente off-by-one con `getDay()`/timezone).
- Las barras no se dibujan: noches con "7H" muestran barra vacía; solo la última noche tiene barra. Revisar el cálculo de altura (probablemente divide por un máximo mal calculado).

### A4. "Objetivos de hoy" duplicado conceptualmente
Aparece como widget del dashboard Y como misión de alta prioridad en Misiones con +500 XP. El usuario ve la misma lista en dos lugares con dos nombres. Decidir: es UNA cosa ("Hoy") que vive en el dashboard y suma XP al completarse; en Misiones no se duplica como card editable.

### A5. Detalles menores
- El buscador del header muestra el símbolo ⌘K en Windows → mostrar "Ctrl K" según plataforma.
- "Calendario" en el nav pero el título de la sección dice "Agenda" → unificar nombre.
- Finanzas: "Balance AR$ -2500" en rosa gigante asusta — si no cargaste ingresos, mostrar "Gastaste $2.500 este mes" en vez de un balance negativo.
- Datos de prueba visibles: misión "dadsa", película "dsd" — (del usuario, pero la UI debería invitar a borrar/editar fácil).
- "Actividad de la semana" muestra barras grises fantasma en días sin datos que parecen datos reales — distinguir skeleton vs valor 0 (día sin datos = barra plana mínima, no bloque gris alto).
- La burbuja flotante de feedback (abajo a la derecha) ocupa el mismo lugar que el mini-pomodoro → moverla o fusionarla con Hubby (ver C).

---

## B. PUNTOS NEGATIVOS DE DISEÑO (por qué se ve "predeterminada")

1. **Misma plantilla en cada sección:** título arriba a la izquierda + botón gradiente a la derecha + 3 stat-cards (una violeta degradada, dos grises) + contenido. Al repetirse 10 veces, parece dashboard-template de venta. → Cada sección necesita una identidad: el Pomodoro puede ser un círculo gigante centrado, el Diario una página de libreta, Finanzas una fila de números, etc.
2. **Demasiadas cajas con borde para todo.** Card dentro de card dentro de card. → Quitar contenedores: listas sin recuadro, separadas por espacio; reservar cards para lo destacado.
3. **Etiquetas MAYÚSCULAS MONO por todos lados** ("PRÓXIMO EVENTO", "XP GANADO", "HELADERA · 1 ITEMS"). De a una queda techy; en cada esquina, hace ruido visual. → Bajarlas un 50%: solo en stats clave.
4. **El violeta degradado se usa para todo** (cards de stats, botones, XP, frase del día) → pierde jerarquía: si todo es destacado, nada lo es. Regla: máximo UN elemento con gradiente por pantalla.
5. **Pantallas vacías muertas:** Calendario sin eventos = grilla enorme vacía; Tareas vacía = texto plano. → Empty states con Hubby ilustrado + acción concreta (ver C).
6. **Dashboard con widgets vacíos permanentes:** "Nota rápida", "Galería de fotos", "Hábitos 0/3" — si están vacíos hace días, achicarlos o esconderlos solos (widgets colapsables por uso).
7. **Tipografía sin alma en datos clave:** la hora "21:27" gigante está bien, pero todo lo demás es el mismo gris. → Definir 3 niveles reales de texto y usarlos con disciplina.
8. **Inconsistencia de íconos:** emojis (🍳 recetas, emojis de mood) mezclados con SVG line-icons. → SVG para UI, emojis solo en contenido del usuario.
9. **Nada se mueve.** Cero transiciones entre secciones, los números aparecen secos, completar algo no celebra. La app se siente "muerta" (tu palabra: querés que se sienta viva → sección D).
10. **Sidebar plana de 14 ítems** sin agrupación → sección E.

---

## C. HUBBY VIVO — la mascota que aparece por la app 🐙

Convertir a Hubby de logo estático en **compañero persistente**. Implementar como componente global `src/app/hubby.jsx` montado en `app.jsx` (similar a PomoMini).

### C1. Comportamiento base ("idle pet")
- Hubby vive en una esquina (configurable, default abajo-derecha, reemplaza a la burbuja de feedback — el feedback pasa a ser una opción dentro del menú de Hubby).
- Estados animados (CSS/SVG, sin librerías): **idle** (parpadea, flota suave), **durmiendo** (de noche o tras 5 min sin interacción, con zZz), **celebrando** (salta al completar tarea/misión/pomodoro), **enfocado** (con auriculares durante pomodoro activo), **preocupado** (cuando hay tareas vencidas).
- Click en Hubby → menú radial/popover: "Charlar (Chat IA) · Captura rápida · Feedback · Esconderse".
- **Apariciones contextuales** (esto es lo que vuela la cabeza): asoma desde el borde de la pantalla en momentos clave — se asoma desde abajo cuando terminás un pomodoro, espía desde el costado del calendario si mañana hay examen, aparece sosteniendo un cartelito en cada empty state ("Acá no hay nada todavía… ¿creamos tu primera tarea?"). Cada empty state de cada sección usa una pose de Hubby distinta.
- Frases cortas en un globito (no modal, se desvanece solo): al volver a la app ("¡Volviste!"), racha en peligro ("Tu racha de 3 días muere a medianoche 👀"), 22hs+ ("¿Cerramos el día con el diario?").
- Respeta `prefers-reduced-motion` y el toggle "Animaciones" de Config (ya existe).

### C2. Assets
Generar sprite sheet o SVGs de 6-8 poses de Hubby (basado en `hubby-bot.png` pero vectorizado/simplificado para que pese poco y se pueda animar por partes: cuerpo, ojos, brazos separados en grupos SVG). Mientras no haya assets, prototipar con un círculo con ojos hecho en SVG inline — la lógica de estados es lo importante.

---

## D. SISTEMA DE ANIMACIONES — "que se sienta viva"

Crear `src/styles/motion.css` + helpers en `ui.jsx`. Reglas: 150-300ms, easing `cubic-bezier(.2,.8,.2,1)`, todo desactivable con el toggle existente y `prefers-reduced-motion`.

1. **Transición entre secciones:** View Transitions API — fade + slide 12px. Una línea en `nav()` de app.jsx.
2. **Entrada en cascada:** widgets/cards entran con stagger (50ms entre cada uno, translateY 8px + fade). Clase `.stagger-in` aplicada al contenedor.
3. **Completar tarea:** el check se dibuja (SVG `stroke-dashoffset` animado), el texto se tacha con animación de izquierda a derecha, la fila colapsa a los 600ms. Micro-confetti de 8 partículas desde el checkbox.
4. **Números vivos:** XP, contadores y porcentajes cuentan hacia su valor (hook `useCountUp`). Las barras de progreso crecen al montar, nunca aparecen llenas.
5. **Press feedback universal:** `.pressable { transition: transform .1s } .pressable:active { transform: scale(.96) }` en todo botón/card clickeable.
6. **Pomodoro:** el countdown late sutilmente (scale 1→1.005) por segundo en foco; al terminar, onda expansiva + Hubby celebra.
7. **Level up / misión completa:** overlay breve de partículas (canvas propio ~60 líneas) + número de nivel que rebota.
8. **Hora del dashboard:** los dígitos que cambian hacen flip/slide vertical (como reloj de aeropuerto, CSS puro).
9. **Skeletons con shimmer** mientras llega el sync, en vez de cajas vacías estáticas.
10. **Hover con vida en desktop:** cards levantan 2px con sombra; íconos del sidebar hacen micro-bounce al activarse.

---

## E. REORGANIZACIÓN — sidebar y arquitectura de la información

Hoy: 14 ítems planos. Propuesta: **5 ítems principales + grupo Vida colapsable**.

```
🏠 Hoy            ← dashboard renombrado: lo de HOY (agenda, objetivos, repasos)
🎓 Facultad       ← materias + tareas de facu + calendario académico integrados
✅ Tareas         ← TODAS las tareas (modelo unificado A1) con filtros
⏱ Enfoque        ← pomodoro + sesiones + stats de foco
💬 Hubby          ← chat IA
─────────────
🌱 Vida ▾         ← grupo colapsable: Diario · Cocina · Finanzas · Casa · Ocio
📦 Mi Espacio
⚙️ Configuración  (Salir va dentro de Config/avatar, no como ítem de nav)
```

- **Calendario no desaparece:** vive como pestaña dentro de Facultad ("Cronograma") y como widget en Hoy. Si lo usás mucho, se puede "promover" (sidebar configurable: pin/unpin secciones — Config ya tiene pestaña Dashboard, agregar "Navegación").
- **Misiones se fusiona con Hoy:** los "Objetivos de hoy" + XP viven en el dashboard; las misiones largas van a una pestaña "Metas" dentro de Hoy. Esto elimina la duplicación A4.
- **Historial** ya no está en el nav (bien) — sus stats van a Enfoque.
- Menos ítems = mobile más simple: la tab bar de mobile (PLAN-MASTER 1.1) usa exactamente: Hoy · Facultad · [+] · Tareas · Más.

---

## F. FLASHCARDS CON IA EXTERNA (sin gastar tu API)

### F1. Flujo
1. Nueva pestaña **"Repaso"** dentro de cada materia (y sección global "Repasos de hoy" como widget en Hoy).
2. Botón "Generar con IA" → abre modal con: (a) el prompt listo para copiar (botón "Copiar prompt"), (b) instrucciones: "Pegá este prompt en ChatGPT/Gemini/Claude junto con tus apuntes (texto o PDF adjunto), copiá la respuesta completa y pegala acá abajo", (c) textarea de importación.
3. Al pegar: la app extrae el bloque JSON (buscar entre ```json y ``` o primer `{`…último `}`), valida el schema, muestra preview ("32 flashcards, 2 quizzes — Materia: Arquitectura") y botón Importar.
4. Estudio: modo mazo con tarjetas que se dan vuelta (animación flip 3D CSS), botones "Otra vez / Difícil / Bien / Fácil" → algoritmo **SM-2** (~30 líneas) calcula próxima fecha de repaso. Persistir en clave `sh_decks`.
5. Quiz: multiple choice con feedback inmediato + resultado final con XP.
6. Widget en Hoy: "📚 12 repasos pendientes" → entra directo a la sesión.

### F2. Schema de importación (validar contra esto)
```json
{
  "studyhub_import": "v1",
  "type": "deck",
  "subject": "string — nombre de la materia",
  "topic": "string — tema del mazo",
  "cards": [
    { "q": "pregunta", "a": "respuesta", "hint": "pista opcional o null", "difficulty": 1 }
  ],
  "quiz": [
    { "question": "string", "options": ["a","b","c","d"], "correct": 0, "explanation": "por qué" }
  ]
}
```

### F3. EL PROMPT (texto exacto a incluir en la app con botón Copiar)
```
Sos un generador de material de estudio para la app StudyHub. Voy a darte mis apuntes (texto pegado o archivo adjunto). Tu única salida debe ser UN bloque de código JSON válido, sin texto antes ni después, con exactamente esta estructura:

{
  "studyhub_import": "v1",
  "type": "deck",
  "subject": "<nombre de la materia>",
  "topic": "<tema principal de estos apuntes>",
  "cards": [ { "q": "...", "a": "...", "hint": "... o null", "difficulty": 1 } ],
  "quiz": [ { "question": "...", "options": ["...","...","...","..."], "correct": 0, "explanation": "..." } ]
}

Reglas:
1. Generá entre 20 y 40 flashcards ("cards") que cubran TODO el material, de lo fundamental a lo específico.
2. Las preguntas deben ser atómicas (un concepto por tarjeta), claras y en español rioplatense. Nada de "¿Qué dice el texto sobre X?" — preguntá el concepto directo.
3. "a" debe ser una respuesta completa pero concisa (1-3 oraciones o una fórmula). "hint" es una pista corta que NO revela la respuesta (o null).
4. "difficulty": 1 = definición/concepto básico, 2 = relación entre conceptos/aplicación, 3 = caso límite/detalle fino. Distribuí aprox 40% / 40% / 20%.
5. Incluí tarjetas de los tres tipos: definiciones, comparaciones ("diferencia entre X e Y"), y aplicación ("qué pasa si...", "calculá...", "cuándo conviene...").
6. Si hay fórmulas, escribilas en texto plano legible (ej: "T = 2π·√(L/g)").
7. Generá entre 8 y 12 preguntas de "quiz" multiple choice con exactamente 4 opciones cada una. "correct" es el ÍNDICE (0-3) de la opción correcta. Las opciones incorrectas deben ser errores plausibles (confusiones típicas), no opciones absurdas. "explanation" explica en una oración por qué la correcta es correcta.
8. Mezclá la posición de la respuesta correcta (que no sea siempre la 0).
9. No inventes contenido que no esté en mis apuntes. Si el material es poco, generá menos tarjetas pero nunca rellenes con cosas externas.
10. Verificá antes de responder que el JSON sea sintácticamente válido (comillas escapadas, sin comas finales).

Mis apuntes:
[PEGÁ TUS APUNTES ACÁ O ADJUNTÁ EL ARCHIVO]
```

### F4. Detalles de implementación
- Parser tolerante: aceptar JSON con o sin fences, con texto alrededor; si falla el parse, mostrar el error puntual ("línea X: coma final") y no perder lo pegado.
- Permitir también **crear/editar tarjetas a mano** y borrar las que vinieron mal.
- Varios mazos por materia (uno por tema). Merge: importar al mismo topic agrega tarjetas, no duplica (hash de `q`).

---

## G. NOTIFICACIONES (misiones, tareas, recordatorios)

### G1. Capa 1 — Notificaciones locales (rápido, sin backend)
Funcionan con la app abierta o en segundo plano con la PWA instalada (desktop sí; en mobile depende del SO):
- Pedir permiso desde Config > Notificaciones (nunca al entrar — solo cuando el usuario activa el toggle).
- Scheduler en el cliente: al cargar la app y cada minuto, revisar `sh_reminders` (tareas con due hoy, eventos con hora, fin de pomodoro, racha a medianoche) y disparar `new Notification(...)` vía service worker (`registration.showNotification`) con ícono de Hubby.
- UI: en cada tarea/evento/misión, campo "Recordarme: [al vencer | 1h antes | 1 día antes | personalizado]".
- Centro de notificaciones in-app: la campanita del header (hoy decorativa) lista las notificaciones recientes + pendientes de hoy.

### G2. Capa 2 — Push real (app cerrada) — requiere lo del PLAN-MASTER 1.4
Web Push con VAPID + edge function de Supabase con cron que consulta vencimientos y empuja. Tabla `push_subscriptions (user_id, endpoint, keys, prefs)`. Preferencias por tipo (tareas/eventos/misiones/racha/briefing) en Config. En iOS requiere PWA instalada — detectar y mostrar guía de instalación.
- El bot de Telegram ya existente es la **capa 3 gratis**: ofrecer "recordatorios por Telegram" como alternativa (la edge function manda mensaje en vez de push) — cero infraestructura nueva.

---

## H. PORTADA DE INICIO PARA PC ("abrir la compu y que esté ahí, fachera")

Objetivo: que al arrancar la PC se abra StudyHub a pantalla con una portada que reacciona al mouse, y de ahí entrás a la app.

### H1. La portada (`src/app/cover.jsx`)
- Pantalla completa pre-dashboard (solo desktop, solo si `?cover=1` o setting "Mostrar portada al abrir" activo en Config).
- Contenido: hora gigante tipo flip-clock, fecha, saludo, frase del día, y 2-3 datos vivos (próximo evento, tareas de hoy, racha). Hubby flotando que **sigue el mouse con la mirada**.
- **Parallax al mouse:** 3-4 capas (blobs de gradiente difusos como los de la landing, partículas tenues, el contenido central) que se desplazan a distinta velocidad según la posición del cursor (`transform: translate3d` con lerp suave, ~30 líneas). Sutil: máximo 20px de desplazamiento.
- Click en cualquier lado o Enter → transición (la portada se desliza hacia arriba, View Transition) y entra al dashboard.
- Reusar los blobs CSS de `landing.jsx` — ya existen.

### H2. Que se abra sola al prender la PC (instrucciones para el usuario, documentar en Config > Acerca de)
- Instalar StudyHub como PWA desde Chrome/Edge (ícono de instalar en la barra de URL).
- `Win+R` → `shell:startup` → crear acceso directo a la PWA instalada (está en el menú inicio como app) dentro de esa carpeta. Listo: arranca con Windows, en su propia ventana sin barra de navegador, mostrando la portada.

---

## I. PASE DE SIMPLICIDAD (minimalista pero funcional)

- **Regla de un vistazo:** cada pantalla responde UNA pregunta ("¿qué hago hoy?", "¿cómo voy en esta materia?"). Todo lo que no responda esa pregunta se va a un segundo nivel (pestaña, "ver más").
- Dashboard default: máximo 6 widgets (Hoy/agenda, objetivos, próximo evento, repasos, racha+XP, frase). El resto disponible en modo edición pero no default. (Toca B3 de memoria: widgets default.)
- Onboarding define el set inicial según persona.
- Auditar cada sección y quitar: stat-cards triples donde un solo número alcanza, subtítulos redundantes ("Estación de foco", "Todo se guarda en la nube automáticamente" → un ícono de nube en el header basta), bordes y fondos anidados.
- Densidad: subir el aire (padding) y bajar la cantidad. Menos, más grande, más claro.

---

## ORDEN SUGERIDO DE EJECUCIÓN (continúa los sprints del PLAN-MASTER)

| # | Qué | Por qué primero |
|---|---|---|
| R1 | A1 modelo unificado de tareas + A2/A3/A4 bugs | Sin esto, todo lo visual maquilla un sistema roto |
| R2 | E reorganización sidebar + I simplicidad | La estructura nueva define dónde va lo demás |
| R3 | D animaciones (1-5 primero) | Máximo impacto percibido por esfuerzo |
| R4 | C Hubby vivo (estados base + empty states) | Identidad única |
| R5 | F flashcards con prompt externo | Feature estrella sin costo de API |
| R6 | G1 notificaciones locales + campanita | Utilidad diaria |
| R7 | H portada PC | El moño |
| R8 | G2 push real | Cuando haya tiempo de backend |
