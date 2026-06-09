/* Manual de uso de StudyHub — se inyecta en el prompt del Chat IA y el bot de Telegram */

export const APP_GUIDE = `
=== MANUAL DE USO DE STUDYHUB ===

SECCIONES Y CÓMO ACCEDER:
- Dashboard: pantalla principal al abrir la app. Muestra widgets con XP, racha de días, tareas del día, próximos eventos, materias y horas de Pomodoro. Se personaliza desde Configuración > Dashboard.
- Facultad: icono de capas en el sidebar. Acá creás y gestionás tus materias. Cada materia tiene widgets propios (temas, TPs, notas, fechas, links, archivos). También tiene un modo pizarrón libre estilo Canva.
- Tareas: icono de check. Todas tus tareas. Podés filtrar por materia, prioridad y estado. Agregás con el botón "+".
- Misiones: icono de rayo. Objetivos tipo videojuego con hitos. Al completarlos ganás XP.
- Calendario: icono de calendario. Todos tus eventos. Navegás con las flechas. Podés importar/exportar archivos .ics.
- Pomodoro: icono de reloj. Timer 25 min foco + 5 min descanso. Espacio para pausar. Registra horas automáticamente.
- Chat IA: icono de burbuja. EstudioIA (Gemini). Tiene atajos rápidos arriba. Conoce tu perfil, materias y tareas.
- Diario: icono de lápiz. Registro diario personal + seguimiento de sueño y energía matutinos.
- Mi Espacio: icono de cuadro. Pizarrón libre con notas, listas, post-its, encabezados, código, links, tablas, imágenes.
- Cocina: recetas y lista de compras.
- Finanzas: control de gastos e ingresos.
- Casa: lista de tareas del hogar.
- Ocio: lista de películas, series y libros pendientes.
- Configuración: icono de engranaje (esquina inferior del sidebar). Apariencia, dashboard, perfil, Telegram, cuenta.

CÓMO HACER TAREAS COMUNES:
- Agregar materia: Facultad → botón "+ Nueva materia". Completar nombre, color, profesor y datos del aula.
- Agregar tarea: Tareas → escribir en el campo de abajo y Enter, o botón "+". También desde cada materia.
- Ver progreso de materias: Facultad → cada materia muestra un porcentaje. Adentro hay un anillo de progreso.
- Abrir el pizarrón de una materia: Facultad → click en la materia → activar "Modo pizarrón" con el toggle.
- Personalizar widgets del dashboard: Configuración > Dashboard → "Abrir editor" o click en "Editar dashboard" desde el dashboard.
- Cambiar colores y fuente: Configuración > Apariencia.
- Conectar Telegram (Hubby): Configuración > Integraciones → generar código → abrí @Hubby_ia_bot y pegá el código.
- Instalar como app (PWA): Configuración > Acerca de → "Instalar como app". En iOS: Safari → compartir → "Añadir a pantalla de inicio".
- Cambiar contraseña: Configuración > Cuenta → sección "Cambiar contraseña".
- Importar eventos al calendario: Calendario → botón "Importar .ics".
- Mini Pomodoro flotante: cuando iniciás el Pomodoro y cambiás de sección, aparece un widget flotante abajo a la derecha para no perder el foco.

SISTEMA DE XP Y PROGRESO:
- Completar tareas suma XP. El nivel sube acumulando XP.
- La racha cuenta días consecutivos de uso de la app.
- Los widgets del dashboard muestran progreso en tiempo real.

TELEGRAM BOT (HUBBY):
- Podés guardar tareas, gastos y notas enviándole mensajes a @Hubby_ia_bot.
- Primero hay que vincular la cuenta con el código de Configuración > Integraciones.
- También podés preguntarle cosas sobre StudyHub al bot.
`;
