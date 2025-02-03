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
  console.log(`Chess.com username: ${username}:
    - rapid: ${oldRatings.rapid.last.rating} -> ${newRatings.rapid.last.rating} (MAX: ${oldRatings.rapid.best.rating} -> ${newRatings.rapid.best.rating})
    - blitz: ${oldRatings.blitz.last.rating} -> ${newRatings.blitz.last.rating} (MAX: ${oldRatings.blitz.best.rating} -> ${newRatings.blitz.best.rating})
    - bullet: ${oldRatings.bullet.last.rating} -> ${newRatings.bullet.last.rating} (MAX: ${oldRatings.bullet.best.rating} -> ${newRatings.bullet.best.rating})
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

    if (!cache[username]) {
      console.log('Nuevo usuario de Chess.com:', username);
      logUserRating(username, ratings);
    } else {
      console.log('Usuario de Chess.com actualizado:', username);
      const oldRatings = cache[username].ratings;
      logDiffBetweenRatings(username, oldRatings, ratings);
    }

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
