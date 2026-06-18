// Estado de la "escena" activa del overlay web (qué juego/tema y qué pantalla se
// muestra en localhost:3000). Lo controla el panel /admin y lo lee el overlay
// vía SSE. Persistencia simple en fichero JSON (DATA_PATH), como el resto.
const { getJson, saveJson } = require('./savedData');

const SCENE_FILE = 'scene';

// Juegos/temas disponibles y pantallas posibles.
const GAMES = ['king', 'valorant', 'mecha'];
const SCREENS = ['intro', 'game', 'pause', 'outro'];
const DEFAULT_SCENE = { game: 'king', screen: 'intro' };

// Devuelve la escena actual, saneada (valores fuera de rango → por defecto).
const getScene = () => {
  const s = getJson(SCENE_FILE) || {};
  return {
    game: GAMES.includes(s.game) ? s.game : DEFAULT_SCENE.game,
    screen: SCREENS.includes(s.screen) ? s.screen : DEFAULT_SCENE.screen,
  };
};

// Aplica un cambio parcial ({ game?, screen? }) validando cada campo.
const setScene = (partial = {}) => {
  const next = getScene();
  if (GAMES.includes(partial.game)) next.game = partial.game;
  if (SCREENS.includes(partial.screen)) next.screen = partial.screen;
  saveJson(SCENE_FILE, next);
  return next;
};

module.exports = {
  getScene,
  setScene,
  GAMES,
  SCREENS,
  SCENE_FILE,
  DEFAULT_SCENE,
};
