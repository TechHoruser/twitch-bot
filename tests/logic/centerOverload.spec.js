const { test, expect } = require('@playwright/test');
const { resetData } = require('../helpers/data');
const overload = require('@stream-toolkit/common/centerOverload');
const saved = require('@stream-toolkit/common/savedData');

test.beforeEach(() => resetData());

test('nextOverload encola un overlay con type/payload/duration', () => {
  overload.nextOverload('next-match', { chesscom: 'Bob' }, 5000, 1);
  const queue = saved.getQueue(overload.OVERLOAD_CENTER_QUEUE_FILE);
  expect(queue).toHaveLength(1);
  expect(queue[0].type).toBe('next-match');
  expect(queue[0].payload).toEqual({ chesscom: 'Bob' });
  expect(queue[0].duration).toBe(5000);
});

test('processNext devuelve null si la cola está vacía', () => {
  expect(overload.processNext()).toBeNull();
});

test('processNext mueve el overlay al centro', () => {
  overload.nextOverload('next-match', { chesscom: 'Bob' }, 5000);
  const processed = overload.processNext();
  expect(processed.type).toBe('next-match');
  expect(saved.getJson(overload.OVERLOAD_CENTER_FILE)).toEqual({
    type: 'next-match',
    payload: { chesscom: 'Bob' },
  });
  expect(saved.getQueueLength(overload.OVERLOAD_CENTER_QUEUE_FILE)).toBe(0);
});

test('processNext limpia el centro pasada la duración', async () => {
  overload.nextOverload('next-match', { chesscom: 'Bob' }, 50);
  overload.processNext();
  expect(saved.getJson(overload.OVERLOAD_CENTER_FILE).type).toBe('next-match');
  await new Promise((r) => setTimeout(r, 120));
  expect(saved.getJson(overload.OVERLOAD_CENTER_FILE)).toEqual({});
});

test('respeta la prioridad de los overlays', () => {
  overload.nextOverload('a', {}, 1000, 1);
  overload.nextOverload('b', {}, 1000, 9);
  expect(overload.processNext().type).toBe('b');
});
