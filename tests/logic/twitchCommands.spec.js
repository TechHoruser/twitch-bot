const { test, expect } = require('@playwright/test');
const { makeClient, broadcasterTags, viewerTags } = require('../helpers/data');
const twitch = require('@stream-toolkit/common/twitchCommands');

const CHANNEL = '#canal';
const ENV = {
  TWITCH_CLIENT_ID: 'cid',
  TWITCH_OAUTH_TOKEN: 'tok',
  TWITCH_CHANNEL_NAME: 'streamer',
  DISCORD_LINK: 'https://discord.gg/x',
  CHESS_PROVIDER: 'chesscom',
  CHESSCOM_PROFILE_LINK: 'https://chess.com/member/streamer',
  CHESSCOM_CLUB_LINK: 'https://chess.com/club/x',
};

// fetch simulado configurable.
const makeFetch = (responses = []) => {
  const calls = [];
  const queue = [...responses];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    const next = queue.shift() || { ok: true, json: async () => ({ data: [] }) };
    return { ok: next.ok !== false, json: async () => next.body || {} };
  };
  fn.calls = calls;
  return fn;
};

const deps = (overrides = {}) => ({ env: ENV, fetch: makeFetch(), getBroadcasterId: () => '999', ...overrides });

test.describe('handleBasicCommands · enlaces', () => {
  test('responde al mencionar discord', async () => {
    const client = makeClient();
    await twitch.handleBasicCommands(client, CHANNEL, viewerTags(), 'tenéis discord?', deps());
    expect(client.last()).toContain(ENV.DISCORD_LINK);
  });

  test('!chess responde con el perfil', async () => {
    const client = makeClient();
    await twitch.handleBasicCommands(client, CHANNEL, viewerTags(), '!chess', deps());
    expect(client.last()).toContain(ENV.CHESSCOM_PROFILE_LINK);
  });

  test('!club responde con el club', async () => {
    const client = makeClient();
    await twitch.handleBasicCommands(client, CHANNEL, viewerTags(), '!club', deps());
    expect(client.last()).toContain(ENV.CHESSCOM_CLUB_LINK);
  });
});

test.describe('handleBasicCommands · !banear', () => {
  test('un viewer no puede banear', async () => {
    const client = makeClient();
    await twitch.handleBasicCommands(client, CHANNEL, viewerTags(), '!banear @malo', deps());
    expect(client.sayCount()).toBe(0);
  });

  test('el broadcaster banea a un usuario existente', async () => {
    const client = makeClient();
    const fetch = makeFetch([
      { ok: true, body: { data: [{ id: '42' }] } }, // getUserId
      { ok: true, body: {} }, // ban
    ]);
    await twitch.handleBasicCommands(client, CHANNEL, broadcasterTags(), '!banear @malo 60', deps({ fetch }));
    expect(client.last()).toContain('ha sido baneado por 60 segundos');
    // La segunda llamada es el POST del baneo con el broadcaster_id resuelto.
    expect(fetch.calls[1].url).toContain('broadcaster_id=999');
    expect(fetch.calls[1].opts.method).toBe('POST');
  });

  test('avisa si el usuario a banear no existe', async () => {
    const client = makeClient();
    const fetch = makeFetch([{ ok: true, body: { data: [] } }]);
    await twitch.handleBasicCommands(client, CHANNEL, broadcasterTags(), '!banear @fantasma', deps({ fetch }));
    expect(client.last()).toContain('No se encontró el usuario');
  });

  test('pide sintaxis si falta el usuario', async () => {
    const client = makeClient();
    await twitch.handleBasicCommands(client, CHANNEL, broadcasterTags(), '!banear', deps());
    expect(client.last()).toContain('usa el comando así');
  });

  test('informa si la API de baneo falla', async () => {
    const client = makeClient();
    const fetch = makeFetch([
      { ok: true, body: { data: [{ id: '42' }] } }, // getUserId
      { ok: false, body: {} }, // ban falla
    ]);
    await twitch.handleBasicCommands(client, CHANNEL, broadcasterTags(), '!banear @malo', deps({ fetch }));
    expect(client.last()).toContain('No se pudo banear');
  });
});

test.describe('getUserId / banUser', () => {
  test('getUserId devuelve el id', async () => {
    const fetch = makeFetch([{ ok: true, body: { data: [{ id: '7' }] } }]);
    expect(await twitch.getUserId('bob', ENV, fetch)).toBe('7');
  });

  test('getUserId devuelve null si no hay datos', async () => {
    const fetch = makeFetch([{ ok: true, body: { data: [] } }]);
    expect(await twitch.getUserId('bob', ENV, fetch)).toBeNull();
  });

  test('banUser lanza si no hay broadcasterId', async () => {
    await expect(twitch.banUser({ userId: '1', duration: 60, broadcasterId: null }, ENV, makeFetch()))
      .rejects.toThrow('broadcaster_id');
  });
});
