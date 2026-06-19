const { test, expect } = require('@playwright/test');
const { saveJson } = require('@stream-toolkit/common/savedData');
const alert = require('@stream-toolkit/common/alert');

test.describe('alert · alertas del overlay', () => {
  test('getAlert devuelve el default cuando no hay nada válido', () => {
    saveJson('alert', {});
    expect(alert.getAlert()).toEqual({ type: null, name: null, nonce: 0 });
  });

  test('triggerAlert guarda tipo/nombre e incrementa el nonce', () => {
    saveJson('alert', {});
    const first = alert.triggerAlert({ type: 'first-message', name: 'bob' });
    expect(first).toEqual({ type: 'first-message', name: 'bob', nonce: 1 });
    expect(alert.getAlert()).toEqual(first);

    const second = alert.triggerAlert({ type: 'follow', name: 'alice' });
    expect(second).toEqual({ type: 'follow', name: 'alice', nonce: 2 });
  });
});
