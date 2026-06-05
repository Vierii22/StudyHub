/**
 * Convierte los archivos JSX de public/app/ a ES modules en src/app/.
 * Hace los cambios mecánicos:
 *   1. Elimina Object.assign(window, {...}) → export {...}
 *   2. Elimina window.X = X → export { X }
 *   3. Agrega el import React en cada archivo
 *
 * Los imports cruzados se agregan por separado (ver IMPORTS_MAP abajo).
 */

const fs   = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../public/app');
const DST_DIR = path.join(__dirname, '../src/app');

fs.mkdirSync(DST_DIR, { recursive: true });

/* ── mapa de imports por archivo ────────────────────────────
   Formato: cada entrada es el bloque de imports a insertar
   después de "import React from 'react'"
   ─────────────────────────────────────────────────────────── */
const IMPORTS_MAP = {
  'icons.jsx': ``,

  'store.jsx': `
import { Icon } from './icons.jsx';
import { SupabaseStorage } from '../storage.js';`,

  'ui.jsx': `
import ReactDOM from 'react-dom';
import { Icon } from './icons.jsx';
import { Store, useStore, uid, scaleToZoom, toast, COLORS, ALL_WIDGETS, PomoStore, usePomoStore } from './store.jsx';`,

  'board.jsx': `
import ReactDOM from 'react-dom';
import { Icon } from './icons.jsx';
import { uid, toast, COLORS } from './store.jsx';`,

  'widgets.jsx': `
import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, PRIO, STATUS, playSound } from './store.jsx';
import { Btn, Modal, PageHead, Empty, Chip, Field, MonoLabel } from './ui.jsx';`,

  'login.jsx': `
import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast } from './store.jsx';
import { Btn, Field, Modal, TerminalCorners } from './ui.jsx';
import { supabase } from '../supabase.js';`,

  'dashboard.jsx': `
import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, COLORS, PRIO, STATUS, getPomoWeekMins, getPomoWeekByDay } from './store.jsx';
import { Btn, Chip, MonoLabel, PageHead, Empty, Toggle, ProgressRing } from './ui.jsx';
import { SmartList } from './widgets.jsx';`,

  'dashboard2.jsx': `
import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, ALL_WIDGETS } from './store.jsx';
import { Btn, Chip, MonoLabel, Modal, Field } from './ui.jsx';`,

  'facultad.jsx': `
import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, COLORS } from './store.jsx';
import { Btn, Chip, MonoLabel, PageHead, Empty, Modal, Field } from './ui.jsx';
import { SmartList } from './widgets.jsx';`,

  'facultad2.jsx': `
import ReactDOM from 'react-dom';
import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, COLORS } from './store.jsx';
import { Btn, Chip, MonoLabel, PageHead, Empty, Modal, Toggle, ProgressRing } from './ui.jsx';
import { SmartList } from './widgets.jsx';
import { CanvaBoard, defaultBoardItem } from './board.jsx';`,

  'tareas.jsx': `
import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, COLORS, PRIO, STATUS } from './store.jsx';
import { Btn, Chip, Modal, Field, PageHead, Empty, MonoLabel } from './ui.jsx';`,

  'sections.jsx': `
import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, COLORS } from './store.jsx';
import { Btn, Chip, Modal, Field, PageHead, Empty } from './ui.jsx';`,

  'sections2.jsx': `
import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, playSound, addPomoMinutes, getPomoWeekMins, PomoStore, usePomoStore } from './store.jsx';
import { Btn, Chip, Modal, Field, PageHead, Empty } from './ui.jsx';`,

  'sections3.jsx': `
import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, COLORS } from './store.jsx';
import { Btn, Chip, Modal, Field, PageHead, Empty, MonoLabel, Toggle } from './ui.jsx';
import { SmartList } from './widgets.jsx';`,

  'config.jsx': `
import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, COLORS } from './store.jsx';
import { Btn, Chip, MonoLabel, PageHead, Field, Modal, Seg, Toggle, ProgressRing, TerminalCorners, FONT_OPTS, ACCENT_OPTS, VARIANT_OPTS, NAV } from './ui.jsx';
import { supabase } from '../supabase.js';
import { SupabaseStorage } from '../storage.js';`,

  'system.jsx': `
import { Icon } from './icons.jsx';
import { Btn, Chip, MonoLabel, PageHead } from './ui.jsx';`,

  'feedback.jsx': `
import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast } from './store.jsx';
import { Btn } from './ui.jsx';`,

  'space-table.jsx': `
import { Icon } from './icons.jsx';
import { uid, toast } from './store.jsx';
import { Btn } from './ui.jsx';`,

  'space.jsx': `
import ReactDOM from 'react-dom';
import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast } from './store.jsx';
import { Btn, Chip, MonoLabel, PageHead, Empty, Modal, Field } from './ui.jsx';
import { TableBlock, newTableData } from './space-table.jsx';
import { SmartList } from './widgets.jsx';`,

  'app.jsx': `
import ReactDOM from 'react-dom/client';
import { Icon } from './icons.jsx';
import { Store, useStore, toast, scaleToZoom, PomoStore, usePomoStore } from './store.jsx';
import { Sidebar, Header, ToastHost } from './ui.jsx';
import { Dashboard } from './dashboard2.jsx';
import { Facultad, SubjectModal } from './facultad.jsx';
import { SubjectView } from './facultad2.jsx';
import { Tareas } from './tareas.jsx';
import { Misiones, Calendario } from './sections.jsx';
import { Pomodoro, ChatIA, Diario, Historial } from './sections2.jsx';
import { Cocina, Finanzas, Casa, Ocio, Recetas } from './sections3.jsx';
import { ConfigSection, MorningModal } from './config.jsx';
import { MiEspacio } from './space.jsx';
import { FeedbackWidget } from './feedback.jsx';
import { supabase } from '../supabase.js';`,
};

