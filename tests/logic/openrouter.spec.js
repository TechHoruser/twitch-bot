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
