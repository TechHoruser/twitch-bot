// Registro dinámico de temas/escenas del overlay. Cada juego es un fichero
// ./themes/<clave>.json (la clave = nombre del fichero). Añadir un juego = soltar
// un JSON aquí; no hay listas que mantener en el código. De aquí beben tanto el
// overlay y el panel /admin (vía /api/scenes → contexto) como la validación de la
// escena activa (scene.js). Cada tema aporta: label (nombre visible), order (orden
// en el selector), y los textos/colores (vars CSS) que parametrizan las pantallas.
const fs = require('fs');
const path = require('path');

const THEMES_DIR = path.join(__dirname, 'themes');

// Lee y parsea todos los temas del directorio. Se lee en cada llamada (frecuencia
// baja) para que añadir o editar un tema se refleje sin reiniciar el proceso.
const loadThemes = () => {
  let files;
  try {
    files = fs.readdirSync(THEMES_DIR);
  } catch {
    return {};
  }
  const themes = {};
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const key = path.basename(file, '.json');
    try {
      themes[key] = JSON.parse(fs.readFileSync(path.join(THEMES_DIR, file), 'utf8'));
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
  THEMES_DIR,
};
