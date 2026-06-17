#!/usr/bin/env node
/**
 * Asistente de setup de Voicemeeter Banana para el monorepo del bot de ajedrez.
 *
 * Genera la configuración de audio del stream a partir de la plantilla de
 * `apps/overlays/voicemeeter/Chess-Stream-Banana.xml` y la deja en la carpeta
 * `Documents\Voicemeeter` de tu sistema, que es donde Voicemeeter guarda y lee
 * sus settings. Así puedes cargarla con un clic desde Menú ▸ Load Settings…
 *
 * La plantilla deja etiquetadas y ruteadas las entradas típicas de un stream de
 * ajedrez: Micro, Juego/Sistema (entrada virtual VAIO) y Música/Discord
 * (entrada virtual AUX). El Micro va solo al stream (B1), y Juego y Música van a
 * tus cascos (A1) y al stream (B1). Es idempotente: vuelve a ejecutarlo cuando
 * quieras (hace una copia de seguridad .bak antes de sobrescribir) y no usa
 * dependencias externas (solo módulos de Node).
 *
 * Voicemeeter es software de Windows. En macOS/Linux no existe: ahí el script
 * solo genera el XML renderizado junto a la plantilla para que lo lleves a tu PC.
 *
 * Flags:
 *   --voicemeeter-dir <ruta>  Fuerza la carpeta donde se escribe la config
 *                             (por defecto Documents\Voicemeeter).
 *   --name <archivo>          Nombre del fichero de salida (por defecto
 *                             Chess-Stream-Banana.xml).
 *   --mic <texto>             Etiqueta de la entrada de micro (por defecto "Micro").
 *   --game <texto>            Etiqueta del juego/sistema (por defecto "Juego").
 *   --music <texto>           Etiqueta de música/Discord (por defecto "Música").
 *   --dry-run                 No escribe nada; solo muestra lo que haría.
 *   --help                    Muestra esta ayuda.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const args = process.argv.slice(2);
const isWin = process.platform === 'win32';

const DRY = args.includes('--dry-run');

const TEMPLATE = path.join(
  ROOT, 'apps', 'overlays', 'voicemeeter', 'Chess-Stream-Banana.xml',
);

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

// Carpeta Documents\Voicemeeter del sistema (donde Voicemeeter guarda/lee la
// config). Voicemeeter solo existe en Windows; en otros SO devolvemos null.
function resolveVoicemeeterDir() {
  const forced = flagValue('--voicemeeter-dir');
  if (forced) return forced;
  if (!isWin) return null;
  const home = os.homedir();
  // En equipos en español la carpeta sigue siendo "Documents" a nivel de FS.
  return path.join(home, 'Documents', 'Voicemeeter');
}

// Sustituciones {{TOKEN}} -> valor para la plantilla.
function buildReplacements() {
  return {
    VM_LABEL_MIC: flagValue('--mic') || 'Micro',
    VM_LABEL_AUX_HW1: '',
    VM_LABEL_AUX_HW2: '',
    VM_LABEL_GAME: flagValue('--game') || 'Juego',
    VM_LABEL_MUSIC: flagValue('--music') || 'Música',
  };
}

function applyTemplate(raw, repl) {
  return raw.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, key) =>
    Object.prototype.hasOwnProperty.call(repl, key) ? repl[key] : m,
  );
}

function backupOnce(file) {
  const bak = file + '.bak';
  if (fs.existsSync(file) && !fs.existsSync(bak)) {
    if (!DRY) fs.copyFileSync(file, bak);
    return bak;
  }
  return null;
}

function main() {
  log(c('1', '\n🔊  Setup de Voicemeeter — audio del stream de ajedrez (Banana)\n'));
  if (DRY) warn('Modo --dry-run: no se escribirá ningún archivo.');

  // 1) Plantilla
  step(1, 3, 'Leyendo la plantilla de Voicemeeter...');
  if (!fs.existsSync(TEMPLATE)) {
    throw new Error(`No existe la plantilla ${TEMPLATE}`);
  }
  const repl = buildReplacements();
  const xml = applyTemplate(fs.readFileSync(TEMPLATE, 'utf8'), repl);
  // Comprobación ligera de que el XML está bien formado (no parseamos XML real,
  // solo verificamos la raíz y que no queden tokens sin sustituir).
  if (!/<VoiceMeeterParameters>[\s\S]*<\/VoiceMeeterParameters>/.test(xml)) {
    throw new Error('La plantilla no contiene un bloque <VoiceMeeterParameters> válido.');
  }
  ok('Plantilla cargada y rellenada');
  info(`Micro:  ${repl.VM_LABEL_MIC}  (Strip[0], → stream B1)`);
  info(`Juego:  ${repl.VM_LABEL_GAME}  (Strip[3] / VAIO, → cascos A1 + stream B1)`);
  info(`Música: ${repl.VM_LABEL_MUSIC}  (Strip[4] / AUX, → cascos A1 + stream B1)`);

  const fileName = flagValue('--name') || 'Chess-Stream-Banana.xml';

  // 2) Carpeta de Voicemeeter
  step(2, 3, 'Localizando la carpeta de Voicemeeter...');
  const dir = resolveVoicemeeterDir();
  if (!dir) {
    warn('Voicemeeter es software de Windows y no está disponible en este sistema.');
    warn('Se genera el XML renderizado junto a la plantilla; llévalo a tu PC y');
    warn('cárgalo con Menú ▸ Load Settings… (o pasa --voicemeeter-dir <ruta>).');
    const out = path.join(ROOT, 'apps', 'overlays', 'voicemeeter', 'Chess-Stream-Banana.rendered.xml');
    if (!DRY) {
      fs.writeFileSync(out, xml);
      ok(`Config renderizada: ${out}`);
    } else {
      info(`(se generaría: ${out})`);
    }
    printNextSteps(null);
    return;
  }
  if (!fs.existsSync(dir)) {
    warn(`No encontré ${dir}. Se creará la carpeta (Voicemeeter también la usa).`);
  }
  ok(`Carpeta de Voicemeeter: ${dir}`);

  // 3) Instalar la config
  step(3, 3, 'Escribiendo la configuración...');
  if (!DRY) fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, fileName);
  const bak = backupOnce(dest);
  if (bak) info(`copia de seguridad: ${path.basename(bak)}`);
  if (!DRY) fs.writeFileSync(dest, xml);
  ok(`Configuración instalada: ${dest}`);

  printNextSteps(dir);
}

function printNextSteps(dir) {
  log(c('1', '\n✅  Voicemeeter preparado.\n'));
  log('Próximos pasos:');
  log(`  · Instala ${c('33', 'Voicemeeter Banana')} (gratis): https://vb-audio.com/Voicemeeter/banana.htm`);
  if (dir) {
    log('  · En Voicemeeter: Menú ▸ Load Settings… y elige "Chess-Stream-Banana.xml".');
  } else {
    log('  · En tu PC con Voicemeeter: Menú ▸ Load Settings… y elige el XML generado.');
  }
  log('  · Comprueba el ruteo: A1 = tus cascos, B1 = lo que captura OBS.');
  log('  · En Windows, manda cada app a su entrada (Configuración de sonido):');
  log('      Juego/Sistema → "Voicemeeter Input (VAIO)"');
  log('      Música/Navegador/Discord → "Voicemeeter Aux Input"');
  log('  · En OBS añade una "Captura de audio" del dispositivo "Voicemeeter Out B1".');
  log('  · Controla los silencios desde el Stream Deck: npm run setup:streamdeck');
  log('');
}

try {
  main();
} catch (err) {
  console.error(`\n${c('31', '✗ Error en el setup de Voicemeeter:')} ${err.message}\n`);
  process.exit(1);
}
