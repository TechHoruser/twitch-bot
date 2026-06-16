const { test, expect } = require('@playwright/test');
const { resetData } = require('../helpers/data');
// IMPORTANTE: el mock debe cargarse antes que @chess-stream/common/chess.
const chessMock = require('../helpers/chessMock');
const chess = require('@chess-stream/common/chess');

test.beforeEach(() => {
  // El mock de chess.com parchea chess-web-api, así que fijamos el proveedor a
  // chesscom para ejercitar ese camino del dispatcher.
  process.env.CHESS_PROVIDER = 'chesscom';
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
    expect(ratings.bullet.rating).toBe(800);
    expect(ratings.blitz.rating).toBe(1000);
    expect(ratings.rapid.rating).toBe(1200);
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
    expect(ratings.bullet.rating).toBe('N/A');
    expect(ratings.blitz.rating).toBe('N/A');
  });

  test('devuelve null si la API falla', async () => {
    chessMock.setError();
    expect(await chess.getChessStats('fantasma')).toBeNull();
  });
});

test.describe('chess · logUserRating', () => {
  test('no lanza al loguear ratings', () => {
    const ratings = {
      bullet: { rating: 1, prog: 5 },
      blitz: { rating: 3, prog: -2 },
      rapid: { rating: 5, prog: 0 },
    };
    expect(() => chess.logUserRating('user', ratings)).not.toThrow();
  });
});
