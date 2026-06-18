const { test, expect } = require('@playwright/test');
const { saveJson } = require('@stream-toolkit/common/savedData');
const scene = require('@stream-toolkit/common/scene');

test.describe('scene · estado de la escena', () => {
  test('getScene devuelve el default cuando no hay nada válido', () => {
    saveJson('scene', {});
    expect(scene.getScene()).toEqual({ game: 'king', screen: 'intro' });
  });

  test('setScene aplica game y screen válidos', () => {
    scene.setScene({ game: 'valorant', screen: 'game' });
    expect(scene.getScene()).toEqual({ game: 'valorant', screen: 'game' });
  });

  test('setScene ignora valores no válidos (mantiene el actual)', () => {
    scene.setScene({ game: 'mecha', screen: 'pause' });
    scene.setScene({ game: 'no-existe', screen: 'outro' });
    expect(scene.getScene()).toEqual({ game: 'mecha', screen: 'outro' });
  });
});
