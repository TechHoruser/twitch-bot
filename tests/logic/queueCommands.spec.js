const { test, expect } = require('@playwright/test');
const { resetData, makeClient, broadcasterTags, viewerTags } = require('../helpers/data');
// El mock de chess debe cargarse antes que queueCommands (requiere chess).
const chessMock = require('../helpers/chessMock');
const { handleCommandByQueue } = require('../../common-js/queueCommands');
const saved = require('../../common-js/savedData');

const CHANNEL = '#canal';

test.beforeEach(() => {
  resetData();
  chessMock.resetCalls();
  chessMock.setStats();
});

const run = (client, tags, message) => handleCommandByQueue(client, CHANNEL, tags, message);

test('!cola muestra la ayuda', async () => {
  const client = makeClient();
  await run(client, viewerTags('bob'), '!cola');
  expect(client.last()).toContain('Comandos disponibles');
});

test.describe('!cola:unirme', () => {
  test('añade a un usuario nuevo y guarda su mapping', async () => {
    const client = makeClient();
    await run(client, viewerTags('bob'), '!cola:unirme BobChess');
    expect(client.last()).toContain('añadido/a a la cola');
    expect(saved.getQueueLength('queue')).toBe(1);
    expect(saved.getJson('twitch-chess').bob).toBe('BobChess');
  });

  test('pide el usuario de Chess.com si no se proporciona y no hay mapping', async () => {
    const client = makeClient();
    await run(client, viewerTags('bob'), '!cola:unirme');
    expect(client.last()).toContain('proporciona tu usuario de Chess.com');
    expect(saved.getQueueLength('queue')).toBe(0);
  });

  test('avisa si el usuario de Chess.com no existe', async () => {
    chessMock.setError();
    const client = makeClient();
    await run(client, viewerTags('bob'), '!cola:unirme NoExiste');
    expect(client.last()).toContain('no se encontró el usuario de Chess.com');
    expect(saved.getQueueLength('queue')).toBe(0);
  });

  test('impide unirse dos veces', async () => {
    const client = makeClient();
    await run(client, viewerTags('bob'), '!cola:unirme BobChess');
    await run(client, viewerTags('bob'), '!cola:unirme BobChess');
    expect(client.last()).toContain('ya estás en la cola');
    expect(saved.getQueueLength('queue')).toBe(1);
  });

  test('avisa si intentas cambiar tu usuario guardado', async () => {
    const client = makeClient();
    await run(client, viewerTags('bob'), '!cola:unirme BobChess'); // guarda mapping
    await run(client, viewerTags('bob'), '!cola:salir'); // sale de la cola
    await run(client, viewerTags('bob'), '!cola:unirme OtroChess'); // distinto al guardado
    expect(client.last()).toContain('tienes un usuario de Chess.com guardado');
  });
});

test('!cola:limpiar-usuario borra el mapping', async () => {
  const client = makeClient();
  await run(client, viewerTags('bob'), '!cola:unirme BobChess');
  await run(client, viewerTags('bob'), '!cola:limpiar-usuario');
  expect(client.last()).toContain('ha sido eliminado');
  expect(saved.getJson('twitch-chess').bob).toBeUndefined();
});

test.describe('!cola:ver', () => {
  test('cola vacía', async () => {
    const client = makeClient();
    await run(client, viewerTags('bob'), '!cola:ver');
    expect(client.last()).toContain('La cola está vacía');
  });

  test('muestra tu posición si estás en la cola', async () => {
    const client = makeClient();
    await run(client, viewerTags('bob'), '!cola:unirme BobChess');
    await run(client, viewerTags('bob'), '!cola:ver');
    expect(client.last()).toContain('posición 1');
  });

  test('muestra solo el total si no estás en la cola', async () => {
    const client = makeClient();
    await run(client, viewerTags('bob'), '!cola:unirme BobChess');
    await run(client, viewerTags('ana'), '!cola:ver');
    expect(client.last()).toContain('1 persona(s) en la cola');
    expect(client.last()).not.toContain('posición');
  });
});

test.describe('!cola:salir', () => {
  test('sales si estabas en la cola', async () => {
    const client = makeClient();
    await run(client, viewerTags('bob'), '!cola:unirme BobChess');
    await run(client, viewerTags('bob'), '!cola:salir');
    expect(client.last()).toContain('has salido de la cola');
    expect(saved.getQueueLength('queue')).toBe(0);
  });

  test('avisa si no estabas en la cola', async () => {
    const client = makeClient();
    await run(client, viewerTags('bob'), '!cola:salir');
    expect(client.last()).toContain('no estás en la cola');
  });
});

test.describe('!cola:limpiar (solo broadcaster)', () => {
  test('el broadcaster vacía la cola', async () => {
    const client = makeClient();
    await run(client, viewerTags('bob'), '!cola:unirme BobChess');
    await run(client, broadcasterTags(), '!cola:limpiar');
    expect(client.last()).toContain('La cola ha sido limpiada');
    expect(saved.getQueueLength('queue')).toBe(0);
  });

  test('un viewer no puede limpiar la cola', async () => {
    const client = makeClient();
    await run(client, viewerTags('bob'), '!cola:unirme BobChess');
    const before = client.sayCount();
    await run(client, viewerTags('bob'), '!cola:limpiar');
    expect(client.sayCount()).toBe(before); // sin respuesta
    expect(saved.getQueueLength('queue')).toBe(1);
  });
});

test.describe('!cola:siguiente (solo broadcaster)', () => {
  test('avisa cuando la cola está vacía', async () => {
    const client = makeClient();
    await run(client, broadcasterTags(), '!cola:siguiente');
    expect(client.last()).toContain('La cola está vacía');
  });

  test('saca al primero y dispara el overlay next-match', async () => {
    const client = makeClient();
    await run(client, viewerTags('bob'), '!cola:unirme BobChess');
    await run(client, broadcasterTags(), '!cola:siguiente');
    expect(client.last()).toContain('El siguiente en la cola es @bob');
    expect(saved.getQueueLength('queue')).toBe(0);

    const overloadQueue = saved.getQueue('overload-center-queue');
    expect(overloadQueue).toHaveLength(1);
    expect(overloadQueue[0].type).toBe('next-match');
    expect(overloadQueue[0].payload.chesscom).toBe('BobChess');
  });
});
