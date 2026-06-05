# Plan — Rediseño Pizarrón + Migración ES Modules

> Documento de planificación. Generado 2026-06-05.
> Stack actual: React 18 UMD + Babel pre-compilado (scripts/build-jsx.js) → 1 bundle.
> 20 archivos en `public/app/*.jsx`, cada uno termina en `Object.assign(window, {...})`.

---

# PARTE A — REDISEÑO DEL PIZARRÓN

## Estado actual (lo que YA existe)
- `CanvaBoard` en `board.jsx`: drag, resize, zoom (Ctrl+rueda), pan, fullscreen.
- Widgets actuales: `note, list, postit, image, heading, callout, code, link, divider`.
- Fullscreen: estado `expand` interno → `ReactDOM.createPortal(boardEl, document.body)`.
- Se activa con toggle "Modo pizarrón" en `SubjectView` (facultad2.jsx).
- Ítems se guardan en `data.subjects[i].board = [{id,kind,x,y,w,h,bg,border,tx,fs,...}]`.

## Problema raíz #1 — Fullscreen tapa el drawer (CRÍTICO)
El `BoardDrawer` se renderiza en `facultad2.jsx:272` FUERA de `CanvaBoard`:
```
{s.boardMode && customize && <BoardDrawer ... />}
```
Cuando el board entra en fullscreen, `boardEl` se porta a `document.body` con `z-index:300`.
El drawer (z-index 120) queda DETRÁS del portal → no se puede agregar nada en fullscreen.

### Solución: mover la capacidad "agregar widget" DENTRO de CanvaBoard
- `CanvaBoard` recibe nuevos props: `onAddItem(kind)`, `quickSections`, `onAddSection(sec)`.
- El drawer se renderiza DENTRO de `boardEl` → viaja con el portal en fullscreen.
- `SubjectView` deja de renderizar `BoardDrawer` directamente; pasa los handlers.
- Estado `drawerOpen` interno a CanvaBoard, abierto por un botón "+" en `board-tools`.

### Cambios concretos
**board.jsx:**
- `function CanvaBoard({ items, onChange, editing, showDots, minHeight, onAddItem, quickSections, onAddSection })`
- Agregar `const [drawerOpen, setDrawerOpen] = React.useState(false)`.
- En `board-tools` agregar botón `+ Agregar` (solo si `editing`) que togglea `drawerOpen`.
- Renderizar `<BoardAddPanel>` dentro de `boardEl` cuando `editing && drawerOpen`.
- Mover `BoardDrawer` (renombrar a `BoardAddPanel`) de facultad2.jsx → board.jsx.

**facultad2.jsx:**
- Borrar líneas 31-63 (`BoardDrawer`) → migra a board.jsx.
- Línea 246: `<CanvaBoard items={board} onChange={setBoard} editing={customize} showDots={s.showDots} onAddItem={addBoardItem} quickSections={QUICK_SECTIONS} onAddSection={addSectionToBoard} />`
- Borrar línea 272 (el `<BoardDrawer>` suelto).

## Problema raíz #2 — Sin soporte touch (mobile no funciona)
Todos los handlers son `mousedown/mousemove/mouseup`. En celular no se puede arrastrar.

### Solución: migrar a Pointer Events
Pointer events unifican mouse + touch + pen en una sola API.
- `onMouseDown` → `onPointerDown`
- `document.addEventListener("mousemove"/"mouseup")` → `"pointermove"/"pointerup"`
- En el elemento arrastrable: `e.currentTarget.setPointerCapture(e.pointerId)` para no perder el drag.
- CSS: agregar `touch-action: none` a `.board-item.editing`, `.postit.editing`, `.resize`, `.ed-bar`
  (evita que el navegador haga scroll mientras arrastrás).
- El pan del fondo: `onPointerDown` en `.board-viewport`.
- El zoom con rueda queda igual (desktop); en mobile agregar pinch-to-zoom es OPCIONAL fase 2
  (requiere trackear 2 punteros — dejarlo para después).

### Cambios concretos (board.jsx)
- `onDown`, `onCanvasDown`: renombrar internamente a pointer, usar `setPointerCapture`.
- Reemplazar las 3 ocurrencias de `mousemove/mouseup` por `pointermove/pointerup`.
- index.html: agregar reglas `touch-action:none` en las clases mencionadas.

## Nuevos widgets a agregar
El usuario pidió: "cuadros, tablas, títulos, tareas, anotaciones, links de words".
Ya hay: títulos (heading), tareas (list), anotaciones (note), links (link).
**Faltan los de alto valor:**

### 1. TABLA (reusar TableBlock de space-table.jsx) ⭐
- `space-table.jsx` ya exporta `TableBlock({b, onPatch})` y `newTableData()`.
- En `board.jsx defaultBoardItem`: `if (kind === "table") return { ...base, w: 520, h: 320, kind: "table", table: newTableData() }`.
- En `BoardItemBody`: `if (item.kind === "table") return <TableBlock b={item.table} onPatch={p => onChange({ ...item, table: { ...item.table, ...p } })} />`.
- ⚠️ Orden de carga: space-table.jsx carga DESPUÉS de board.jsx en el bundle actual.
  `TableBlock` se referencia en runtime (no en init) → OK con globals. Con ES modules: import.
