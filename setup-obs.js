#!/usr/bin/env node
/**
 * Asistente de setup de OBS Studio para el monorepo del bot de ajedrez.
 *
 * Carga las colecciones de escenas de `apps/overlays/scenes/*.json` dentro de
 * OBS Studio, copiándolas a la carpeta de configuración de OBS de tu sistema.
 * Además reescribe las rutas de los "Browser Source" para que apunten a los
 * overlays HTML reales de este repositorio (las que vienen guardadas son rutas
 * de otra máquina, p.ej. C:/Users/pon_t/...), de modo que las escenas funcionen
 * nada más importarlas.
 *
 * Es idempotente (puedes ejecutarlo varias veces) y no usa dependencias
 * externas: solo módulos de Node.
 *
 *   1. Localiza la carpeta de OBS de tu sistema (Windows / macOS / Linux,
 *      incluyendo la instalación Flatpak).
 *   2. Por cada colección de `apps/overlays/scenes/`, reescribe las URLs de los
 *      Browser Source a los overlays de `apps/overlays/` y la copia a OBS.
 *   3. Hace una copia de seguridad (.bak) de cualquier colección con el mismo
 *      nombre que ya tuvieras.
 *
 * Flags:
 *   --serve            Apunta los Browser Source a http://localhost:4000/<archivo>
 *                      (el servidor `npm run overlays`) en lugar de a ficheros
 *                      locales file://. Útil si sirves los overlays.
 *   --obs-dir <ruta>   Fuerza la carpeta base de configuración de OBS.
 *   --dry-run          No escribe nada; solo muestra lo que haría.
 *   --no-rewrite       Copia las escenas tal cual, sin tocar las rutas.
 *   --help             Muestra esta ayuda.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const args = process.argv.slice(2);
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

const DRY = args.includes('--dry-run');
const SERVE = args.includes('--serve');
const NO_REWRITE = args.includes('--no-rewrite');
const SERVE_PORT = 4000; // puerto de `npm run overlays`

const SCENES_SRC = path.join(ROOT, 'apps', 'overlays', 'scenes');
const OVERLAYS_DIR = path.join(ROOT, 'apps', 'overlays');

// --- helpers de salida (mismo estilo que setup.js) -------------------------
const c = (code, s) => `\x1b[${code}m${s}\x1b[0m`;
const log = (...a) => console.log(...a);
const step = (n, total, msg) => log(`\n${c('36', `[${n}/${total}]`)} ${msg}`);
const ok = (msg) => log(`  ${c('32', '✓')} ${msg}`);
const warn = (msg) => log(`  ${c('33', '!')} ${msg}`);
const info = (msg) => log(`  ${c('90', '·')} ${msg}`);

function flagValue(name) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

if (args.includes('--help')) {
  log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^[\s\S]*?\n \*/, ' *'));
  process.exit(0);
}

// Devuelve la carpeta `basic/scenes` de OBS para este sistema, creándola si hace
// falta. Permite forzarla con --obs-dir.
function resolveObsScenesDir() {
  const forced = flagValue('--obs-dir');
  if (forced) {
    const base = forced.endsWith('scenes') ? forced : path.join(forced, 'basic', 'scenes');
    return base;
  }

  const home = os.homedir();
  const candidates = [];
  if (isWin) {
    const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    candidates.push(path.join(appdata, 'obs-studio', 'basic', 'scenes'));
  } else if (isMac) {
    candidates.push(
      path.join(home, 'Library', 'Application Support', 'obs-studio', 'basic', 'scenes'),
    );
  } else {
    // Linux: Flatpak primero (si existe), luego instalación nativa.
    candidates.push(
      path.join(home, '.var', 'app', 'com.obsproject.Studio', 'config', 'obs-studio', 'basic', 'scenes'),
      path.join(home, '.config', 'obs-studio', 'basic', 'scenes'),
    );
  }

  // Elegimos la primera cuya carpeta de OBS (un nivel por encima de basic/) ya
  // exista —señal de que OBS está instalado ahí—; si ninguna, la primera.
  for (const dir of candidates) {
    const obsRoot = path.resolve(dir, '..', '..'); // .../obs-studio
    if (fs.existsSync(obsRoot)) return dir;
  }
  return candidates[0];
}

