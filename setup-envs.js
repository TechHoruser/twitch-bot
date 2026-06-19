#!/usr/bin/env node
/**
 * Asistente interactivo de variables de entorno.
 *
 * Solo configura los .env.local (no instala dependencias ni crea carpetas).
 * Es idempotente: vuelve a ejecutarlo cuando quieras; Enter mantiene el valor actual.
 *
 *   apps/bot/.env.local  — credenciales Twitch, Discord, ajedrez, Jamendo, OpenRouter
 *   apps/web/.env.local  — overlay, webcam, OBS websocket, y propagación del bot
 *
 * Flags:
 *   --no-prompt   No pregunta; solo propaga vars del bot a la web (útil en CI).
 *   --help        Muestra esta ayuda.
 */
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const args = process.argv.slice(2);
const interactive =
  args.includes('--prompt') ||
  (Boolean(process.stdin.isTTY) && !args.includes('--no-prompt'));

// --- helpers ----------------------------------------------------------------
const c = (code, s) => `\x1b[${code}m${s}\x1b[0m`;
const log = (...a) => console.log(...a);
const section = (title) => log(`\n${c('1;36', `── ${title} ──`)}`);

const readFile = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
const getVar = (content, key) => {
  const m = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : '';
};
function upsert(content, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) return content.replace(re, `${key}=${value}`);
  if (content && !content.endsWith('\n')) content += '\n';
  return content + `${key}=${value}\n`;
}
function writeVars(file, vars) {
  let content = readFile(file);
  for (const [k, v] of Object.entries(vars)) content = upsert(content, k, v);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// --- definición de campos ---------------------------------------------------
// Cada campo puede llevar `file: 'bot' | 'web'` (por defecto 'bot').
const FIELDS = [
  // ── Twitch ──
  {
    key: 'TWITCH_CHANNEL_NAME',
    label: 'Nombre del canal de Twitch (en minúsculas)',
    tip: () => 'El nombre de tu canal, tal cual en twitch.tv/<canal>.',
  },
  {
    key: 'TWITCH_BOT_USERNAME',
    label: 'Usuario de la cuenta que enviará los mensajes del bot',
    tip: () => 'Puede ser tu propio canal o una cuenta de bot dedicada.',
  },
  {
    key: 'TWITCH_CLIENT_ID',
    label: 'Client ID de la aplicación de Twitch',
    tip: () =>
      'Crea una app en https://dev.twitch.tv/console/apps\n' +
      '       (OAuth Redirect URL: http://localhost · Categoría: Aplicación personalizada)\n' +
      '       y copia el "Client ID".',
  },
  {
    key: 'TWITCH_OAUTH_TOKEN',
    label: 'Token OAuth de Twitch (SIN el prefijo "oauth:")',
    secret: true,
    tip: (v) =>
      'Abre esta URL en el navegador, acepta, y copia el access_token del hash:\n' +
      `       https://id.twitch.tv/oauth2/authorize?client_id=${v.TWITCH_CLIENT_ID || 'TU_CLIENT_ID'}` +
      '&redirect_uri=http://localhost&response_type=token' +
      '&scope=chat:edit+chat:read+channel:moderate+moderator:manage:banned_users+moderator:manage:chat_messages+moderator:manage:automod+moderator:read:followers+channel:manage:broadcast+moderator:manage:announcements',
  },
  {
    key: 'DISCORD_LINK',
    label: 'Enlace de invitación a tu servidor de Discord',
    tip: () => 'Discord → Ajustes del servidor → Invitaciones.',
  },

  // ── Módulo de ajedrez (opcional) ──
  {
    key: 'CHESS_PROVIDER',
    label: 'Proveedor de ajedrez: lichess | chesscom  (opcional)',
    tip: () =>
      'Solo para directos de ajedrez. "lichess" habilita además el overlay /tv.\n' +
      '       Déjalo vacío si no usas el módulo de ajedrez. Por defecto: lichess.',
  },
  {
    key: 'LICHESS_PROFILE_LINK',
    label: 'URL de tu perfil de Lichess  (si usas lichess)',
    tip: () => 'Ej.: https://lichess.org/@/TU_USUARIO',
  },
  {
    key: 'LICHESS_TEAM_LINK',
    label: 'URL de tu equipo de Lichess  (si usas lichess)',
    tip: () => 'Ej.: https://lichess.org/team/TU_EQUIPO',
  },
  {
    key: 'LICHESS_TV_USER',
    label: 'Tu usuario de Lichess para el overlay /tv  (si usas lichess)',
    tip: () => 'Solo el nombre de usuario. La partida en vivo de esta cuenta se emite en /tv.',
  },
  {
    key: 'CHESSCOM_PROFILE_LINK',
    label: 'URL de tu perfil de Chess.com  (si usas chesscom)',
    tip: () => 'Ej.: https://www.chess.com/member/TU_USUARIO',
  },
  {
    key: 'CHESSCOM_CLUB_LINK',
    label: 'URL de tu club de Chess.com  (si usas chesscom)',
    tip: () => 'Ej.: https://www.chess.com/club/TU_CLUB',
  },

  // ── Música ──
  {
    key: 'JAMENDO_CLIENT_ID',
    label: 'Client ID de Jamendo  (música libre, opcional)',
    tip: () =>
      'Para `npm run setup:music` y la descarga desde /admin.\n' +
      '       Client ID gratuito en https://devportal.jamendo.com/',
  },

  // ── Moderación IA ──
  {
    key: 'OPENROUTER_API_KEY',
    label: 'API Key de OpenRouter  (filtro IA de mensajes, opcional)',
    secret: true,
    tip: () =>
      'Para el triaje automático de mensajes retenidos en /admin.\n' +
      '       Clave gratuita (con cuota) en https://openrouter.ai/keys\n' +
      '       Déjalo vacío para desactivar el filtro IA.',
  },
  {
    key: 'OPENROUTER_MODEL',
    label: 'Modelo de OpenRouter a usar  (opcional)',
    tip: () =>
      'Por defecto: google/gemini-2.0-flash-exp:free\n' +
      '       Listado de modelos: https://openrouter.ai/models',
  },

  // ── Web: overlay y pantallas ──
  {
    key: 'NEXT_PUBLIC_STREAM_HANDLE',
    label: 'Tu handle/alias para las pantallas del overlay  (opcional)',
    file: 'web',
    tip: () => 'Aparece en las pantallas de inicio/pausa. Por defecto: TU_CANAL.',
  },
  {
    key: 'NEXT_PUBLIC_COUNTDOWN_MINUTES',
    label: 'Minutos de la cuenta atrás de "Empezamos pronto"  (opcional)',
    file: 'web',
    tip: () => 'Número entero. Por defecto: 5.',
  },
  {
    key: 'NEXT_PUBLIC_CAM_DEVICE_ID',
    label: 'deviceId de la webcam en el overlay  (opcional)',
    file: 'web',
    tip: () =>
      'Si tienes varias cámaras y quieres forzar una concreta.\n' +
      '       Déjalo vacío para usar la predeterminada del sistema.',
  },

  // ── Web: OBS websocket ──
  {
    key: 'OBS_WEBSOCKET_URL',
    label: 'URL del websocket de OBS  (panel Audio, opcional)',
    file: 'web',
    tip: () => 'Por defecto: ws://127.0.0.1:4455\n       Requiere obs-websocket activado en OBS (Herramientas → obs-websocket).',
  },
  {
    key: 'OBS_WEBSOCKET_PASSWORD',
    label: 'Contraseña del websocket de OBS  (opcional)',
    secret: true,
    file: 'web',
    tip: () => 'Déjala vacía si no pusiste contraseña en obs-websocket.',
  },
];

// --- lógica de preguntas ----------------------------------------------------
async function askFields(fields, initialValues) {
  const values = { ...initialValues };
  log('\n  Pulsa Enter para mantener el valor actual.\n');

  const rl = readline.createInterface({ input: process.stdin });
  const lines = rl[Symbol.asyncIterator]();
  try {
    for (const field of fields) {
      const current = values[field.key] || '';
      log(`  ${c('36', field.key)} — ${field.label}`);
      log(`     ${c('90', field.tip(values))}`);
      const shown = current ? (field.secret ? '••• definido •••' : current) : 'vacío';
      process.stdout.write(`     valor [${shown}]: `);
      const next = await lines.next();
      if (next.done) { log(''); break; }
      const answer = String(next.value).trim();
      if (answer) values[field.key] = answer;
      log('');
    }
  } finally {
    rl.close();
  }
  return values;
}

// --- main -------------------------------------------------------------------
async function main() {
  if (args.includes('--help')) {
    log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^[\s\S]*?\n \*/, ' *'));
    process.exit(0);
  }

  log(c('1', '\n🔧  Configuración de variables de entorno — Stream Toolkit\n'));

  const botEnv  = path.join(ROOT, 'apps', 'bot', '.env.local');
  const webEnv  = path.join(ROOT, 'apps', 'web', '.env.local');

  const botFields = FIELDS.filter((f) => !f.file || f.file === 'bot');
  const webFields = FIELDS.filter((f) => f.file === 'web');

  // Leer valores actuales
  const botContent = readFile(botEnv);
  const webContent = readFile(webEnv);

  const botValues = {};
  for (const f of botFields) botValues[f.key] = getVar(botContent, f.key);
  const webValues = {};
  for (const f of webFields) webValues[f.key] = getVar(webContent, f.key);

  if (interactive) {
    section('Bot — credenciales Twitch, Discord, ajedrez, música, IA');
    const newBot = await askFields(botFields, botValues);
    writeVars(botEnv, newBot);

    // Reabrir stdin para la segunda ronda
    const rl2 = readline.createInterface({ input: process.stdin });
    rl2.close();

    section('Web — overlay, webcam, OBS websocket');
    const newWeb = await askFields(webFields, webValues);
    writeVars(webEnv, newWeb);
  }

  // Propagar vars del bot a la web (siempre, interactivo o no)
  const freshBot = readFile(botEnv);
  const propagate = {
    TWITCH_CHANNEL_NAME:       getVar(freshBot, 'TWITCH_CHANNEL_NAME'),
    TWITCH_CLIENT_ID:          getVar(freshBot, 'TWITCH_CLIENT_ID'),
    TWITCH_OAUTH_TOKEN:        getVar(freshBot, 'TWITCH_OAUTH_TOKEN'),
    LICHESS_TV_USER:           getVar(freshBot, 'LICHESS_TV_USER'),
    JAMENDO_CLIENT_ID:         getVar(freshBot, 'JAMENDO_CLIENT_ID'),
    OPENROUTER_API_KEY:        getVar(freshBot, 'OPENROUTER_API_KEY'),
    OPENROUTER_MODEL:          getVar(freshBot, 'OPENROUTER_MODEL') || 'google/gemini-2.0-flash-exp:free',
    // Variable pública para el chat del panel /admin
    NEXT_PUBLIC_TWITCH_CHANNEL: getVar(freshBot, 'TWITCH_CHANNEL_NAME'),
  };
  writeVars(webEnv, propagate);

  log(c('32', '\n✅  .env.local actualizados.\n'));
  log(`  apps/bot/.env.local  → ${botEnv}`);
  log(`  apps/web/.env.local  → ${webEnv}`);
  log('\n  Reinicia los procesos (Ctrl+C y npm run dev) para que los cambios surtan efecto.\n');
}

main().catch((err) => {
  console.error(`\n${c('31', '✗ Error:')} ${err.message}\n`);
  process.exit(1);
});
