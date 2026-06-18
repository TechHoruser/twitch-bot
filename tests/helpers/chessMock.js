// Mock de la librería chess-web-api. DEBE requerirse ANTES que
// @stream-toolkit/common/chess para que el override del prototipo afecte a la
// instancia creada en chess.js.
//
// Con npm workspaces, chess-web-api se hoistea al node_modules de la raíz, así
// que este `require('chess-web-api')` resuelve el MISMO módulo cacheado que
// carga common/chess.js → compartimos el prototipo.
const ChessWebAPI = require('chess-web-api');

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
