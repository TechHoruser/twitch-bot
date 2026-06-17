#!/usr/bin/env node
/**
 * Asistente de setup del monorepo del bot de stream de ajedrez.
 *
 * Es idempotente (puedes ejecutarlo varias veces) y no usa dependencias
 * externas: solo módulos de Node. Hace lo siguiente:
 *
 *   1. Comprueba la versión de Node.
 *   2. Instala dependencias de todos los workspaces (npm install).
 *   3. Prepara la carpeta de datos local (data/) y la siembra.
 *   4. Crea apps/bot/.env.local y pregunta (interactivo) por cada variable,
 *      mostrando dónde obtenerla (URLs de Twitch, Discord, Chess.com...).
 *   5. Crea/completa apps/web/.env.local.
 *   6. (Opcional) Instala el navegador de Playwright para los tests e2e.
 *   7. Imprime los próximos pasos.
 *
 * Flags:
 *   --skip-install    No ejecuta `npm install`.
 *   --with-browser    Instala chromium para Playwright (e2e).
 *   --no-prompt       No pregunta por las variables (modo no interactivo / CI).
 *   --prompt          Fuerza el modo interactivo (p.ej. para pipear respuestas).
 *   --help            Muestra esta ayuda.
 */
const { spawnSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const args = process.argv.slice(2);
// Preguntamos si hay terminal interactiva (TTY) y no se pidió --no-prompt; o si
// se fuerza con --prompt (útil para pipear respuestas en scripts).
const interactive =
  args.includes('--prompt') ||
  (Boolean(process.stdin.isTTY) && !args.includes('--no-prompt'));

// --- helpers de salida -----------------------------------------------------
const c = (code, s) => `\x1b[${code}m${s}\x1b[0m`;
const log = (...a) => console.log(...a);
const step = (n, msg) => log(`\n${c('36', `[${n}/6]`)} ${msg}`);
const ok = (msg) => log(`  ${c('32', '✓')} ${msg}`);
const warn = (msg) => log(`  ${c('33', '!')} ${msg}`);

function run(cmd, cmdArgs) {
  // En Windows, npm es npm.cmd y Node (>= 20) exige shell:true para ejecutar
  // ficheros .cmd/.bat con spawn.
  const res = spawnSync(cmd, cmdArgs, { stdio: 'inherit', cwd: ROOT, shell: isWin });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`Comando falló (${res.status}): ${cmd} ${cmdArgs.join(' ')}`);
  }
}

// Garantiza que `KEY=value` exista en un fichero .env. Devuelve qué hizo.
function ensureEnvVar(file, key, value) {
  let content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const re = new RegExp(`^${key}=(.*)$`, 'm');
  const match = content.match(re);
  if (!match) {
    if (content && !content.endsWith('\n')) content += '\n';
    content += `${key}=${value}\n`;
    fs.writeFileSync(file, content);
    return 'added';
  }
  if (match[1].trim() === '') {
    fs.writeFileSync(file, content.replace(re, `${key}=${value}`));
    return 'filled';
  }
  return 'present';
}

function emptyVars(file, keys) {
  const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  return keys.filter((k) => {
    const m = content.match(new RegExp(`^${k}=(.*)$`, 'm'));
    return !m || m[1].trim() === '';
  });
}

