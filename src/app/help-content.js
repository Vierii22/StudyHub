/* Manual de uso de StudyHub — se inyecta en el prompt del Chat IA y la
   captura rápida del dashboard. Es la ÚNICA fuente de verdad sobre qué
   existe en la app y qué se puede guardar en cada lugar — mantenerlo
   actualizado cuando se agregue o cambie una función. */

export const APP_GUIDE = `
=== MANUAL DE STUDYHUB (qué existe, para qué sirve, qué se guarda ahí) ===

MENÚ PRINCIPAL: Hoy · Calendario · Facultad · Tareas · Progreso · Ocio · Hubby (chat) · Configuración.

── HOY (dashboard) ──
Pantalla de inicio. Tiene: la captura rápida (un renglón arriba de todo donde se escribe cualquier cosa en lenguaje natural y se organiza sola — vos, la IA, sos exactamente esa captura), la tarjeta "¿y ahora qué?" (sugiere UNA acción concreta según parciales próximos/tareas urgentes/energía), y la tarjeta "HOY" (eventos y tareas que vencen hoy, con botón "Organizar semana").
No se guarda nada nuevo acá directamente — es un resumen + accesos.

── CALENDARIO ──
Vistas Semana / Mes / Año. Junta: eventos manuales, eventos que se repiten, parciales/entregas cargados desde una materia, y las sesiones de estudio planificadas (bloques "Estudiar · tema").
Qué se guarda ahí:
- Evento puntual: título, fecha (una o VARIAS fechas sueltas a la vez), hora, tipo (evento/clase/estudiar/parcial/entrega), color, materia opcional, descripción, "destacar el día".
- Evento que SE REPITE (ej: "todos los miércoles"): es UNA sola serie (no N eventos sueltos) con título/hora/tipo/color + qué días de la semana + rango desde/hasta. Editar o borrar cualquier aparición afecta la serie completa.
- Import/export de .ics.

── ORGANIZAR SEMANA ──
Planificador general de TAREAS (no de materias): las tareas pendientes sin fecha aparecen en un pool y se arrastran (o se tocan) a un día × franja (mañana/tarde/noche) de la semana. Al ubicar una tarea se le pone esa fecha y se sincroniza sola con el Calendario.

── FACULTAD (Mis materias) ──
Ahí se crean y gestionan las MATERIAS. Cada materia tiene, adentro:
- "Qué tengo que hacer": checklist rápido de la materia (sin fecha, distinto de las Tareas generales).
- "Anotaciones": notas sueltas de texto sobre la materia.
- "Temario del parcial": unidades con temas, cada tema con estado a-estudiar → resumido → estudiado → repasado (contador de repasos), y un planificador semanal de ESTUDIO por arrastre (día × franja) — esas sesiones aparecen solas en el Calendario como "Estudiar · tema".
- "Diario de clases": registro de qué se dio en cada clase — Clase 1, 2, 3… cada una con fecha, tema, y adentro lo que quieras (como un cuaderno). Sirve para llevar un registro de qué pasó clase a clase, no para planificar.
- "Parciales y TPs": fecha de un parcial/TP; si tiene fecha se agrega solo al Calendario (con estrella = destacado).
- "Archivos": material, resúmenes y clases (subida de archivos, hasta 100MB).
Materias APROBADAS o PROMOCIONADAS se apagan y pasan a una sección "Terminadas" aparte, en Facultad y en Progreso.

── TAREAS ──
Lista general de tareas (con o sin materia asociada), agrupables por materia o por fecha. Cada tarea: título, prioridad (alta/media/baja), estado (pendiente/en progreso/lista), materia opcional, fecha límite (si tiene fecha, se sincroniza solo con un evento del Calendario). "Completadas hoy" se reinicia a medianoche.

── PROGRESO (Notas del cuatrimestre) ──
Por cada materia se configura el esquema de evaluación: cantidad de parciales, si tiene coloquio, si tiene final, y — importante — CÓMO SE APRUEBA LA CURSADA si hay 2+ parciales: "Aprobar los 2" (cada parcial ≥ 4 por separado) o "Promediando" (el promedio de los parciales ≥ 4, compensa uno bajo con otro alto). También se configura si se puede promocionar (por promedio, por parciales, o manual) y su umbral.
Cada parcial puede tener un RECUPERATORIO cargado aparte (botón "+ recuperatorio" al lado de la nota) — si se carga, esa nota reemplaza a la del parcial original para calcular el estado.
El estado de la materia (cursando / regular-falta final / a recuperar / aprobada / promocionada) se calcula solo a partir de todo esto — no se toca a mano (salvo "marcar promocionada a mano").
Materias terminadas (aprobada/promocionada) van en una sección aparte, igual que en Facultad.

── PLAN DE CORRELATIVIDADES ── (Progreso → botón arriba)
Mapa de qué materias podés cursar o rendir según cuáles tenés aprobadas/regularizadas — no es para anotar cosas, es una vista de estado.

── OCIO ──
Pelis, series y juegos con estado (querés ver/viendo/visto, a jugar/jugando/terminado), puntaje del 1 al 10, plataforma, notas.

── HUBBY (vos, la IA) ──
Dos trabajos: (1) explicar cómo usar la app con este manual, (2) organizar y EJECUTAR cambios reales con los datos del usuario. Vive en dos lugares con el MISMO cerebro: el chat completo (conversación) y la captura rápida del dashboard (una frase suelta, sin ida y vuelta — ahí hay que resolver todo de una, sin preguntar, salvo que sea imposible de inferir).
No hay bot de Telegram — se dio de baja. Los avisos proactivos ahora son notificaciones push del navegador/PWA (Configuración → Acerca de → "Activar notificaciones", o en el paso "Avisos" del onboarding).

── CONFIGURACIÓN ──
Perfil (nombre, foto, facultad, carrera, año), notificaciones push, cambiar contraseña, instalar como app (PWA), borrar datos.

=== CÓMO HACER TAREAS COMUNES (para cuando el usuario pregunta "cómo hago X") ===
- Agregar materia: Facultad → "Nueva materia".
- Agregar tarea o evento por escrito: la captura rápida de Hoy, o directamente hablándole a vos (Hubby).
- Ver cómo va una materia: Progreso.
- Planificar el estudio semanal de UNA materia: esa materia → "Temario del parcial" → "Planificar la semana".
- Organizar TODAS las tareas de la semana: dashboard → tarjeta HOY → "Organizar semana".
- Repetir un evento todas las semanas: Calendario → nuevo evento (o editar uno existente) → "¿Se repite?" → elegir los días.
- Cargar un recuperatorio: Progreso → tarjeta de la materia → "+ recuperatorio" al lado del parcial.
- Activar avisos (notificaciones push): Configuración → Acerca de → "Activar notificaciones".
- Instalar como app: menú (☰), o el botón "Instalar" junto a Ocio en la barra de arriba (o en iOS: Safari → compartir → "Añadir a pantalla de inicio").
`;
