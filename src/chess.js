const ChessWebAPI = require('chess-web-api');

const { getJson, saveJson } = require('./savedData');
const chessAPI = new ChessWebAPI();

const CHESS_STATS_CACHE = 'chess-stats';
const CACHE_DURATION_IN_HOURS = 12;

const cacheDurationInMs = CACHE_DURATION_IN_HOURS * 60 * 60 * 1000;

const defaultRatings = { last: { rating: 'N/A' }, best: { rating: 'N/A' } };

const logUserRating = (username, ratings) => {
  console.log(`Chess.com username: ${username}:
    - rapid: ${ratings.rapid.last.rating} (MAX: ${ratings.rapid.best.rating})
    - blitz: ${ratings.blitz.last.rating} (MAX: ${ratings.blitz.best.rating})
    - bullet: ${ratings.bullet.last.rating} (MAX: ${ratings.bullet.best.rating})
  `);
}

const logDiffBetweenRatings = (username, oldRatings, newRatings) => {
  const getDiffIfDifferent = (oldRating, newRating) => (
    oldRating !== newRating ? `${oldRating} -> ${newRating}` : oldRating
  )

  console.log(`Chess.com username: ${username}:
    - rapid: ${getDiffIfDifferent(oldRatings.rapid.last.rating, newRatings.rapid.last.rating)} (MAX: ${getDiffIfDifferent(oldRatings.rapid.best.rating, newRatings.rapid.best.rating)})
    - blitz: ${getDiffIfDifferent(oldRatings.blitz.last.rating, newRatings.blitz.last.rating)} (MAX: ${getDiffIfDifferent(oldRatings.blitz.best.rating, newRatings.blitz.best.rating)})
    - bullet: ${getDiffIfDifferent(oldRatings.bullet.last.rating, newRatings.bullet.last.rating)} (MAX: ${getDiffIfDifferent(oldRatings.bullet.best.rating, newRatings.bullet.best.rating)})
  `);

  const asString = (oldRating, newRating) => {
    if (oldRating === 'N/A') {
      return 'N/A';
    }
    return newRating > oldRating ? '↑' : (newRating < oldRating ? '↓' : '=');
  }

  console.log(`Rating changes RESUME:
    - rapid:  ${asString(oldRatings.rapid.last.rating, newRatings.rapid.last.rating)}
    - blitz:  ${asString(oldRatings.blitz.last.rating, newRatings.blitz.last.rating)}
    - bullet: ${asString(oldRatings.bullet.last.rating, newRatings.bullet.last.rating)}
  `);
}

const getChessStats = async (username) => {
  console.log('Getting chess stats for', username);
  if (!username) {
    console.error('No username provided', username);
    return null;
  }

  try {
    const cache = getJson(CHESS_STATS_CACHE);
    const now = Date.now();
    const useCache = cache[username] && now - cache[username].timestamp < cacheDurationInMs;
 
    if (useCache) {
      return cache[username].ratings;
    }

    const stats = await chessAPI.getPlayerStats(username);

    ratings = {
      bullet: stats.body.chess_bullet || defaultRatings,
      blitz: stats.body.chess_blitz || defaultRatings,
      rapid: stats.body.chess_rapid || defaultRatings,
    }

    console.log('-----------------------------\n');
    if (!cache[username]) {
      console.log('NUEVO USUARIO CHESSCOM\n');
      logUserRating(username, ratings);
    } else {
      console.log('USUARIO ACTUALIZADO CHESSCOM\n');
      const oldRatings = cache[username].ratings;
      logDiffBetweenRatings(username, oldRatings, ratings);
    }
    console.log('-----------------------------\n');

    try {
      cache[username] = {
        timestamp: now,
        ratings
      };
      
      saveJson(CHESS_STATS_CACHE, cache);
    } catch (cacheError) {
      console.error('Cache handling error:', cacheError);
    }

    return ratings;
  } catch (error) {
    console.error('Chess.com API error:', error);
    return null;
  }
}

module.exports = {
  logUserRating,
  getChessStats,
};
