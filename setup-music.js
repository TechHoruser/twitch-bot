#!/usr/bin/env node
/**
 * Descargador de música libre (Jamendo) para el toolkit de directos de Twitch.
 *
 * Descarga pistas de Jamendo a `apps/web/public/music/<playlist>/<id>.mp3` y genera
 * el manifiesto `music-library.json` (en DATA_PATH) que consume el reproductor del
 * overlay y el panel /admin. La música de Jamendo es Creative Commons; el widget
 * "sonando ahora" muestra Título — Artista, lo que cubre la atribución CC-BY.
 *
 * Necesita un Client ID gratuito de Jamendo (https://devportal.jamendo.com/).
 * Pásalo con --client-id o ponlo como JAMENDO_CLIENT_ID en apps/web/.env.local o
 * apps/bot/.env.local (lo añade `npm run setup`).
 *
 * Solo usa módulos de Node (fetch nativo, Node >= 20). Es idempotente: salta las
 * pistas ya descargadas y vuelve a generar el manifiesto.
 *
 * Flags:
 *   --client-id <id>     Client ID de Jamendo (si no está en el entorno).
 *   --playlist <nombre>  Procesa solo esa playlist (por defecto: todas).
 *   --tag <tags>         Sobrescribe los tags de Jamendo (p.ej. "lofi+chill").
 *   --limit <N>          Nº de pistas por playlist (por defecto 12).
 *   --dry-run            No descarga ni escribe; solo muestra qué haría.
 *   --help               Muestra esta ayuda.
 */
const fs = require('fs');
const path = require('path');
const { PLAYLISTS, fetchTracks, downloadTrack, toEntry } = require('./packages/common/jamendo');

const ROOT = __dirname;
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');

// --- helpers de salida (mismo estilo que setup-obs.js) ---------------------
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

// DATA_PATH (donde el resto del proyecto guarda los JSON) y Client ID, leídos de
// los .env.local de web/bot, con fallbacks.
function resolveEnv() {
  const web = readEnv(path.join(ROOT, 'apps', 'web', '.env.local'));
  const bot = readEnv(path.join(ROOT, 'apps', 'bot', '.env.local'));
  const merged = { ...bot, ...web };
  const dataPath = process.env.DATA_PATH || merged.DATA_PATH || path.join(ROOT, 'data');
  const clientId = flagValue('--client-id') || process.env.JAMENDO_CLIENT_ID || merged.JAMENDO_CLIENT_ID || '';
  return { dataPath, clientId };
}

async function processPlaylist(name, fuzzytags, limit, clientId, musicDir) {
  const tracks = await fetchTracks({ clientId, fuzzytags, limit });
  info(`${name}: ${tracks.length} descargable(s) (tags: ${fuzzytags})`);

  const dir = path.join(musicDir, name);
  if (!DRY) fs.mkdirSync(dir, { recursive: true });

  const entries = [];
  for (const t of tracks) {
    if (DRY) {
      const e = toEntry(t);
      info(`  (bajaría) ${e.file} — ${e.title} · ${e.artist}`);
      entries.push(e);
      continue;
    }
    try {
      const { entry, skipped } = await downloadTrack(t, dir);
      info(skipped
        ? `  ya estaba: ${entry.file} (${entry.title})`
        : `  ${c('32', '✓')} ${entry.file} — ${entry.title} · ${entry.artist}`);
      entries.push(entry);
    } catch (e) {
      warn(`  falló (${t.name}): ${e.message}`);
    }
  }
  return entries;
}

async function main() {
  log(c('1', '\n🎵  Setup de música — descarga de Jamendo (libre para directo)\n'));
  if (DRY) warn('Modo --dry-run: no se descargará ni escribirá nada.');

  const { dataPath, clientId } = resolveEnv();

  // 1) Client ID
  step(1, 3, 'Comprobando credenciales...');
  if (!clientId) {
    warn('Falta JAMENDO_CLIENT_ID.');
    warn('Crea una app gratis en https://devportal.jamendo.com/ y pon el Client ID');
    warn('en apps/web/.env.local (JAMENDO_CLIENT_ID=...) o pásalo con --client-id <id>.');
    process.exit(1);
  }
  ok('Client ID presente');
  info(`Manifiesto: ${path.join(dataPath, 'music-library.json')}`);

  // 2) Selección de playlists
  step(2, 3, 'Descargando pistas...');
  const only = flagValue('--playlist');
  const tagOverride = flagValue('--tag');
  const limit = Number(flagValue('--limit')) || 12;

  let selected;
  if (only) {
    selected = { [only]: tagOverride || PLAYLISTS[only] || only };
  } else if (tagOverride) {
    selected = { custom: tagOverride };
  } else {
    selected = PLAYLISTS;
  }

  const musicDir = path.join(ROOT, 'apps', 'web', 'public', 'music');
  if (!DRY) fs.mkdirSync(musicDir, { recursive: true });

  // Manifiesto existente (acumulamos por playlist para no perder las demás).
  const libPath = path.join(dataPath, 'music-library.json');
  let library = { playlists: {} };
  try { library = JSON.parse(fs.readFileSync(libPath, 'utf8')); } catch { /* nuevo */ }
  if (!library.playlists) library.playlists = {};

  for (const [name, fuzzytags] of Object.entries(selected)) {
    const entries = await processPlaylist(name, fuzzytags, limit, clientId, musicDir);
    if (entries.length) library.playlists[name] = entries;
  }

  // 3) Manifiesto
  step(3, 3, 'Escribiendo el manifiesto...');
  if (!DRY) {
    fs.mkdirSync(dataPath, { recursive: true });
    fs.writeFileSync(libPath, JSON.stringify(library, null, 2));
  }
  const total = Object.values(library.playlists).reduce((n, a) => n + a.length, 0);
  ok(`${Object.keys(library.playlists).length} playlist(s), ${total} pista(s) en el manifiesto`);

  log(c('1', '\n✅  Música preparada.\n'));
  log('Próximos pasos:');
  log(`  · Arranca la web:  ${c('36', 'npm run web:dev')}`);
  log('  · En /admin elige la playlist y dale a ▶ (la música suena en el overlay /).');
  log('  · En OBS, en el Browser Source de localhost:3000, activa');
  log('    "Controlar audio mediante OBS" para que la música llegue al stream.');
  log('');
}

main().catch((err) => {
  console.error(`\n${c('31', '✗ Error en el setup de música:')} ${err.message}\n`);
  process.exit(1);
});
