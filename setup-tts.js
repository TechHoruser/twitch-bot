#!/usr/bin/env node
/**
 * Setup de la voz natural (TTS) para la lectura del chat.
 *
 * Descarga Piper (motor de síntesis de voz neuronal, local y gratuito) y una
 * voz en español, y los deja configurados para que el panel /admin lea el chat
 * con una voz mucho más natural que la del navegador.
 *
 * No necesita Python: usa el binario nativo de Piper, que la web lanza como
 * subproceso desde la ruta /api/admin/tts.
 *
 * Es idempotente: vuelve a ejecutarlo cuando quieras. Si el binario o la voz ya
 * están, no los vuelve a descargar; puedes añadir más voces ejecutándolo otra vez.
 *
 * Qué hace:
 *   1. Descarga el binario de Piper para tu sistema (si no está).
 *   2. Te deja elegir una voz en español y la descarga.
 *   3. Escribe PIPER_BIN / PIPER_VOICES_DIR / PIPER_MODEL en apps/web/.env.local.
 *
 * Flags:
 *   --voice <clave>   Usa esa voz sin preguntar (ver --list).
 *   --list            Lista las voces disponibles y sale.
 *   --no-prompt       No pregunta; usa la voz por defecto (es_ES-davefx-medium).
 *   --help            Muestra esta ayuda.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const ROOT = __dirname;
const args = process.argv.slice(2);
const isWin = process.platform === 'win32';
const interactive =
  !args.includes('--no-prompt') &&
  (args.includes('--prompt') || Boolean(process.stdin.isTTY));

// --- salida -----------------------------------------------------------------
const c = (code, s) => `\x1b[${code}m${s}\x1b[0m`;
const log = (...a) => console.log(...a);
const step = (n, msg) => log(`\n${c('36', `[${n}/3]`)} ${msg}`);
const ok = (msg) => log(`  ${c('32', '✓')} ${msg}`);
const warn = (msg) => log(`  ${c('33', '!')} ${msg}`);

// --- catálogo de voces (URLs verificadas en huggingface.co/rhasspy/piper-voices) ---
// file = `${lang}-${name}-${quality}`; la ruta sigue siempre el mismo patrón.
const VOICES = [
  { key: 'es_ES-davefx-medium',   lang: 'es_ES', name: 'davefx',   quality: 'medium', label: 'España · davefx (masculina, calidad media) — recomendada' },
  { key: 'es_ES-sharvard-medium', lang: 'es_ES', name: 'sharvard', quality: 'medium', label: 'España · sharvard (calidad media)' },
  { key: 'es_ES-carlfm-x_low',    lang: 'es_ES', name: 'carlfm',   quality: 'x_low',  label: 'España · carlfm (ligera, x_low — la más rápida)' },
  { key: 'es_MX-claude-high',     lang: 'es_MX', name: 'claude',   quality: 'high',   label: 'México · claude (calidad alta)' },
];
const DEFAULT_VOICE = 'es_ES-davefx-medium';

const HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/main';
const voiceFile = (v) => `${v.lang}-${v.name}-${v.quality}`; // sin extensión
const voiceUrl = (v, ext) => `${HF}/${v.lang.split('_')[0]}/${v.lang}/${v.name}/${v.quality}/${voiceFile(v)}.onnx${ext}`;

// Binario de Piper por plataforma (release clásico con ejecutable nativo).
const PIPER_RELEASE = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2';
function binaryAsset() {
  const a = process.arch;
  if (isWin) return { url: `${PIPER_RELEASE}/piper_windows_amd64.zip`, zip: true };
  if (process.platform === 'darwin') {
    return { url: `${PIPER_RELEASE}/piper_macos_${a === 'arm64' ? 'aarch64' : 'x64'}.tar.gz`, zip: false };
  }
  // linux
  const map = { x64: 'x86_64', arm64: 'aarch64', arm: 'armv7l' };
  return { url: `${PIPER_RELEASE}/piper_linux_${map[a] || 'x86_64'}.tar.gz`, zip: false };
}

// --- descargas (con barra de progreso, siguiendo redirecciones) -------------
async function download(url, dest, label) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} al descargar ${url}`);
  const total = Number(res.headers.get('content-length')) || 0;
  let done = 0, lastPct = -1;
  const reader = Readable.fromWeb(res.body);
  reader.on('data', (chunk) => {
    done += chunk.length;
    const pct = total ? Math.floor((done / total) * 100) : -1;
    if (pct !== lastPct && pct % 5 === 0) {
      const mb = (done / 1e6).toFixed(1);
      process.stdout.write(`\r     ${label}: ${total ? `${pct}%` : `${mb} MB`}    `);
      lastPct = pct;
    }
  });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await pipeline(reader, fs.createWriteStream(dest));
  process.stdout.write(`\r     ${label}: completado            \n`);
}

// --- extracción del binario -------------------------------------------------
function extract(archive, destDir, isZip) {
  fs.mkdirSync(destDir, { recursive: true });
  let res;
  if (isZip && isWin) {
    res = spawnSync('powershell', ['-NoProfile', '-Command',
      `Expand-Archive -LiteralPath '${archive}' -DestinationPath '${destDir}' -Force`],
      { stdio: 'inherit' });
  } else {
    // tar de Windows 10+ también extrae .zip; en *nix usamos tar -xzf.
    res = spawnSync('tar', [isZip ? '-xf' : '-xzf', archive, '-C', destDir], { stdio: 'inherit' });
  }
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`No se pudo extraer ${archive}`);
}

// Busca el ejecutable de piper tras la extracción (el zip/tar trae una carpeta piper/).
function findBin(home) {
  const exe = isWin ? 'piper.exe' : 'piper';
  const candidates = [path.join(home, 'piper', exe), path.join(home, exe)];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  // Último recurso: búsqueda superficial.
  const walk = (dir, depth) => {
    if (depth > 3) return null;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isFile() && e.name === exe) return full;
      if (e.isDirectory()) { const found = walk(full, depth + 1); if (found) return found; }
    }
    return null;
  };
  return fs.existsSync(home) ? walk(home, 0) : null;
}

// --- helpers de .env --------------------------------------------------------
const toEnvPath = (p) => p.split(path.sep).join('/'); // sin backslashes en .env
function upsertEnv(file, vars) {
  let content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`^${k}=.*$`, 'm');
    if (re.test(content)) content = content.replace(re, `${k}=${v}`);
    else { if (content && !content.endsWith('\n')) content += '\n'; content += `${k}=${v}\n`; }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// --- selección de voz -------------------------------------------------------
async function pickVoice() {
  const flag = args.indexOf('--voice');
  if (flag !== -1 && args[flag + 1]) {
    const v = VOICES.find((x) => x.key === args[flag + 1]);
    if (!v) throw new Error(`Voz desconocida: ${args[flag + 1]}. Usa --list para verlas.`);
    return v;
  }
  if (!interactive) return VOICES.find((v) => v.key === DEFAULT_VOICE);

  log('\n  Voces en español disponibles:\n');
  VOICES.forEach((v, i) => log(`    ${c('36', String(i + 1))}. ${v.label}`));
  const def = VOICES.findIndex((v) => v.key === DEFAULT_VOICE) + 1;
  process.stdout.write(`\n  Elige una voz [${def}]: `);

  const rl = readline.createInterface({ input: process.stdin });
  const lines = rl[Symbol.asyncIterator]();
  try {
    const next = await lines.next();
    const answer = next.done ? '' : String(next.value).trim();
    const idx = answer ? Number(answer) - 1 : def - 1;
    return VOICES[idx] || VOICES[def - 1];
  } finally {
    rl.close();
  }
}

// --- main -------------------------------------------------------------------
async function main() {
  if (args.includes('--help')) {
    log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^[\s\S]*?\n \*/, ' *'));
    return;
  }
  if (args.includes('--list')) {
    log('\n  Voces disponibles (--voice <clave>):\n');
    VOICES.forEach((v) => log(`    ${c('36', v.key.padEnd(22))} ${v.label}`));
    log('');
    return;
  }

  log(c('1', '\n🔊  Setup de voz natural (Piper) — lectura del chat\n'));

  if (typeof fetch !== 'function') {
    throw new Error('Necesitas Node >= 18 (fetch no está disponible en esta versión).');
  }

  const home = path.join(ROOT, 'tools', 'piper');
  const voicesDir = path.join(home, 'voices');

  // 1) Binario de Piper
  step(1, 'Binario de Piper...');
  let bin = findBin(home);
  if (bin) {
    ok(`Ya instalado: ${toEnvPath(bin)}`);
  } else {
    const asset = binaryAsset();
    const archive = path.join(home, path.basename(asset.url));
    log(`  Descargando Piper para ${process.platform}/${process.arch}...`);
    await download(asset.url, archive, 'piper');
    extract(archive, home, asset.zip);
    fs.rmSync(archive, { force: true });
    bin = findBin(home);
    if (!bin) throw new Error('No se encontró el ejecutable de Piper tras extraer el paquete.');
    if (!isWin) { try { fs.chmodSync(bin, 0o755); } catch { /* da igual */ } }
    ok(`Instalado en ${toEnvPath(bin)}`);
  }

  // 2) Voz en español
  step(2, 'Voz en español...');
  const voice = await pickVoice();
  const modelName = `${voiceFile(voice)}.onnx`;
  const onnx = path.join(voicesDir, modelName);
  const json = `${onnx}.json`;
  if (fs.existsSync(onnx) && fs.existsSync(json)) {
    ok(`Ya descargada: ${voice.key}`);
  } else {
    log(`  Descargando voz ${c('36', voice.key)}...`);
    await download(voiceUrl(voice, ''), onnx, `${voice.key}.onnx`);
    await download(voiceUrl(voice, '.json'), json, `${voice.key}.onnx.json`);
    ok(`Voz lista: ${voice.key}`);
  }

  // 3) Configuración en apps/web/.env.local
  step(3, 'Configurando apps/web/.env.local...');
  const webEnv = path.join(ROOT, 'apps', 'web', '.env.local');
  upsertEnv(webEnv, {
    PIPER_BIN: toEnvPath(bin),
    PIPER_VOICES_DIR: toEnvPath(voicesDir),
    PIPER_MODEL: modelName,
  });
  ok('PIPER_BIN / PIPER_VOICES_DIR / PIPER_MODEL escritas');

  log(c('1', '\n✅  Voz natural lista.\n'));
  log('  · Voz por defecto: ' + c('36', voice.key));
  log('  · Añade más voces ejecutando de nuevo:  ' + c('36', 'npm run setup:tts'));
  log('  · ' + c('33', 'Reinicia la web') + ' (Ctrl+C y `npm run web:dev`) para que cargue las variables.');
  log('  · En /admin → ajustes de voz (🔈) elige el motor "Voz natural (Piper)".\n');
}

main().catch((err) => {
  console.error(`\n${c('31', '✗ Error:')} ${err.message}\n`);
  process.exit(1);
});
