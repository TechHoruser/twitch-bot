// Registro dinámico de temas/escenas del overlay. Cada juego es un fichero
// ./themes/<clave>.json (la clave = nombre del fichero). Añadir un juego = soltar
// un JSON aquí; no hay listas que mantener en el código. De aquí beben tanto el
// overlay y el panel /admin (vía /api/scenes → contexto) como la validación de la
// escena activa (scene.js). Cada tema aporta: label (nombre visible), order (orden
// en el selector), y los textos/colores (vars CSS) que parametrizan las pantallas.
const fs = require('fs');
const path = require('path');

// Localiza la carpeta de temas de forma robusta. Bajo Next el paquete se empaqueta
// con webpack y __dirname deja de apuntar al código fuente (acaba en .next/server/…),
// así que no podemos fiarnos solo de él. Probamos primero la ruta local (Node plano:
// bot y tests, donde __dirname es correcto) y, si no, subimos desde el cwd buscando
// un packages/common/scenes/themes (cubre Next con cwd=apps/web, la raíz del repo y
// Docker). La ruta encontrada se cachea, pero los ficheros se releen en cada llamada.
let cachedDir = null;
const themesDir = () => {
  if (cachedDir && fs.existsSync(cachedDir)) return cachedDir;
  const local = path.join(__dirname, 'themes');
  if (fs.existsSync(local)) { cachedDir = local; return cachedDir; }
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'packages', 'common', 'scenes', 'themes');
    if (fs.existsSync(candidate)) { cachedDir = candidate; return cachedDir; }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return local; // último recurso; loadThemes hará catch si no existe.
};

// Lee y parsea todos los temas del directorio. Se lee en cada llamada (frecuencia
// baja) para que añadir o editar un tema se refleje sin reiniciar el proceso.
const loadThemes = () => {
  const dir = themesDir();
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch {
    return {};
  }
  const themes = {};
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const key = path.basename(file, '.json');
    try {
      themes[key] = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    } catch {
      // Ignora ficheros corruptos para no tumbar todo el selector por uno malo.
    }
  }
  return themes;
};

// Claves ordenadas por el campo `order` (alfabético como desempate).
const orderedKeys = (themes) => Object.keys(themes).sort((a, b) => (
  ((themes[a].order ?? 999) - (themes[b].order ?? 999)) || a.localeCompare(b)
));

// Mapa { clave → tema } en orden, con la clave incrustada en cada tema.
const getThemes = () => {
  const themes = loadThemes();
  const ordered = {};
  for (const key of orderedKeys(themes)) ordered[key] = { key, ...themes[key] };
  return ordered;
};

// Lista ordenada de juegos disponibles (las claves).
const getGames = () => orderedKeys(loadThemes());

// Tema de un juego, con respaldo al primero disponible si la clave no existe.
const getTheme = (game) => {
  const themes = getThemes();
  return themes[game] || themes[Object.keys(themes)[0]] || null;
};

// Juego por defecto: el primero según el orden (o 'king' si no hubiera ninguno).
const getDefaultGame = () => getGames()[0] || 'king';

module.exports = {
  getThemes,
  getGames,
  getTheme,
  getDefaultGame,
  themesDir,
};
