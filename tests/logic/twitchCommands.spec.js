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

test.describe('canal · info del directo', () => {
  test('getChannelInfo devuelve título y juego', async () => {
    const fetch = makeFetch([{ ok: true, body: { data: [{ title: 'T', game_id: '33', game_name: 'Chess' }] } }]);
    expect(await twitch.getChannelInfo({ broadcasterId: '999' }, ENV, fetch))
      .toEqual({ title: 'T', gameId: '33', gameName: 'Chess' });
    expect(fetch.calls[0].url).toContain('/channels?broadcaster_id=999');
  });

  test('updateChannelInfo hace PATCH con title y game_id', async () => {
    const fetch = makeFetch([{ ok: true, body: {} }]);
    await twitch.updateChannelInfo({ broadcasterId: '999', title: 'Nuevo', gameId: '33' }, ENV, fetch);
    expect(fetch.calls[0].opts.method).toBe('PATCH');
    expect(JSON.parse(fetch.calls[0].opts.body)).toEqual({ title: 'Nuevo', game_id: '33' });
  });

  test('updateChannelInfo solo envía los campos presentes', async () => {
    const fetch = makeFetch([{ ok: true, body: {} }]);
    await twitch.updateChannelInfo({ broadcasterId: '999', title: 'Solo título' }, ENV, fetch);
    expect(JSON.parse(fetch.calls[0].opts.body)).toEqual({ title: 'Solo título' });
  });

  test('searchCategories normaliza los resultados', async () => {
    const fetch = makeFetch([{ ok: true, body: { data: [{ id: '1', name: 'Chess', box_art_url: 'u' }] } }]);
    expect(await twitch.searchCategories('che', ENV, fetch))
      .toEqual([{ id: '1', name: 'Chess', boxArt: 'u' }]);
  });

  test('getStreamInfo devuelve espectadores cuando hay directo', async () => {
    const fetch = makeFetch([{ ok: true, body: { data: [{ viewer_count: 42, started_at: 's', game_name: 'Chess', title: 'T' }] } }]);
    expect(await twitch.getStreamInfo({ broadcasterId: '999' }, ENV, fetch))
      .toEqual({ live: true, viewerCount: 42, startedAt: 's', gameName: 'Chess', title: 'T' });
    expect(fetch.calls[0].url).toContain('/streams?user_id=999');
  });

  test('getStreamInfo indica offline cuando no hay datos', async () => {
    const fetch = makeFetch([{ ok: true, body: { data: [] } }]);
    expect(await twitch.getStreamInfo({ broadcasterId: '999' }, ENV, fetch))
      .toEqual({ live: false, viewerCount: 0, startedAt: null, gameName: '', title: '' });
  });

  test('sendChatAnnouncement publica el mensaje con color', async () => {
    const fetch = makeFetch([{ ok: true, body: {} }]);
    await twitch.sendChatAnnouncement({ broadcasterId: '999', moderatorId: '7', message: '¡En directo!' }, ENV, fetch);
    expect(fetch.calls[0].url).toContain('/chat/announcements?broadcaster_id=999&moderator_id=7');
    expect(fetch.calls[0].opts.method).toBe('POST');
    expect(JSON.parse(fetch.calls[0].opts.body)).toEqual({ message: '¡En directo!', color: 'primary' });
  });

  test('sendChatAnnouncement lanza si la API falla', async () => {
    const fetch = makeFetch([{ ok: false, body: {} }]);
    await expect(twitch.sendChatAnnouncement({ broadcasterId: '999', moderatorId: '7', message: 'x' }, ENV, fetch))
      .rejects.toThrow('anuncio');
  });

  test('sendChatMessage publica un mensaje normal con broadcaster y sender', async () => {
    const fetch = makeFetch([{ ok: true, body: { data: [{ message_id: 'm1', is_sent: true }] } }]);
    await twitch.sendChatMessage({ broadcasterId: '999', senderId: '7', message: 'hola' }, ENV, fetch);
    expect(fetch.calls[0].url).toContain('/chat/messages');
    expect(fetch.calls[0].opts.method).toBe('POST');
    expect(JSON.parse(fetch.calls[0].opts.body)).toEqual({ broadcaster_id: '999', sender_id: '7', message: 'hola' });
  });

  test('sendChatMessage usa el broadcaster como sender por defecto', async () => {
    const fetch = makeFetch([{ ok: true, body: { data: [{ message_id: 'm1', is_sent: true }] } }]);
    await twitch.sendChatMessage({ broadcasterId: '999', message: 'hola' }, ENV, fetch);
    expect(JSON.parse(fetch.calls[0].opts.body).sender_id).toBe('999');
  });

  test('sendChatMessage lanza si Twitch descarta el mensaje', async () => {
    const fetch = makeFetch([{ ok: true, body: { data: [{ is_sent: false, drop_reason: { message: 'rejected' } }] } }]);
    await expect(twitch.sendChatMessage({ broadcasterId: '999', message: 'x' }, ENV, fetch))
      .rejects.toThrow('rejected');
  });

  test('sendChatMessage lanza si la API falla', async () => {
    const fetch = makeFetch([{ ok: false, body: { message: 'fallo' } }]);
    await expect(twitch.sendChatMessage({ broadcasterId: '999', message: 'x' }, ENV, fetch))
      .rejects.toThrow('fallo');
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

test.describe('manageHeldMessage · mensajes retenidos', () => {
  test('aprueba (ALLOW) enviando user_id, msg_id y action', async () => {
    const fetch = makeFetch([{ ok: true, body: {} }]);
    await twitch.manageHeldMessage({ msgId: 'm1', action: 'ALLOW', moderatorId: '7' }, ENV, fetch);
    expect(fetch.calls[0].url).toContain('/moderation/automod/message');
    expect(fetch.calls[0].opts.method).toBe('POST');
    const sent = JSON.parse(fetch.calls[0].opts.body);
    expect(sent).toEqual({ user_id: '7', msg_id: 'm1', action: 'ALLOW' });
  });

  test('rechaza (DENY) sin lanzar cuando la API responde 204', async () => {
    const fetch = makeFetch([{ ok: true, body: {} }]);
    await twitch.manageHeldMessage({ msgId: 'm2', action: 'DENY', moderatorId: '7' }, ENV, fetch);
    expect(JSON.parse(fetch.calls[0].opts.body).action).toBe('DENY');
  });

  test('lanza si la API falla', async () => {
    const fetch = makeFetch([{ ok: false, body: {} }]);
    await expect(twitch.manageHeldMessage({ msgId: 'm3', action: 'ALLOW', moderatorId: '7' }, ENV, fetch))
      .rejects.toThrow('mensaje retenido');
  });
});

test.describe('createEventSubSubscription', () => {
  test('crea la suscripción con transporte websocket y session_id', async () => {
    const fetch = makeFetch([{ ok: true, body: { data: [{ id: 'sub1' }] } }]);
    await twitch.createEventSubSubscription(
      { type: 'automod.message.hold', version: '2', condition: { broadcaster_user_id: '999' }, sessionId: 'sess1' },
      ENV,
      fetch,
    );
    expect(fetch.calls[0].url).toContain('/eventsub/subscriptions');
    const sent = JSON.parse(fetch.calls[0].opts.body);
    expect(sent.type).toBe('automod.message.hold');
    expect(sent.version).toBe('2');
    expect(sent.transport).toEqual({ method: 'websocket', session_id: 'sess1' });
  });

  test('lanza con el mensaje de la API si falla', async () => {
    const fetch = makeFetch([{ ok: false, body: { message: 'subscription missing scope' } }]);
    await expect(twitch.createEventSubSubscription(
      { type: 'automod.message.hold', version: '2', condition: {}, sessionId: 'sess1' },
      ENV,
      fetch,
    )).rejects.toThrow('subscription missing scope');
  });
});
