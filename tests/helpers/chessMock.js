// Mock de la librería chess-web-api. DEBE requerirse ANTES que common-js/chess
// para que el override del prototipo afecte a la instancia creada en chess.js.
const path = require('path');

// Resolvemos el MISMO fichero que carga common-js/chess.js (su node_modules),
// de modo que Node devuelva el módulo cacheado y compartamos el prototipo.
const ChessWebAPI = require(path.join(__dirname, '../../common-js/node_modules/chess-web-api'));

let nextStats = null;
let shouldThrow = false;
let calls = 0;

ChessWebAPI.prototype.getPlayerStats = async function getPlayerStats(username) {
  calls += 1;
  if (shouldThrow) {
    throw new Error(`chess.com user not found: ${username}`);
  }
  return { body: nextStats || {} };
};

const ratingBlock = (last, best) => ({ last: { rating: last }, best: { rating: best } });

module.exports = {
  // Configura una respuesta exitosa con ratings para bullet/blitz/rapid.
  setStats: ({ bullet = [100, 200], blitz = [150, 250], rapid = [120, 220] } = {}) => {
    shouldThrow = false;
    nextStats = {
      chess_bullet: ratingBlock(bullet[0], bullet[1]),
      chess_blitz: ratingBlock(blitz[0], blitz[1]),
      rapid_placeholder: undefined,
      chess_rapid: ratingBlock(rapid[0], rapid[1]),
    };
  },
  // Devuelve un body vacío (usuario sin partidas registradas).
  setEmpty: () => { shouldThrow = false; nextStats = {}; },
  // Hace que la API lance un error (usuario inexistente / fallo de red).
  setError: () => { shouldThrow = true; },
  callCount: () => calls,
  resetCalls: () => { calls = 0; },
};
