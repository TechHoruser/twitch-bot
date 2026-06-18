const { test, expect } = require('@playwright/test');
const { resetData } = require('../helpers/data');
const saved = require('@stream-toolkit/common/savedData');

test.beforeEach(() => resetData());

test.describe('savedData · JSON', () => {
  test('getJson devuelve {} cuando no existe el fichero', () => {
    expect(saved.getJson('inexistente')).toEqual({});
  });

  test('saveJson + getJson hacen round-trip', () => {
    saved.saveJson('demo', { a: 1, b: 'x' });
    expect(saved.getJson('demo')).toEqual({ a: 1, b: 'x' });
  });

  test('clearJson deja un objeto vacío', () => {
    saved.saveJson('demo', { a: 1 });
    saved.clearJson('demo');
    expect(saved.getJson('demo')).toEqual({});
  });

  test('deleteJson elimina el fichero', () => {
    saved.saveJson('demo', { a: 1 });
    saved.deleteJson('demo');
    expect(saved.getJson('demo')).toEqual({});
  });
});

test.describe('savedData · cola', () => {
  test('una cola nueva está vacía', () => {
    expect(saved.getQueueLength('queue')).toBe(0);
    expect(saved.getQueue('queue')).toEqual([]);
  });

  test('pushIntoQueue añade elementos y asigna uuid', () => {
    saved.pushIntoQueue('queue', { username: 'a' });
    const queue = saved.getQueue('queue');
    expect(queue).toHaveLength(1);
    expect(queue[0].username).toBe('a');
    expect(queue[0].uuid).toBeTruthy();
    expect(queue[0].priority).toBe(1);
  });

  test('mantiene el uuid existente si ya lo trae', () => {
    saved.pushIntoQueue('queue', { username: 'a', uuid: 'fixed-uuid' });
    expect(saved.getQueue('queue')[0].uuid).toBe('fixed-uuid');
  });

  test('respeta el orden de prioridad (mayor prioridad primero)', () => {
    saved.pushIntoQueue('queue', { username: 'normal' }, 1);
    saved.pushIntoQueue('queue', { username: 'vip' }, 5);
    saved.pushIntoQueue('queue', { username: 'normal2' }, 1);
    expect(saved.getQueue('queue').map((e) => e.username)).toEqual(['vip', 'normal', 'normal2']);
  });

  test('popFromQueue saca el primero (FIFO)', () => {
    saved.pushIntoQueue('queue', { username: 'a' });
    saved.pushIntoQueue('queue', { username: 'b' });
    expect(saved.popFromQueue('queue').username).toBe('a');
    expect(saved.getQueueLength('queue')).toBe(1);
  });

  test('popFromQueue devuelve undefined si está vacía', () => {
    expect(saved.popFromQueue('queue')).toBeUndefined();
  });

  test('getElementInQueue localiza posición y elemento', () => {
    saved.pushIntoQueue('queue', { username: 'a' });
    saved.pushIntoQueue('queue', { username: 'b' });
    const found = saved.getElementInQueue('queue', (o) => o.username, 'b');
    expect(found.position).toBe(1);
    expect(found.element.username).toBe('b');
  });

  test('getElementInQueue devuelve null si no está', () => {
    saved.pushIntoQueue('queue', { username: 'a' });
    expect(saved.getElementInQueue('queue', (o) => o.username, 'z')).toBeNull();
  });

  test('removeFromQueue elimina por clave', () => {
    saved.pushIntoQueue('queue', { username: 'a' });
    saved.pushIntoQueue('queue', { username: 'b' });
    saved.removeFromQueue('queue', (o) => o.username, 'a');
    expect(saved.getQueue('queue').map((e) => e.username)).toEqual(['b']);
  });

  test('removeFromQueue no falla si la clave no existe', () => {
    saved.pushIntoQueue('queue', { username: 'a' });
    saved.removeFromQueue('queue', (o) => o.username, 'z');
    expect(saved.getQueueLength('queue')).toBe(1);
  });

  test('clearQueue vacía la cola', () => {
    saved.pushIntoQueue('queue', { username: 'a' });
    saved.clearQueue('queue');
    expect(saved.getQueue('queue')).toEqual([]);
  });
});
