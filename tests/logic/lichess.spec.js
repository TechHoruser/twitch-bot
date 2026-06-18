const { test, expect } = require('@playwright/test');
const lichess = require('@stream-toolkit/common/providers/lichess');

// fetch simulado: cada respuesta define { status, body }.
const makeFetch = (responses = []) => {
  const queue = [...responses];
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    const r = queue.shift() || { status: 200, body: {} };
    const status = r.status || 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => r.body || {},
    };
  };
  fn.calls = calls;
  return fn;
};

test.describe('lichess · getStats', () => {
  test('mapea perfs a { rating, prog }', async () => {
    const fetch = makeFetch([{ status: 200, body: { perfs: {
      bullet: { games: 10, rating: 2000, prog: 12 },
      blitz: { games: 5, rating: 1800, prog: -8 },
      rapid: { games: 3, rating: 1700, prog: 0 },
    } } }]);
    const r = await lichess.getStats('foo', { fetch });
    expect(r.bullet).toEqual({ rating: 2000, prog: 12 });
    expect(r.blitz).toEqual({ rating: 1800, prog: -8 });
    expect(r.rapid).toEqual({ rating: 1700, prog: 0 });
  });

  test('perf sin partidas (games: 0) devuelve N/A', async () => {
    const fetch = makeFetch([{ status: 200, body: { perfs: { bullet: { games: 0, rating: 1500 } } } }]);
    const r = await lichess.getStats('foo', { fetch });
    expect(r.bullet).toEqual({ rating: 'N/A', prog: 0 });
    expect(r.blitz).toEqual({ rating: 'N/A', prog: 0 });
  });

  test('404 devuelve null', async () => {
    const fetch = makeFetch([{ status: 404 }]);
    expect(await lichess.getStats('ghost', { fetch })).toBeNull();
  });

  test('cuenta cerrada devuelve null', async () => {
    const fetch = makeFetch([{ status: 200, body: { closed: true, perfs: {} } }]);
    expect(await lichess.getStats('closed', { fetch })).toBeNull();
  });
});

test.describe('lichess · getCurrentGame', () => {
  test('devuelve id y orienta el tablero al color del usuario (negras)', async () => {
    const fetch = makeFetch([{ status: 200, body: {
      id: 'abcd1234',
      status: 'started',
      players: { white: { user: { id: 'rival' } }, black: { user: { id: 'foo' } } },
    } }]);
    expect(await lichess.getCurrentGame('Foo', { fetch })).toEqual({ id: 'abcd1234', orientation: 'black' });
  });

  test('orienta a blancas cuando el usuario juega con blancas', async () => {
    const fetch = makeFetch([{ status: 200, body: {
      id: 'efgh5678',
      players: { white: { user: { id: 'foo' } }, black: { user: { id: 'rival' } } },
    } }]);
    expect(await lichess.getCurrentGame('foo', { fetch })).toEqual({ id: 'efgh5678', orientation: 'white' });
  });

  test('sin partida en curso devuelve null', async () => {
    const fetch = makeFetch([{ status: 404 }]);
    expect(await lichess.getCurrentGame('foo', { fetch })).toBeNull();
  });
});
