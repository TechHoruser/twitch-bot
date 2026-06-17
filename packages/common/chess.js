// Dispatcher de estadísticas de ajedrez. Soporta varios proveedores (Lichess y
// Chess.com) y permite consultar cada uno por separado, cacheando por proveedor.
//
// Forma normalizada que devuelven todos los proveedores:
//   { bullet: { rating, prog }, blitz: { rating, prog }, rapid: { rating, prog } }

const { getJson, saveJson } = require('./savedData');

const CHESS_STATS_CACHE = 'chess-stats';
const CACHE_DURATION_IN_HOURS = 12;
const cacheDurationInMs = CACHE_DURATION_IN_HOURS * 60 * 60 * 1000;

const PROVIDERS = {
  lichess: require('./providers/lichess'),
  chesscom: require('./providers/chesscom'),
};
const PROVIDER_KEYS = Object.keys(PROVIDERS);

// Devuelve la clave de proveedor válida o null.
const normalizeKey = (key) => {
  const k = String(key || '').toLowerCase();
  return PROVIDERS[k] ? k : null;
};

// Proveedor por defecto (variable de entorno; lichess si no se define).
const getDefaultProviderKey = () => normalizeKey(process.env.CHESS_PROVIDER) || 'lichess';

// Nombre legible del proveedor ('Lichess' / 'Chess.com').
const providerLabel = (key) => PROVIDERS[normalizeKey(key) || getDefaultProviderKey()].name;

// Etiqueta del proveedor por defecto (para mensajes genéricos).
const providerName = () => providerLabel(getDefaultProviderKey());

// Parsea un token de cuenta: "lichess:foo" → { providerKey:'lichess', handle:'foo' }.
// Sin prefijo válido → usa el proveedor por defecto: "foo" → { default, 'foo' }.
const parseAccountToken = (token) => {
  const idx = String(token).indexOf(':');
  if (idx > 0) {
    const maybe = normalizeKey(token.slice(0, idx));
    if (maybe) return { providerKey: maybe, handle: token.slice(idx + 1).trim() };
  }
  return { providerKey: getDefaultProviderKey(), handle: String(token).trim() };
};

const formatProg = (prog) => {
  if (!prog) return '';
  return prog > 0 ? ` (↑${prog})` : ` (↓${Math.abs(prog)})`;
};

const logUserRating = (handle, ratings, providerKey) => {
  console.log(`${providerLabel(providerKey)} · ${handle}:
    - rapid:  ${ratings.rapid.rating}${formatProg(ratings.rapid.prog)}
    - blitz:  ${ratings.blitz.rating}${formatProg(ratings.blitz.prog)}
    - bullet: ${ratings.bullet.rating}${formatProg(ratings.bullet.prog)}
  `);
};

const logDiffBetweenRatings = (handle, oldRatings, newRatings, providerKey) => {
  const diff = (oldRating, newRating) =>
    oldRating !== newRating ? `${oldRating} -> ${newRating}` : `${newRating}`;

  console.log(`${providerLabel(providerKey)} · ${handle}:
    - rapid:  ${diff(oldRatings.rapid.rating, newRatings.rapid.rating)}
    - blitz:  ${diff(oldRatings.blitz.rating, newRatings.blitz.rating)}
    - bullet: ${diff(oldRatings.bullet.rating, newRatings.bullet.rating)}
  `);
};

// Consulta los ratings de `handle` en `providerKey` (por defecto, el del env).
// Caché de 12h anidada por proveedor: { lichess: { handle: {...} }, chesscom: {...} }.
const getChessStats = async (handle, providerKey = getDefaultProviderKey()) => {
  const key = normalizeKey(providerKey) || getDefaultProviderKey();
  console.log(`Getting ${providerLabel(key)} stats for`, handle);
  if (!handle) {
    console.error('No username provided', handle);
    return null;
  }

  try {
    const cache = getJson(CHESS_STATS_CACHE);
    const bucket = cache[key] || {};
    const id = handle.toLowerCase();
    const now = Date.now();

    if (bucket[id] && now - bucket[id].timestamp < cacheDurationInMs) {
      return bucket[id].ratings;
    }

    const ratings = await PROVIDERS[key].getStats(handle);
    if (!ratings) {
      return null;
    }

    console.log('-----------------------------\n');
    if (!bucket[id]) {
      console.log(`NUEVO USUARIO (${providerLabel(key)})\n`);
      logUserRating(handle, ratings, key);
    } else {
      console.log(`USUARIO ACTUALIZADO (${providerLabel(key)})\n`);
      logDiffBetweenRatings(handle, bucket[id].ratings, ratings, key);
    }
    console.log('-----------------------------\n');

    try {
      bucket[id] = { handle, timestamp: now, ratings };
      cache[key] = bucket;
      saveJson(CHESS_STATS_CACHE, cache);
    } catch (cacheError) {
      console.error('Cache handling error:', cacheError);
    }

    return ratings;
  } catch (error) {
    console.error(`${providerLabel(key)} error:`, error);
    return null;
  }
};

module.exports = {
  logUserRating,
  getChessStats,
  providerName,
  providerLabel,
  getDefaultProviderKey,
  parseAccountToken,
  normalizeKey,
  PROVIDER_KEYS,
};
