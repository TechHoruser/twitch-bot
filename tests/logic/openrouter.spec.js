const { test, expect } = require('@playwright/test');
const openrouter = require('@stream-toolkit/common/openrouter');

const ENV = { OPENROUTER_API_KEY: 'key', OPENROUTER_MODEL: 'test/model' };

// fetch simulado: responde con el JSON que devolvería el modelo en choices[].
const makeFetch = (content, ok = true, body) => {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok,
      status: ok ? 200 : 401,
      json: async () => body || { choices: [{ message: { content } }] },
    };
  };
  fn.calls = calls;
  return fn;
};

test.describe('parseVerdict', () => {
  test('acepta JSON limpio y acota la confianza', () => {
    expect(openrouter.parseVerdict('{"verdict":"allow","confidence":0.9,"reason":"saludo"}'))
      .toEqual({ verdict: 'allow', confidence: 0.9, reason: 'saludo' });
  });

  test('tolera fences ```json y recorta el motivo', () => {
    const long = 'x'.repeat(300);
    const out = openrouter.parseVerdict('```json\n{"verdict":"deny","confidence":2,"reason":"' + long + '"}\n```');
    expect(out.verdict).toBe('deny');
    expect(out.confidence).toBe(1); // acotada a [0,1]
    expect(out.reason.length).toBe(200);
  });

  test('veredicto desconocido cae en review y confidence inválida en 0', () => {
    expect(openrouter.parseVerdict('{"verdict":"???","confidence":"nan"}'))
      .toEqual({ verdict: 'review', confidence: 0, reason: '' });
  });

  test('lanza si no hay JSON', () => {
    expect(() => openrouter.parseVerdict('no soy json')).toThrow('JSON');
  });
});

test.describe('triageMessage', () => {
  test('lanza si falta la API key', async () => {
    await expect(openrouter.triageMessage({ name: 'a', text: 'hola' }, {}, makeFetch('{}')))
      .rejects.toThrow('OPENROUTER_API_KEY');
  });

  test('envía el modelo y el mensaje, y devuelve el veredicto', async () => {
    const fetch = makeFetch('{"verdict":"allow","confidence":0.7,"reason":"ok"}');
    const out = await openrouter.triageMessage({ name: 'bob', text: 'buenas!' }, ENV, fetch);
    expect(out).toEqual({ verdict: 'allow', confidence: 0.7, reason: 'ok' });
    expect(fetch.calls[0].url).toContain('openrouter.ai');
    const sent = JSON.parse(fetch.calls[0].opts.body);
    expect(sent.model).toBe('test/model');
    expect(fetch.calls[0].opts.headers.Authorization).toBe('Bearer key');
    expect(sent.messages.at(-1).content).toContain('buenas!');
  });

  test('propaga el error de la API', async () => {
    const fetch = makeFetch(null, false, { error: { message: 'sin créditos' } });
    await expect(openrouter.triageMessage({ name: 'a', text: 'hola' }, ENV, fetch))
      .rejects.toThrow('sin créditos');
  });
});

test.describe('formatContext', () => {
  test('solo incluye los datos configurados', () => {
    const out = openrouter.formatContext({
      discordLink: 'https://discord.gg/x',
      chess: { name: 'Lichess', profileLink: 'https://lichess.org/@/yo' },
      stream: { title: 'Partida ranked', gameName: 'Chess' },
    });
    expect(out).toContain('Discord: https://discord.gg/x');
    expect(out).toContain('Ajedrez (Lichess): perfil https://lichess.org/@/yo');
    expect(out).toContain('"Partida ranked" · jugando a Chess');
    expect(out).not.toContain('club/equipo');
  });

  test('sin datos devuelve un marcador', () => {
    expect(openrouter.formatContext({})).toContain('sin datos extra');
  });
});

test.describe('assistChat', () => {
  test('lanza si falta la API key', async () => {
    await expect(openrouter.assistChat({ messages: [{ name: 'a', text: 'hola' }] }, {}, makeFetch('hey')))
      .rejects.toThrow('OPENROUTER_API_KEY');
  });

  test('manda los mensajes y el contexto, y limpia la respuesta', async () => {
    const fetch = makeFetch('"¡Claro! Tienes el Discord en discord.gg/x 😎"');
    const out = await openrouter.assistChat({
      messages: [{ name: 'bob', text: '¿cuál es el discord?' }],
      context: { discordLink: 'https://discord.gg/x' },
    }, ENV, fetch);

    // Quita las comillas envolventes del modelo.
    expect(out).toBe('¡Claro! Tienes el Discord en discord.gg/x 😎');
    const sent = JSON.parse(fetch.calls[0].opts.body);
    expect(sent.model).toBe('test/model');
    expect(sent.response_format).toBeUndefined(); // texto libre, no JSON
    const userMsg = sent.messages.at(-1).content;
    expect(userMsg).toContain('bob: ¿cuál es el discord?');
    expect(userMsg).toContain('Discord: https://discord.gg/x');
  });

  test('solo pasa los últimos 50 mensajes y acota la longitud', async () => {
    const fetch = makeFetch('x'.repeat(600));
    const messages = Array.from({ length: 70 }, (_, i) => ({ name: `u${i}`, text: `m${i}` }));
    const out = await openrouter.assistChat({ messages }, ENV, fetch);

    expect(out.length).toBe(480); // recortado al máximo de un anuncio
    const userMsg = JSON.parse(fetch.calls[0].opts.body).messages.at(-1).content;
    expect(userMsg).not.toContain('u19: m19'); // el 51º empezando por el final queda fuera
    expect(userMsg).toContain('u20: m20');
    expect(userMsg).toContain('u69: m69');
  });
});