// Reescribe las URLs de los Browser Source de una colección para que apunten a
// los overlays reales de este repo. Devuelve { changed, missing[] }.
function rewriteBrowserSources(collection) {
  const sources = Array.isArray(collection.sources) ? collection.sources : [];
  let changed = 0;
  const missing = [];

  for (const src of sources) {
    if (!src || src.id !== 'browser_source' || !src.settings) continue;
    const s = src.settings;

    // Sacamos el nombre del archivo HTML de la url o del local_file actuales.
    const ref = s.local_file || s.url || '';
    const base = path.basename(ref.replace(/^file:\/\//, '').replace(/\\/g, '/'));
    if (!base || !/\.html?$/i.test(base)) continue;

    const localPath = path.join(OVERLAYS_DIR, base);
    if (!fs.existsSync(localPath)) {
      missing.push(base);
      continue;
    }

    if (SERVE) {
      s.is_local_file = false;
      s.local_file = '';
      s.url = `http://localhost:${SERVE_PORT}/${base}`;
    } else {
      // OBS espera local_file con barras normales y url como file:// absoluto.
      const norm = localPath.split(path.sep).join('/');
      s.is_local_file = true;
      s.local_file = norm;
      s.url = 'file://' + (norm.startsWith('/') ? norm : '/' + norm);
    }
    changed++;
  }
  return { changed, missing };
}

// Copia de seguridad única: <archivo>.bak (no machaca un .bak ya existente).
function backupOnce(file) {
  const bak = file + '.bak';
  if (fs.existsSync(file) && !fs.existsSync(bak)) {
    if (!DRY) fs.copyFileSync(file, bak);
    return bak;
  }
  return null;
}

function main() {
  log(c('1', '\n🎬  Setup de OBS — colecciones de escenas del stream de ajedrez\n'));
  if (DRY) warn('Modo --dry-run: no se escribirá ningún archivo.');

  // 1) Escenas de origen
  step(1, 3, 'Buscando colecciones de escenas en apps/overlays/scenes...');
  if (!fs.existsSync(SCENES_SRC)) {
    throw new Error(`No existe ${SCENES_SRC}`);
  }
  const files = fs.readdirSync(SCENES_SRC).filter((f) => f.toLowerCase().endsWith('.json'));
  if (!files.length) {
    warn('No hay colecciones (.json) que instalar. Nada que hacer.');
    return;
  }
  files.forEach((f) => info(f));
  ok(`${files.length} colección(es) encontrada(s)`);

  // 2) Carpeta de OBS
  step(2, 3, 'Localizando la carpeta de configuración de OBS...');
  const dest = resolveObsScenesDir();
  const obsRoot = path.resolve(dest, '..', '..');
  if (!fs.existsSync(obsRoot)) {
    warn(`No encontré una instalación de OBS en ${obsRoot}.`);
    warn('Se creará la carpeta igualmente; si OBS está en otra ruta usa --obs-dir <ruta>.');
  }
  if (!DRY) fs.mkdirSync(dest, { recursive: true });
  ok(`Destino: ${dest}`);

  // 3) Instalar cada colección (reescribiendo rutas)
  step(3, 3, NO_REWRITE ? 'Copiando colecciones tal cual...' : 'Reescribiendo rutas e instalando...');
  for (const file of files) {
    const srcPath = path.join(SCENES_SRC, file);
    let collection;
    try {
      collection = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
    } catch (e) {
      warn(`${file}: JSON inválido, se omite (${e.message})`);
      continue;
    }

    if (!NO_REWRITE) {
      const { changed, missing } = rewriteBrowserSources(collection);
      if (changed) info(`${file}: ${changed} Browser Source reapuntado(s)` + (SERVE ? ' a localhost:4000' : ' a ficheros locales'));
      if (missing.length) warn(`${file}: overlays no encontrados en apps/overlays (se dejan igual): ${missing.join(', ')}`);
    }

    const destPath = path.join(dest, file);
    const bak = backupOnce(destPath);
    if (bak) info(`copia de seguridad: ${path.basename(bak)}`);
    if (!DRY) fs.writeFileSync(destPath, JSON.stringify(collection, null, 4) + '\n');
    ok(`Instalada: ${collection.name || file}`);
  }

  log(c('1', '\n✅  OBS configurado.\n'));
  log('Próximos pasos:');
  log(`  · ${c('33', 'Reinicia OBS')} si estaba abierto (lee las colecciones al arrancar).`);
  log('  · En OBS: menú "Colección de escenas" → elige la que quieras.');
  if (SERVE) {
    log(`  · Arranca los overlays para que carguen: ${c('36', 'npm run overlays')}`);
  } else {
    log('  · Las escenas apuntan a los HTML de apps/overlays/ de este equipo.');
    log(`    (Usa ${c('36', '--serve')} para apuntarlas a http://localhost:4000 en su lugar.)`);
  }
  log('');
}

try {
  main();
} catch (err) {
  console.error(`\n${c('31', '✗ Error en el setup de OBS:')} ${err.message}\n`);
  process.exit(1);
}