// --- prompts interactivos de variables de entorno --------------------------
// Cada campo lleva una etiqueta y un `tip(values)` que explica dónde obtener el
// valor. Es función para poder construir ayuda dinámica (la URL OAuth usa el
// Client ID ya introducido).
const ENV_FIELDS = [
  {
    key: 'TWITCH_CHANNEL_NAME',
    label: 'Nombre del canal de Twitch (en minúsculas)',
    tip: () => 'El nombre de tu canal, tal cual en twitch.tv/<canal>.',
  },
  {
    key: 'TWITCH_BOT_USERNAME',
    label: 'Usuario de la cuenta que enviará los mensajes',
    tip: () => 'Puede ser tu propio canal o una cuenta de bot dedicada.',
  },
  {
    key: 'TWITCH_CLIENT_ID',
    label: 'Client ID de la aplicación de Twitch',
    tip: () =>
      'Crea una app en https://dev.twitch.tv/console/apps\n' +
      '         (OAuth Redirect URL: http://localhost · Categoría: Aplicación personalizada)\n' +
      '         y copia el "Client ID".',
  },
  {
    key: 'TWITCH_OAUTH_TOKEN',
    label: 'Token OAuth de Twitch (SIN el prefijo "oauth:")',
    secret: true,
    tip: (values) =>
      'Abre esta URL en el navegador, acepta, y copia el access_token del hash\n' +
      '         de la redirección (http://localhost#access_token=...):\n' +
      `         https://id.twitch.tv/oauth2/authorize?client_id=${values.TWITCH_CLIENT_ID || 'TU_CLIENT_ID'}` +
      '&redirect_uri=http://localhost&response_type=token&scope=chat:edit+chat:read+channel:moderate',
  },
  {
    key: 'DISCORD_LINK',
    label: 'Enlace de invitación a tu servidor de Discord',
    tip: () => 'Discord → Ajustes del servidor → Invitaciones (o clic derecho en un canal → "Invitar gente").',
  },
  {
    key: 'CHESS_PROVIDER',
    label: 'Proveedor de ajedrez: lichess | chesscom',
    tip: () =>
      'Elige la plataforma con la que juegas/recibes retos. "lichess" habilita\n' +
      '         además el overlay de TV (/tv). Por defecto: lichess.',
  },
  {
    key: 'LICHESS_PROFILE_LINK',
    label: 'URL de tu perfil de Lichess (si usas lichess)',
    tip: () => 'Por ejemplo: https://lichess.org/@/TU_USUARIO',
  },
  {
    key: 'LICHESS_TEAM_LINK',
    label: 'URL de tu equipo de Lichess (si usas lichess)',
    tip: () => 'Por ejemplo: https://lichess.org/team/TU_EQUIPO',
  },
  {
    key: 'LICHESS_TV_USER',
    label: 'Tu usuario de Lichess para el overlay de TV (/tv)',
    tip: () => 'Sólo el nombre de usuario (sin URL). Es la cuenta cuya partida en vivo se emite.',
  },
  {
    key: 'CHESSCOM_PROFILE_LINK',
    label: 'URL de tu perfil de Chess.com (si usas chesscom)',
    tip: () => 'Por ejemplo: https://www.chess.com/member/TU_USUARIO',
  },
  {
    key: 'CHESSCOM_CLUB_LINK',
    label: 'URL de tu club de Chess.com (si usas chesscom)',
    tip: () => 'Por ejemplo: https://www.chess.com/club/TU_CLUB',
  },
];

const readEnv = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
const getEnvVar = (content, key) => {
  const m = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1] : '';
};
// Añade o reemplaza `KEY=value` (a diferencia de ensureEnvVar, sí sobreescribe).
function upsertEnvVar(content, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) return content.replace(re, `${key}=${value}`);
  if (content && !content.endsWith('\n')) content += '\n';
  return content + `${key}=${value}\n`;
}

// Pregunta por cada variable. Enter = mantener el valor actual.
//
// Usamos el async-iterator de readline (no `rl.question` en bucle), porque éste
// se cuelga / pierde líneas cuando stdin no es un TTY (respuestas pipeadas).
// Escribimos el prompt a mano; en una terminal el propio TTY hace el eco.
async function askEnvVars(file) {
  const values = {};
  let content = readEnv(file);
  for (const f of ENV_FIELDS) values[f.key] = getEnvVar(content, f.key);

  log('\n  Te pediré cada variable. Pulsa Enter para mantener el valor actual.\n');
  const rl = readline.createInterface({ input: process.stdin });
  const lines = rl[Symbol.asyncIterator]();
  try {
    for (const field of ENV_FIELDS) {
      const current = values[field.key];
      log(`  ${c('36', field.key)} — ${field.label}`);
      log(`       ${c('90', field.tip(values))}`);
      const shown = current ? (field.secret ? '••• definido •••' : current) : 'vacío';
      process.stdout.write(`       valor [${shown}]: `);
      const next = await lines.next();
      if (next.done) {
        log('');
        break; // EOF: mantenemos el resto con su valor actual
      }
      const answer = String(next.value).trim();
      if (answer) values[field.key] = answer;
      log('');
    }
  } finally {
    rl.close();
  }

  content = readEnv(file);
  for (const f of ENV_FIELDS) content = upsertEnvVar(content, f.key, values[f.key] || '');
  fs.writeFileSync(file, content);
}

if (args.includes('--help')) {
  log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^[\s\S]*?\n \*/, ' *'));
  process.exit(0);
}