/* ── transformaciones ─────────────────────────────────────── */
function transform(src, filename) {
  let out = src;

  // 1. Object.assign(window, { A, B, C }) → export { A, B, C };
  out = out.replace(
    /Object\.assign\(window,\s*\{([^}]+)\}\);?\s*$/m,
    (_, names) => `export {${names}};`
  );

  // 2. window.X = X; → export { X };
  out = out.replace(
    /^window\.(\w+)\s*=\s*\1\s*;?\s*$/gm,
    (_, name) => `export { ${name} };`
  );

  // 3. Sustituir window._supabase → supabase
  out = out.replace(/window\._supabase/g, 'supabase');

  // 4. Sustituir window.SupabaseStorage → SupabaseStorage
  out = out.replace(/window\.SupabaseStorage/g, 'SupabaseStorage');

  // 5. En app.jsx: quitar ReactDOM.createRoot...render() del final
  //    (lo hace main.jsx — app.jsx ahora exporta { App })
  if (filename === 'app.jsx') {
    out = out.replace(
      /ReactDOM\.createRoot\(document\.getElementById\("root"\)\)\.render\(<App \/>\);?\s*$/m,
      '// Render moved to src/main.jsx\nexport { App };'
    );
  }

  // 6. Agregar imports al principio
  const extraImports = IMPORTS_MAP[filename] || '';
  const reactImport  = `import React from 'react';\n${extraImports}`;
  out = reactImport + '\n\n' + out;

  return out;
}

/* ── procesar cada archivo ───────────────────────────────── */
const ORDER = [
  'icons.jsx','store.jsx','ui.jsx','board.jsx','widgets.jsx','login.jsx',
  'dashboard.jsx','dashboard2.jsx','facultad.jsx','facultad2.jsx','tareas.jsx',
  'sections.jsx','sections2.jsx','sections3.jsx','config.jsx','system.jsx',
  'feedback.jsx','space-table.jsx','space.jsx','app.jsx',
];

let ok = 0;
for (const f of ORDER) {
  const srcPath = path.join(SRC_DIR, f);
  const dstPath = path.join(DST_DIR, f);
  if (!fs.existsSync(srcPath)) { console.warn(`  ⚠️  ${f} no encontrado`); continue; }
  const src = fs.readFileSync(srcPath, 'utf-8');
  const out = transform(src, f);
  fs.writeFileSync(dstPath, out, 'utf-8');
  console.log(`  ✓ ${f}`);
  ok++;
}
console.log(`\n✅ ${ok}/${ORDER.length} archivos convertidos → src/app/`);
