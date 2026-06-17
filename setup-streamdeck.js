#!/usr/bin/env node
/**
 * Asistente de setup de Elgato Stream Deck para el monorepo del bot de ajedrez.
 *
 * Carga un perfil de Stream Deck dentro de la aplicación oficial de Elgato,
 * copiándolo a su carpeta de perfiles (ProfilesV2). El perfil incluye botones
 * que abren, de un toque, las piezas del stream: el overlay de OBS, el overlay
 * de TV de Lichess, el panel de admin, el servidor de overlays, tu Discord, tu
 * canal de Twitch y tu perfil/club de ajedrez.
 *
 * El perfil está pensado para el Stream Deck de 15 teclas (3x5): la fila de
 * arriba abre las piezas del stream (overlay de OBS, TV de Lichess, panel admin,
 * servidor de overlays, Twitch); la del medio agrupa comunidad y herramientas
 * (Discord, perfil/club de ajedrez, Twitch Dev y abrir Voicemeeter); y la fila
 * de abajo controla el audio de Voicemeeter (silenciar Micro, Juego, Música,
 * Cascos A1 y el bus B1 que va al stream) mediante el plugin de Voicemeeter para
 * Stream Deck.
 *
 * Las URLs del perfil se rellenan a partir de tu configuración real
 * (apps/bot/.env.local y apps/web/.env.local) más las rutas locales por defecto
 * (localhost:3000 / :4000). Es idempotente: reutiliza siempre el mismo perfil,
 * así que volver a ejecutarlo lo actualiza en lugar de duplicarlo, y no usa
 * dependencias externas (solo módulos de Node).
 *
 * Flags:
 *   --device <modelo>     Modelo de Stream Deck (DeviceModel). Por defecto el
 *                         clásico de 15 teclas (20GAA9901). Otros comunes:
 *                         20GAT9901 (Mini), 20GBA9901 (XL).
 *   --profiles-dir <ruta> Fuerza la carpeta ProfilesV2 de Stream Deck.
 *   --vm-action <uuid>    UUID de la acción del plugin de Voicemeeter para los
 *                         botones de audio (por defecto el "Advanced Toggle" de
 *                         BarRaider).
 *   --vm-exe <ruta>       Ruta del ejecutable de Voicemeeter para el botón
 *                         "Abrir Voicemeeter" (por defecto Banana en su ruta
 *                         habitual).
 *   --dry-run             No escribe nada; solo muestra lo que haría.
 *   --help                Muestra esta ayuda.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const args = process.argv.slice(2);
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

const DRY = args.includes('--dry-run');

// UUID fijo del perfil: garantiza idempotencia (siempre la misma carpeta).
const PROFILE_UUID = 'C4E55A1E-7B3D-4F2A-9C6E-0A1B2C3D4E5F';
const DEFAULT_DEVICE = '20GAA9901'; // Stream Deck (15 teclas) / MK.2

const TEMPLATE = path.join(
  ROOT, 'apps', 'overlays', 'streamdeck', 'Chess-Stream.sdProfile', 'manifest.json',
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

// Lee KEY=value de un .env (vacío si no existe).
function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

// Carpeta ProfilesV2 de la app oficial de Stream Deck para este sistema.
function resolveProfilesDir() {
  const forced = flagValue('--profiles-dir');
  if (forced) return forced;

  const home = os.homedir();
  if (isWin) {
    const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appdata, 'Elgato', 'StreamDeck', 'ProfilesV2');
  }
  if (isMac) {
    return path.join(
      home, 'Library', 'Application Support', 'com.elgato.StreamDeck', 'ProfilesV2',
    );
  }
  return null; // Linux: la app oficial de Elgato no existe.
}

// Construye el mapa de sustituciones {{TOKEN}} -> valor a partir del entorno.
function buildReplacements() {
  const bot = readEnv(path.join(ROOT, 'apps', 'bot', '.env.local'));
  const web = readEnv(path.join(ROOT, 'apps', 'web', '.env.local'));
  const env = { ...bot, ...web };

  const provider = (env.CHESS_PROVIDER || 'lichess').toLowerCase();
  const channel = env.TWITCH_CHANNEL_NAME || '';

  // Ruta del ejecutable de Voicemeeter. Va dentro de una cadena JSON, así que
  // escapamos los backslashes de Windows (\ -> \\) para no romper el manifest.
  const vmExe = flagValue('--vm-exe')
    || 'C:\\Program Files (x86)\\VB\\Voicemeeter\\voicemeeterpro.exe';
  const vmExeJson = vmExe.replace(/\\/g, '\\\\');

  const chessProfile = provider === 'chesscom'
    ? env.CHESSCOM_PROFILE_LINK
    : env.LICHESS_PROFILE_LINK;
  const chessClub = provider === 'chesscom'
    ? env.CHESSCOM_CLUB_LINK
    : env.LICHESS_TEAM_LINK;

  return {
    DEVICE_MODEL: flagValue('--device') || DEFAULT_DEVICE,
    URL_OVERLAY: 'http://localhost:3000',
    URL_TV: 'http://localhost:3000/tv',
    URL_ADMIN: 'http://localhost:3000/admin',
    URL_OVERLAYS: 'http://localhost:4000',
    URL_TWITCH: channel ? `https://twitch.tv/${channel}` : 'https://twitch.tv',
    URL_DISCORD: env.DISCORD_LINK || 'https://discord.com',
    URL_CHESS: chessProfile || (provider === 'chesscom' ? 'https://chess.com' : 'https://lichess.org'),
    URL_CLUB: chessClub || (provider === 'chesscom' ? 'https://chess.com/clubs' : 'https://lichess.org/team'),
    URL_TWITCH_CONSOLE: 'https://dev.twitch.tv/console',
    // Botones de audio (plugin de Voicemeeter para Stream Deck). Por defecto el
    // "Advanced Toggle" de BarRaider; cámbialo con --vm-action si usas otro.
    VM_ACTION: flagValue('--vm-action') || 'com.barraider.vmmacros.advancedtoggleaction',
    // Ejecutable de Voicemeeter Banana (ya escapado para el JSON del manifest).
    VM_EXE: vmExeJson,
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
  log(c('1', '\n🎛️  Setup de Stream Deck — perfil del stream de ajedrez\n'));
  if (DRY) warn('Modo --dry-run: no se escribirá ningún archivo.');

  // 1) Plantilla del perfil
  step(1, 3, 'Leyendo la plantilla del perfil...');
  if (!fs.existsSync(TEMPLATE)) {
    throw new Error(`No existe la plantilla ${TEMPLATE}`);
  }
  const repl = buildReplacements();
  const manifest = applyTemplate(fs.readFileSync(TEMPLATE, 'utf8'), repl);
  // Validamos que el resultado sea JSON correcto.
  JSON.parse(manifest);
  ok('Plantilla cargada y rellenada con tu configuración');
  info(`Twitch:  ${repl.URL_TWITCH}`);
  info(`Discord: ${repl.URL_DISCORD}`);
  info(`Ajedrez: ${repl.URL_CHESS}`);
  info(`Audio:   fila inferior de Voicemeeter (acción ${repl.VM_ACTION})`);
  info(`Dispositivo (DeviceModel): ${repl.DEVICE_MODEL}`);

  // 2) Carpeta de perfiles
  step(2, 3, 'Localizando la carpeta de perfiles de Stream Deck...');
  const profilesDir = resolveProfilesDir();
  if (!profilesDir) {
    warn('La app oficial de Stream Deck (Elgato) no está disponible en Linux.');
    warn('El perfil se ha generado en apps/overlays/streamdeck/. Para Linux usa');
    warn('StreamController / streamdeck-ui e impórtalo manualmente, o ejecuta este');
    warn('script en Windows/macOS (o pasa --profiles-dir <ruta>).');
    // Aun así dejamos el manifest renderizado junto a la plantilla por comodidad.
    const out = path.join(ROOT, 'apps', 'overlays', 'streamdeck', 'Chess-Stream.rendered.json');
    if (!DRY) {
      fs.writeFileSync(out, manifest);
      ok(`Perfil renderizado: ${out}`);
    } else {
      info(`(se generaría: ${out})`);
    }
    return;
  }
  if (!fs.existsSync(profilesDir)) {
    warn(`No encontré ProfilesV2 en ${profilesDir}.`);
    warn('¿Está instalada la app de Stream Deck? Se creará la carpeta igualmente.');
  }
  ok(`Carpeta de perfiles: ${profilesDir}`);

  // 3) Instalar el perfil
  step(3, 3, 'Instalando el perfil...');
  const profileDir = path.join(profilesDir, `${PROFILE_UUID}.sdProfile`);
  const manifestPath = path.join(profileDir, 'manifest.json');
  if (!DRY) fs.mkdirSync(profileDir, { recursive: true });
  const bak = backupOnce(manifestPath);
  if (bak) info(`copia de seguridad: ${path.basename(bak)}`);
  if (!DRY) fs.writeFileSync(manifestPath, manifest);
  ok(`Perfil instalado: ${profileDir}`);

  log(c('1', '\n✅  Stream Deck configurado.\n'));
  log('Próximos pasos:');
  log(`  · ${c('33', 'Cierra y vuelve a abrir')} la app de Stream Deck para que lo cargue.`);
  log('  · Aparecerá el perfil "Chess Stream" (3x5) en el selector de perfiles.');
  log('  · Si tu Stream Deck no es de 15 teclas, vuelve a ejecutar con --device <modelo>.');
  log('  · Recuerda arrancar el stack para que los botones de localhost funcionen:');
  log(`      ${c('36', 'npm run web:dev')}  y  ${c('36', 'npm run overlays')}`);
  log('  · Fila de audio: instala el plugin gratis de Voicemeeter para Stream Deck');
  log('    (Store de Elgato, "VoiceMeeter" de BarRaider) y prepara el audio con');
  log(`      ${c('36', 'npm run setup:voicemeeter')}`);
  log('  · Cada botón de audio trae su acción y etiqueta; si tu plugin usa otra');
  log('    acción, vuelve a ejecutar con --vm-action <uuid> o ajústala en su panel.');
  log('');
}

try {
  main();
} catch (err) {
  console.error(`\n${c('31', '✗ Error en el setup de Stream Deck:')} ${err.message}\n`);
  process.exit(1);
}
