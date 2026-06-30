// Estado de la "escena" activa del overlay web (qué juego/tema y qué pantalla se
// muestra en localhost:3000). Lo controla el panel /admin y lo lee el overlay
// vía SSE. Persistencia simple en fichero JSON (DATA_PATH), como el resto.
const { getJson, saveJson } = require('./savedData');
const { getGames, getDefaultGame } = require('./scenes');

const SCENE_FILE = 'scene';

// Los juegos/temas válidos se descubren dinámicamente del registro de escenas
// (packages/common/scenes/themes/*.json), por lo que añadir un juego no requiere
// tocar este archivo. Las pantallas sí son fijas (las mismas para todo juego).
const SCREENS = ['intro', 'game', 'pause', 'outro'];
// countdownEndsAt: instante (ms epoch) en que termina la cuenta atrás de la intro,
// o null si no hay. Lo fija /admin al iniciar el directo para que el overlay y el
// panel cuenten hacia el MISMO instante (cuenta atrás sincronizada).
const DEFAULT_SCENE = { game: 'king', screen: 'intro', countdownEndsAt: null };

// Devuelve la escena actual, saneada (valores fuera de rango → por defecto). El
// juego por defecto es el primero del registro si el guardado ya no existe.
const getScene = () => {
  const s = getJson(SCENE_FILE) || {};
  const games = getGames();
  return {
    game: games.includes(s.game) ? s.game : getDefaultGame(),
    screen: SCREENS.includes(s.screen) ? s.screen : DEFAULT_SCENE.screen,
    countdownEndsAt: typeof s.countdownEndsAt === 'number' ? s.countdownEndsAt : null,
  };
};

// Aplica un cambio parcial ({ game?, screen?, countdownEndsAt? }) validando cada
// campo. countdownEndsAt: número fija el fin, null lo limpia, undefined no lo toca.
const setScene = (partial = {}) => {
  const next = getScene();
  if (getGames().includes(partial.game)) next.game = partial.game;
  if (SCREENS.includes(partial.screen)) next.screen = partial.screen;
  if (partial.countdownEndsAt === null || typeof partial.countdownEndsAt === 'number') {
    next.countdownEndsAt = partial.countdownEndsAt;
  }
  saveJson(SCENE_FILE, next);
  return next;
};

module.exports = {
  getScene,
  setScene,
  SCREENS,
  SCENE_FILE,
  DEFAULT_SCENE,
};
