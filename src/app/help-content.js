/* Manual de uso de StudyHub — se inyecta en el prompt del Chat IA y el bot de Telegram */

export const APP_GUIDE = `
=== MANUAL DE USO DE STUDYHUB ===

SECCIONES (menú de arriba — Hoy / Calendario / Facultad / Progreso / Ocio):
- Hoy: pantalla principal al abrir la app. Anotador con IA para escribir cualquier cosa (tarea, evento) y que se organice sola, la tarjeta "¿y ahora qué?" que sugiere qué hacer, y las tareas/eventos del día.
- Calendario: vistas Semana, Mes y Año. Junta eventos manuales, parciales/entregas y las sesiones de estudio planificadas por materia. Podés importar/exportar archivos .ics.
- Facultad: creás y gestionás tus materias (horarios por día, comisión, aula virtual). Cada materia tiene: qué hacer, anotaciones, temario del parcial (con estado a estudiar/resumido/estudiado/repasado y planificador semanal de estudio por arrastre), parciales y TPs, y archivos.
- Progreso: notas del cuatrimestre. Por cada materia se configura el esquema de evaluación (parciales, coloquio, final, promoción) y se cargan las notas; el estado (cursando, regular, a recuperar, aprobada, promocionada) se calcula solo. Festeja con una animación al aprobar o promocionar.
- Ocio: películas, series y juegos con estado (querés ver / viendo / visto, a jugar / jugando / terminado) y puntaje.
- Tareas: se accede desde Hoy o desde cada materia. Podés filtrar por materia, prioridad y estado.
- Hubby (chat IA): asistente con atajos rápidos, conoce tu perfil, materias y tareas.
- Configuración: perfil, vincular Telegram, contraseña, borrar datos, instalar como app.

CÓMO HACER TAREAS COMUNES:
- Agregar materia: Facultad → "Nueva materia". Completar nombre, horarios, comisión, aula virtual y temario inicial.
- Agregar tarea o evento rápido: escribir en el anotador de "Hoy" (ej: "tarea: terminar TP para el viernes" o "parcial de álgebra el 24") y Enter.
- Ver el estado de una materia: Progreso muestra el estado derivado de las notas cargadas; Facultad muestra el mismo estado en la tarjeta de la materia.
- Planificar el estudio de la semana: entrar a una materia → "Temario del parcial" → "Planificar la semana" → arrastrar los temas a la grilla de días y franjas (mañana/tarde/noche). Esas sesiones aparecen solas en el Calendario.
- Conectar Telegram (Hubby): Configuración → Integraciones → generar código → abrí @Hubby_ia_bot y pegá el código.
- Instalar como app (PWA): Configuración → Acerca de → "Instalar como app". En iOS: Safari → compartir → "Añadir a pantalla de inicio".
- Cambiar contraseña: Configuración → Cuenta.
- Importar eventos al calendario: Calendario → botón de subir (import .ics).

TELEGRAM BOT (HUBBY):
- Podés guardar tareas y notas enviándole mensajes a @Hubby_ia_bot.
- Primero hay que vincular la cuenta con el código de Configuración → Integraciones.
- También podés preguntarle cosas sobre StudyHub al bot.
`;