async function main() {
  log(c('1', '\n🏁  Setup — monorepo del bot de stream de ajedrez\n'));

  // 1) Node
  step(1, 'Comprobando Node...');
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) warn(`Node ${process.versions.node} detectado. Se recomienda Node >= 20.`);
  else ok(`Node ${process.versions.node}`);

  // 2) Dependencias (workspaces)
  step(2, 'Instalando dependencias (npm install / workspaces)...');
  if (args.includes('--skip-install')) {
    warn('Omitido por --skip-install');
  } else {
    run(npmCmd, ['install']);
    ok('Dependencias instaladas y workspaces enlazados');
  }

  // 3) Carpeta de datos
  step(3, 'Preparando carpeta de datos...');
  const dataDir = path.join(ROOT, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const dataPathEnv = dataDir.split(path.sep).join('/'); // sin backslashes en .env
  // Semillas idempotentes para que la web no falle antes de tener datos.
  const seed = (name, value) => {
    const f = path.join(dataDir, name);
    if (!fs.existsSync(f)) fs.writeFileSync(f, value);
  };
  seed('queue.json', '[]\n');
  seed('overload-center.json', '{}\n');
  ok(`Datos en ${dataDir}`);

  // 4) apps/bot/.env.local
  step(4, 'Configurando apps/bot/.env.local...');
  const botEnv = path.join(ROOT, 'apps', 'bot', '.env');
  const botEnvLocal = path.join(ROOT, 'apps', 'bot', '.env.local');
  if (!fs.existsSync(botEnvLocal)) {
    fs.writeFileSync(botEnvLocal, fs.existsSync(botEnv) ? fs.readFileSync(botEnv, 'utf8') : '');
    ok('Creado apps/bot/.env.local (copia de apps/bot/.env)');
  } else {
    ok('apps/bot/.env.local ya existe (no se sobrescribe)');
  }
  ensureEnvVar(botEnvLocal, 'DATA_PATH', dataPathEnv);

  if (interactive) {
    await askEnvVars(botEnvLocal);
  }

  const faltan = emptyVars(botEnvLocal, [
    'TWITCH_CHANNEL_NAME',
    'TWITCH_BOT_USERNAME',
    'TWITCH_CLIENT_ID',
    'TWITCH_OAUTH_TOKEN',
  ]);
  if (faltan.length) {
    warn(`Faltan en apps/bot/.env.local: ${faltan.join(', ')}`);
    if (!interactive) {
      warn('Ejecuta `node setup.js` en una terminal interactiva para que te las pida con ayuda.');
    }
  } else {
    ok('Credenciales de Twitch presentes');
  }

  // 5) apps/web/.env.local
  step(5, 'Configurando apps/web/.env.local...');
  const webEnvLocal = path.join(ROOT, 'apps', 'web', '.env.local');
  if (!fs.existsSync(webEnvLocal)) {
    fs.writeFileSync(webEnvLocal, `DATA_PATH=${dataPathEnv}\n`);
    ok('Creado apps/web/.env.local');
  } else {
    ensureEnvVar(webEnvLocal, 'DATA_PATH', dataPathEnv);
    ok('apps/web/.env.local actualizado');
  }
  // El overlay de TV (/tv) lo sirve la web, así que necesita su propio
  // LICHESS_TV_USER. Lo propagamos desde el .env del bot.
  const tvUser = getEnvVar(readEnv(botEnvLocal), 'LICHESS_TV_USER');
  fs.writeFileSync(webEnvLocal, upsertEnvVar(readEnv(webEnvLocal), 'LICHESS_TV_USER', tvUser));

  // 6) Navegador de Playwright (opcional)
  step(6, 'Navegador de Playwright (tests e2e)...');
  if (args.includes('--with-browser')) {
    run(npmCmd, ['run', 'pw:install']);
    ok('Chromium instalado');
  } else {
    warn('Omitido. Para e2e ejecuta: npm run pw:install  (o node setup.js --with-browser)');
  }

  // Próximos pasos
  log(c('1', '\n✅  Setup completado.\n'));
  log('Próximos pasos:');
  if (faltan.length) {
    log(`  · ${c('33', 'Rellena las credenciales')} en apps/bot/.env.local (ver README).`);
  }
  log('  · Bot:       npm run bot:dev');
  log('  · Web:       npm run web:dev        → http://localhost:3000 (overlay) y /admin');
  log('  · Overlays:  npm run overlays       → http://localhost:4000');
  log('  · OBS:       npm run setup:obs       (carga las escenas en OBS Studio)');
  log('  · StreamDeck:npm run setup:streamdeck(carga el perfil 3x5 en Stream Deck)');
  log('  · Voicemeeter:npm run setup:voicemeeter (config de audio Banana)');
  log('  · Tests:     npm run test:logic');
  log('  · Stack:     npm run up             (docker compose)\n');
}

main().catch((err) => {
  console.error(`\n${c('31', '✗ Error en el setup:')} ${err.message}\n`);
  process.exit(1);
});