- Agregar al panel: `["table","Tabla","layers"]`.

### 2. CUADRO / FRAME (contenedor visual para agrupar) ⭐
- Un rectángulo translúcido con título opcional, sin contenido editable, que sirve para
  "encerrar" visualmente otros widgets (como un grupo en Figma).
- `if (kind === "frame") return { ...base, kind: "frame", w: 400, h: 300, bg: "rgba(139,109,255,.04)", border: "var(--violet-line)", title: "Grupo" }`.
- Body: solo muestra el título arriba-izquierda, resto transparente.
- Debe renderizarse DETRÁS de otros widgets → al crear un frame, insertarlo al INICIO del array
  (no al final) para que quede en el fondo.

### 3. BOOKMARK mejorado (link con favicon) 
- Mejora el `link` actual: mostrar favicon vía `https://www.google.com/s2/favicons?domain=HOST&sz=64`.
- Agregar `<img>` del favicon al lado del título cuando hay URL válida.
- Cambio menor en el branch `item.kind === "link"` de BoardItemBody.

### (Opcional fase 2) Otros
- `progress`: barra de progreso con % editable.
- `embed`: iframe de YouTube/Drive (riesgo de seguridad — validar dominio).

## Fullscreen estilo "pizarrón de pared"
El usuario quiere que se sienta como un pizarrón físico.
- En fullscreen, ofrecer toggle de fondo: "Oscuro" (actual) vs "Pizarra" (verde pizarrón #1a2e23
  o gris oscuro con textura sutil).
- Guardar preferencia en `s.boardBg`.
- Header flotante en fullscreen con: nombre de materia + botón salir (ESC ya funciona).
- Esto es polish — fase 2 tras lo funcional.

## UX del drawer en mobile
- Desktop: panel flotante (como ahora, pero dentro del portal).
- Mobile (`@media max-width:768px`): el panel se vuelve un **bottom sheet** (fixed bottom,
  ancho 100%, sube desde abajo). CSS-only con una clase `.board-add-panel.sheet`.

## Orden de ejecución sugerido (Parte A)
1. **Fix fullscreen + drawer** (mover BoardDrawer → CanvaBoard). Lo más importante.
2. **Pointer events** (touch). Desbloquea mobile.
3. **Widget Tabla** (reusar TableBlock). Alto valor, bajo costo.
4. **Widget Frame** (cuadro). 
5. **Bookmark con favicon**.
6. **Polish**: fondo pizarra fullscreen, bottom sheet mobile.

Estimado total: 1.5 - 2 días.

---

# PARTE B — MIGRACIÓN A ES MODULES

## Por qué
- Hoy: 20 archivos hablan por `window.X`. Funciona pero: sin tree-shaking, sin HMR real,
  errores opacos, no escalable.
- Con ES modules + Vite nativo: imports explícitos, HMR, lazy-load, bundle chunked, tests posibles.

## Grafo de dependencias (ya es acíclico — el orden de carga es un topological sort)
Orden actual en `scripts/build-jsx.js`:
```
icons → store → ui → board → widgets → login → dashboard → dashboard2 →
facultad → facultad2 → tareas → sections → sections2 → sections3 →
config → system → feedback → space-table → space → app
```
- `icons.jsx`: sin dependencias (solo React).
- `store.jsx`: usa `Icon` (en ToastHost). Lee `window.SupabaseStorage`, `window._supabase`.
- `ui.jsx`: usa Store/useStore/Icon.
- Resto: usan store + ui + icons + componentes previos.
Como el orden ya es topológico, los `import` se resuelven sin ciclos.

## Setup
1. `npm i -D @vitejs/plugin-react`
2. `vite.config.js`:
   ```js
   import react from '@vitejs/plugin-react';
   export default defineConfig({ plugins: [react()], build: { outDir: 'dist' } });
   ```
3. Mover `public/app/*.jsx` → `src/app/*.jsx` (para que Vite los procese).
4. Crear `src/main.jsx` como entry: `import './app/app.jsx';`
5. `index.html`: reemplazar
   - QUITAR: los 2 `<script>` de React UMD production.
   - QUITAR: `<script defer src="/app.bundle.js">`.
   - PONER: `<script type="module" src="/src/main.jsx"></script>`.
6. `package.json`: scripts vuelven a `"dev": "vite"`, `"build": "vite build"`.
   Borrar `scripts/build-jsx.js` y la dependencia de pre-compilado.

## Conversión por archivo (patrón)
Cada archivo:
1. Arriba: `import React from 'react';` (todos usan `React.useState`, etc.).
   - `app.jsx`, `board.jsx`, `space.jsx`: además `import ReactDOM from 'react-dom/client';`
     (board y space usan `ReactDOM.createPortal`; app usa `createRoot`).
2. Arriba: imports de lo que usa de otros módulos. Ej. para `dashboard.jsx`:
   ```js
   import { Store, useStore, uid, toast, COLORS, PRIO } from './store.jsx';
   import { Icon } from './icons.jsx';
   import { Btn, Modal, PageHead, Empty, Chip, ProgressRing } from './ui.jsx';
   ```
