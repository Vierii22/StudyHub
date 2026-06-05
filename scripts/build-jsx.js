/**
 * StudyHub — JSX pre-compiler
 * Compila los 20 archivos JSX en un solo bundle JS minificado.
 * Elimina la necesidad de @babel/standalone en el browser del usuario.
 *
 * Uso:
 *   node scripts/build-jsx.js
 *
 * Salida:
 *   public/app.bundle.js
 */

const babel = require('@babel/core');
const fs    = require('fs');
const path  = require('path');

const SRC_DIR  = path.join(__dirname, '../public/app');
const OUT_FILE = path.join(__dirname, '../public/app.bundle.js');

// Orden de carga exacto (dependencias primero)
const ORDER = [
  'icons', 'store', 'ui', 'board', 'widgets', 'login',
  'dashboard', 'dashboard2', 'facultad', 'facultad2', 'tareas',
  'sections', 'sections2', 'sections3', 'config', 'system',
  'feedback', 'space-table', 'space', 'app',
];

console.log('\n🔨 StudyHub — compilando JSX...\n');

let bundle  = `// StudyHub — pre-compiled bundle
// Generado por: npm run build:jsx
// ⚠️  No editar directamente — editar los archivos .jsx en public/app/
// Generado: ${new Date().toISOString()}
`;

let totalSrc = 0;

for (const name of ORDER) {
  const srcPath = path.join(SRC_DIR, `${name}.jsx`);

  if (!fs.existsSync(srcPath)) {
    console.warn(`  ⚠️  ${name}.jsx no encontrado — saltando`);
    continue;
  }

  process.stdout.write(`  Compilando ${name}.jsx...`);
  const src = fs.readFileSync(srcPath, 'utf-8');
  totalSrc += src.length;

  let compiled;
  try {
    compiled = babel.transformSync(src, {
      presets: [['@babel/preset-react', { runtime: 'classic' }]],
      filename: `${name}.jsx`,
      configFile: false,
      babelrc: false,
      // No añadir "use strict" por archivo (evita conflictos de scope)
      sourceMaps: false,
    });
  } catch (err) {
    console.error(`\n  ❌ Error en ${name}.jsx:`);
    console.error('    ' + err.message);
    process.exit(1);
  }

  // Cada archivo va en su propio bloque de comentario para debug
  bundle += `\n\n/* ${'='.repeat(58)}\n   ${name}.jsx\n${'='.repeat(60)}*/\n`;
  bundle += compiled.code;
  bundle += '\n';

  const kb = Math.round(src.length / 1024);
  console.log(` ✓ (${kb}KB)`);
}

// Escribir bundle
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, bundle, 'utf-8');

const outKB = Math.round(fs.statSync(OUT_FILE).size / 1024);
const srcKB  = Math.round(totalSrc / 1024);
console.log(`\n✅ Bundle listo: public/app.bundle.js`);
console.log(`   Fuente: ${srcKB}KB → Bundle: ${outKB}KB`);
console.log(`   (sin @babel/standalone ni React.development — x5-8 más rápido)\n`);
