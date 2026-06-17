// Proveedor de Lichess. Usa la API pública (sin auth) vía `fetch`.
//   - getStats(username)      → ratings normalizados { bullet, blitz, rapid }
//   - getCurrentGame(username) → { id, orientation } de la partida en curso
//
// `fetch` es inyectable para poder testear sin red.

const LICHESS_API = 'https://lichess.org/api';

const NA = { rating: 'N/A', prog: 0 };

// Convierte un bloque `perfs.X` de Lichess a la forma normalizada.
// Sin partidas (games === 0) o sin rating → N/A.
const perfToRating = (perf) => {
  if (!perf || perf.games === 0 || perf.rating == null) {
    return { ...NA };
  }
  return { rating: perf.rating, prog: perf.prog || 0 };
};

// Devuelve los ratings normalizados o `null` si el usuario no existe / está
// cerrado (mismo contrato que esperaba la lógica de cola con Chess.com).
const getStats = async (username, { fetch = globalThis.fetch } = {}) => {
  const res = await fetch(`${LICHESS_API}/user/${encodeURIComponent(username)}`);

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Lichess API respondió ${res.status}`);
  }

  const body = await res.json();
  if (body.closed || body.disabled) {
    return null;
  }

  const perfs = body.perfs || {};
  return {
    bullet: perfToRating(perfs.bullet),
    blitz: perfToRating(perfs.blitz),
    rapid: perfToRating(perfs.rapid),
  };
};

// Obtiene la partida en curso del usuario (o `null` si no hay ninguna).
// Devuelve el id y la orientación (color del propio usuario) para que el
// overlay muestre el tablero desde su perspectiva.
const getCurrentGame = async (username, { fetch = globalThis.fetch } = {}) => {
  const res = await fetch(
    `${LICHESS_API}/user/${encodeURIComponent(username)}/current-game?moves=false&pgnInJson=false&clocks=false&evals=false`,
    { headers: { Accept: 'application/json' } }
  );

  if (!res.ok) {
    return null;
  }

  const game = await res.json();
  if (!game || !game.id) {
    return null;
  }

  const id = username.toLowerCase();
  const black = game.players?.black?.user?.id;
  const orientation = black === id ? 'black' : 'white';

  return { id: game.id, orientation };
};

module.exports = {
  name: 'Lichess',
  getStats,
  getCurrentGame,
};
