// Proveedor de Chess.com. Envuelve la librería `chess-web-api` y normaliza su
// respuesta a la misma forma que el proveedor de Lichess.
//
// Chess.com no expone una "tendencia" (prog), así que se devuelve 0.

const ChessWebAPI = require('chess-web-api');

const chessAPI = new ChessWebAPI();

const NA = { rating: 'N/A', prog: 0 };

// `chess_<modo>` trae { last: { rating }, best: { rating }, ... }.
const toRating = (perf) =>
  perf && perf.last && perf.last.rating != null
    ? { rating: perf.last.rating, prog: 0 }
    : { ...NA };

// Devuelve ratings normalizados; `null` si la API falla / el usuario no existe.
// Un usuario sin partidas registradas devuelve ratings en N/A (no null), igual
// que el comportamiento previo.
const getStats = async (username) => {
  try {
    const stats = await chessAPI.getPlayerStats(username);
    const body = (stats && stats.body) || {};
    return {
      bullet: toRating(body.chess_bullet),
      blitz: toRating(body.chess_blitz),
      rapid: toRating(body.chess_rapid),
    };
  } catch (error) {
    console.error('Chess.com API error:', error);
    return null;
  }
};

module.exports = {
  name: 'Chess.com',
  getStats,
};
