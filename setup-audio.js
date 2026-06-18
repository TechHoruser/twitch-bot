#!/usr/bin/env node
/**
 * Asistente de audio (VB-Cable + OBS como mezclador) para el toolkit de Twitch.
 *
 * No se pueden crear dispositivos de audio virtuales desde una app: eso lo hace un
 * driver. La estrategia es: cada app → su VB-Cable; OBS captura cada `CABLE Output`
 * como fuente de audio; y el balance se hace sobre esas fuentes desde /admin (vía
 * obs-websocket). Este script:
 *   1. Imprime la guía de VB-Cable y ruteo.
 *   2. Crea en OBS (por websocket) las fuentes de audio "Juego / Música / Discord"
 *      con monitorización "Monitor and Output", listas para que les asignes su
 *      CABLE Output y las balancees desde /admin.
 *
 * Necesita OBS abierto con Herramientas ▸ obs-websocket activado.
 *
 * Flags:
 *   --url <ws://…>      URL del websocket de OBS (por defecto ws://127.0.0.1:4455).
 *   --password <pass>   Contraseña de obs-websocket (si la has puesto).
 *   --juego/--musica/--discord <nombre>  Renombra las fuentes a crear.
 *   --dry-run           No crea nada; solo muestra qué haría.
 *   --help              Muestra esta ayuda.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');

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

function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function resolveWs() {
  const web = readEnv(path.join(ROOT, 'apps', 'web', '.env.local'));
  const bot = readEnv(path.join(ROOT, 'apps', 'bot', '.env.local'));
  const env = { ...bot, ...web };
  return {
    url: flagValue('--url') || process.env.OBS_WEBSOCKET_URL || env.OBS_WEBSOCKET_URL || 'ws://127.0.0.1:4455',
    password: flagValue('--password') || process.env.OBS_WEBSOCKET_PASSWORD || env.OBS_WEBSOCKET_PASSWORD || undefined,
  };
}

async function main() {
  log(c('1', '\n🎚️  Setup de audio — VB-Cable + OBS como mezclador\n'));
  if (DRY) warn('Modo --dry-run: no se creará nada en OBS.');

  const sources = [
    flagValue('--juego') || '🎮 Juego',
    flagValue('--musica') || '🎵 Música',
    flagValue('--discord') || '🎧 Discord',
  ];

  // 1) Guía VB-Cable
  step(1, 2, 'Guía de VB-Cable y ruteo (una vez):');
  info('Instala VB-Cable (https://vb-audio.com/Cable/). Para varias fuentes, añade');
  info('los packs "VB-Cable A+B" y "C+D" (más cables: CABLE, CABLE A, CABLE B…).');
  info('Windows ▸ Configuración de sonido ▸ Volumen de aplicaciones y preferencias');
  info('de dispositivo: manda la salida de cada app a un cable distinto');
  info('(Discord → CABLE, juego → CABLE A, música → CABLE B…).');
  info('En OBS ▸ Ajustes ▸ Audio ▸ Dispositivo de monitorización = tus auriculares.');
  info('En OBS ▸ Herramientas ▸ obs-websocket Server Settings: activa el servidor.');

  // 2) Crear fuentes en OBS
  step(2, 2, 'Creando fuentes de audio en OBS (websocket)...');
  const { url, password } = resolveWs();
  info(`OBS websocket: ${url}`);

  try {
    const { default: OBSWebSocket } = await import('obs-websocket-js');
    const obs = new OBSWebSocket();
    await obs.connect(url, password);

    const { currentProgramSceneName } = await obs.call('GetCurrentProgramScene');
    const { inputs } = await obs.call('GetInputList');
    const existing = new Set(inputs.map((i) => i.inputName));

    for (const name of sources) {
      if (existing.has(name)) { info(`ya existe: ${name}`); continue; }
      if (DRY) { info(`(crearía) ${name}`); continue; }
      await obs.call('CreateInput', {
        sceneName: currentProgramSceneName,
        inputName: name,
        inputKind: 'wasapi_input_capture',
        inputSettings: {},
        sceneItemEnabled: true,
      });
      await obs.call('SetInputAudioMonitorType', {
        inputName: name,
        monitorType: 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT',
      });
      ok(`creada: ${name}  (monitor + salida)`);
    }

    await obs.disconnect();
    log(c('1', '\n✅  Fuentes listas.\n'));
    log('Próximos pasos:');
    log('  · En OBS, abre las propiedades de cada fuente y elige su "CABLE … Output".');
    log('  · Balancea y silencia desde el panel: /admin ▸ pestaña Audio.');
    log('  · Recuerda configurar OBS_WEBSOCKET_URL/PASSWORD en apps/web/.env.local');
    log('    si pusiste contraseña en obs-websocket.');
    log('');
  } catch (e) {
    warn(`No se pudo conectar a OBS (${e.message}).`);
    warn('Abre OBS y activa Herramientas ▸ obs-websocket Server Settings; reintenta.');
    log('');
  }
}

main().catch((err) => {
  console.error(`\n${c('31', '✗ Error en el setup de audio:')} ${err.message}\n`);
  process.exit(1);
});
