const { test, expect } = require('@playwright/test');
const { saveJson } = require('@stream-toolkit/common/savedData');
const scene = require('@stream-toolkit/common/scene');

test.describe('scene · estado de la escena', () => {
  test('getScene devuelve el default cuando no hay nada válido', () => {
    saveJson('scene', {});
    expect(scene.getScene()).toEqual({ game: 'king', screen: 'intro', countdownEndsAt: null });
  });

  test('setScene aplica game y screen válidos', () => {
    scene.setScene({ game: 'valorant', screen: 'game' });
    expect(scene.getScene()).toEqual({ game: 'valorant', screen: 'game', countdownEndsAt: null });
  });

  test('setScene ignora valores no válidos (mantiene el actual)', () => {
    scene.setScene({ game: 'mecha', screen: 'pause' });
    scene.setScene({ game: 'no-existe', screen: 'outro' });
    expect(scene.getScene()).toEqual({ game: 'mecha', screen: 'outro', countdownEndsAt: null });
  });

  test('setScene fija y limpia countdownEndsAt (número o null), e ignora undefined', () => {
    scene.setScene({ game: 'king', screen: 'intro', countdownEndsAt: 1000 });
    expect(scene.getScene().countdownEndsAt).toBe(1000);
    scene.setScene({ screen: 'game' }); // sin countdownEndsAt → no se toca
    expect(scene.getScene().countdownEndsAt).toBe(1000);
    scene.setScene({ countdownEndsAt: null }); // null → se limpia
    expect(scene.getScene().countdownEndsAt).toBe(null);
  });
});
