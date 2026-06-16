const { test, expect } = require('@playwright/test');
const { resetData } = require('../helpers/data');
// IMPORTANTE: el mock debe cargarse antes que common-js/chess.
const chessMock = require('../helpers/chessMock');
const chess = require('../../common-js/chess');

test.beforeEach(() => {
  resetData();
  chessMock.resetCalls();
});

test.describe('chess · getChessStats', () => {
  test('devuelve null si no se pasa username', async () => {
    expect(await chess.getChessStats()).toBeNull();
    expect(chessMock.callCount()).toBe(0);
  });

  test('mapea los ratings de bullet/blitz/rapid', async () => {
    chessMock.setStats({ bullet: [800, 900], blitz: [1000, 1100], rapid: [1200, 1300] });
    const ratings = await chess.getChessStats('magnus');
    expect(ratings.bullet.last.rating).toBe(800);
    expect(ratings.bullet.best.rating).toBe(900);
    expect(ratings.blitz.last.rating).toBe(1000);
    expect(ratings.rapid.last.rating).toBe(1200);
  });

  test('cachea: la segunda llamada no golpea la API', async () => {
    chessMock.setStats({ bullet: [800, 900] });
    await chess.getChessStats('hikaru');
    await chess.getChessStats('hikaru');
    expect(chessMock.callCount()).toBe(1);
  });

  test('usuario sin partidas registradas devuelve N/A', async () => {
    chessMock.setEmpty();
    const ratings = await chess.getChessStats('novato');
    expect(ratings.bullet.last.rating).toBe('N/A');
    expect(ratings.blitz.best.rating).toBe('N/A');
  });

  test('devuelve null si la API falla', async () => {
    chessMock.setError();
    expect(await chess.getChessStats('fantasma')).toBeNull();
  });
});

test.describe('chess · logUserRating', () => {
  test('no lanza al loguear ratings', () => {
    chessMock.setStats({ bullet: [1, 2], blitz: [3, 4], rapid: [5, 6] });
    const ratings = {
      bullet: { last: { rating: 1 }, best: { rating: 2 } },
      blitz: { last: { rating: 3 }, best: { rating: 4 } },
      rapid: { last: { rating: 5 }, best: { rating: 6 } },
    };
    expect(() => chess.logUserRating('user', ratings)).not.toThrow();
  });
});
