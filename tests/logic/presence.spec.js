const { test, expect } = require('@playwright/test');
const { saveJson } = require('@stream-toolkit/common/savedData');
const presence = require('@stream-toolkit/common/presence');

test.describe('presence · registro de directos', () => {
  test.beforeEach(() => {
    saveJson(presence.PRESENCE_FILE, { sessions: [], events: {} });
  });

  test('startSession abre una sesión y endSession la cierra', () => {
    const s = presence.startSession({ title: 'Directo de prueba' });
    expect(s.title).toBe('Directo de prueba');
    expect(s.endedAt).toBeNull();

    const ended = presence.endSession();
    expect(ended.id).toBe(s.id);
    expect(ended.endedAt).not.toBeNull();
  });

  test('startSession cierra la sesión anterior que siguiera abierta', () => {
    const first = presence.startSession({ title: 'A' });
    presence.startSession({ title: 'B' });
    const detail = presence.getSessionDetail(first.id);
    expect(detail.session.endedAt).not.toBeNull();
  });

  test('logEvents sólo guarda transiciones reales (sin ruido)', () => {
    const s = presence.startSession({ title: 'live' });
    presence.logEvents([{ login: 'Ana', type: 'join' }]);
    presence.logEvents([{ login: 'ana', type: 'join' }]); // duplicado: se ignora
    presence.logEvents([{ login: 'ana', type: 'part' }]);
    presence.logEvents([{ login: 'ana', type: 'part' }]); // duplicado: se ignora

    const { events } = presence.getSessionDetail(s.id);
    expect(events.map((e) => e.type)).toEqual(['join', 'part']);
    expect(events[0].login).toBe('ana');
  });

  test('logEvents crea una sesión automática si no hay ninguna abierta', () => {
    const res = presence.logEvents([{ login: 'bob', type: 'join' }]);
    expect(res.added).toBe(1);
    const sessions = presence.getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].uniqueUsers).toBe(1);
  });

  test('recordViewers guarda sólo el pico de espectadores', () => {
    const s = presence.startSession({ title: 'live' });
    presence.recordViewers(10);
    presence.recordViewers(42);
    presence.recordViewers(7);
    const detail = presence.getSessionDetail(s.id);
    expect(detail.session.peakViewers).toBe(42);
  });

  test('getSessions ordena por inicio descendente', () => {
    const a = presence.startSession({ title: 'A' });
    presence.endSession();
    const b = presence.startSession({ title: 'B' });
    const sessions = presence.getSessions();
    expect(sessions[0].id).toBe(b.id);
    expect(sessions[1].id).toBe(a.id);
  });
});