3. Abajo: cambiar `Object.assign(window, { A, B })` por `export { A, B };`.
4. Borrar referencias `window.X` internas → usar el import.

## Mapa de exports (qué exporta cada módulo)
- **icons**: `Icon`
- **store**: `Store, useStore, uid, scaleToZoom, toast, ToastHost, COLORS, PRIO, STATUS, ALL_WIDGETS, playSound, addPomoMinutes, getPomoWeekMins, getPomoWeekByDay, PomoStore, usePomoStore`
- **ui**: `TerminalCorners, ProgressRing, Btn, Chip, MonoLabel, NAV, Sidebar, FONT_OPTS, ACCENT_OPTS, VARIANT_OPTS, Field, Seg, AppearanceControl, Header, PageHead, Modal, Toggle, Empty, SubjectDot, BrandBanner`
- **board**: `CanvaBoard, defaultBoardItem, POSTIT_COLORS`
- **widgets**: `SmartList, SidePeek, SL_STATUS, SL_PRIO, normItem`
- **login**: `Login, Onboarding` (NO re-exportar Field — viene de ui)
- **dashboard**: `WIDGET_COMP, greetingTime`
- **dashboard2**: `Dashboard, HubbyBanner`
- **facultad**: `Facultad, SubjectModal, TemplatePicker, SubjectFiles, ProfsEditor, downloadFile, fmtBytes, fileIcon`
- **facultad2**: `SubjectView`
- **tareas**: `Tareas, TaskModal, PrioBadge, StatusBadge, DueBadge`
- **sections**: `Misiones, Calendario, MissionModal, EventModal`
- **sections2**: `Pomodoro, ChatIA, Diario, Historial`
- **sections3**: `Cocina, Finanzas, Casa, Ocio, Recetas`
- **config**: `ConfigSection, MorningModal, ConfigRow, InstallPWA`
- **system**: (showcase — exporta su componente principal, revisar)
- **feedback**: `FeedbackWidget`
- **space-table**: `TableBlock, newTableData, csvParse, csvBuild`
- **space**: `MiEspacio`
- **app**: entry (no exporta, hace `createRoot().render()`)

## Casos especiales / riesgos
1. **React/ReactDOM**: con `@vitejs/plugin-react` runtime automático, el JSX NO necesita React
   en scope. PERO el código usa `React.useState` literal → mantener `import React from 'react'`
   en cada archivo. `ReactDOM` solo donde se usa.
2. **Duplicados ya resueltos**: `Field` (login importa de ui), `FONT_OPTS/ACCENT_OPTS/VARIANT_OPTS`
   (config importa de ui — ya están comentados en config.jsx, falta el import).
3. **Bridge supabase**: store.jsx deja de leer `window.SupabaseStorage`. En su lugar:
   ```js
   import { SupabaseStorage } from '../storage.js';
   import { supabase } from '../supabase.js';
   ```
   Y app.jsx usa `supabase` importado en vez de `window._supabase`.
   El `<script type="module">` bridge del index.html se ELIMINA (ya no hace falta).
4. **Custom events** (`sh:storage-sync`, `pomo:complete`, etc.): sin cambios, siguen por window.
5. **Orden de init**: como el grafo es acíclico, los imports resuelven bien. Vigilar que ningún
   módulo EJECUTE código de otro en top-level antes de que el otro esté listo (los componentes
   se ejecutan en render, no en import → seguro).
6. **`api/chat.js`**: no cambia (es serverless, CommonJS, vive en /api).

## Verificación
1. `npm run dev` → la app levanta con Vite nativo + HMR.
2. Probar: login, navegación, cada sección, Chat IA, Pomodoro, pizarrón.
3. `npm run build` → bundle chunked en dist/. Verificar tamaño (debería ser menor con tree-shaking).
4. Console: cero errores de "X is not defined".
5. Deploy a Vercel: el build command pasa a `vite build` (sin build:jsx).
   ⚠️ Verificar `VITE_SUPABASE_*` env vars siguen llegando (import.meta.env).

## Orden de ejecución sugerido (Parte B)
1. Setup (plugin, vite.config, mover archivos, index.html).
2. Convertir en orden topológico: icons → store → ui → ... → app.
   (Convertir de a uno, el bundle no compila hasta terminar — hacerlo en una sola pasada.)
3. Arreglar imports que falten iterando sobre errores de consola.
4. Verificación completa.
5. Borrar `scripts/build-jsx.js`, `public/app/`, restos del approach viejo.

Estimado total: 2 - 3 días (riesgo medio — refactor extenso pero mecánico).

---

# RECOMENDACIÓN DE SECUENCIA GLOBAL
1. **Parte A (pizarrón)** primero — valor visible para el usuario, cambios acotados.
2. **Parte B (ES modules)** después — es infraestructura, sin cambio visible.
   Hacerla cuando el pizarrón esté estable, en su propia sesión, sin presión de contexto.

⚠️ Si se hace Parte B, los cambios de Parte A hay que portarlos al nuevo formato de imports
   (mecánico). Por eso conviene A → B y no al revés.
