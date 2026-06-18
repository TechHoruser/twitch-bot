const { test, expect } = require('@playwright/test');
const { saveJson } = require('@stream-toolkit/common/savedData');
const music = require('@stream-toolkit/common/music');

const seedLibrary = () => saveJson('music-library', {
  playlists: {
    lofi: [
      { id: '1', file: '1.mp3', title: 'A', artist: 'x' },
      { id: '2', file: '2.mp3', title: 'B', artist: 'y' },
      { id: '3', file: '3.mp3', title: 'C', artist: 'z' },
    ],
    epic: [{ id: '9', file: '9.mp3', title: 'E', artist: 'w' }],
  },
});

test.describe('music · estado del reproductor', () => {
  test.beforeEach(() => {
    seedLibrary();
    saveJson('music', { ...music.DEFAULT_MUSIC });
  });

  test('getMusic elige la primera playlist cuando no hay ninguna', () => {
    const m = music.getMusic();
    expect(m.playlist).toBe('lofi');
    expect(m.index).toBe(0);
  });

  test('next y prev avanzan en módulo de la longitud', () => {
    music.setPlaylist('lofi');
    expect(music.getMusic().index).toBe(0);
    music.next();
    expect(music.getMusic().index).toBe(1);
    music.next();
    music.next(); // 2 -> 0 (envuelve)
    expect(music.getMusic().index).toBe(0);
    music.prev(); // 0 -> 2 (envuelve)
    expect(music.getMusic().index).toBe(2);
  });

  test('currentTrack resuelve el archivo del índice actual', () => {
    music.setPlaylist('lofi');
    music.next();
    expect(music.currentTrack().file).toBe('2.mp3');
  });

  test('cambiar de playlist reinicia el índice', () => {
    music.setPlaylist('lofi');
    music.next();
    music.setPlaylist('epic');
    expect(music.getMusic().playlist).toBe('epic');
    expect(music.getMusic().index).toBe(0);
  });

  test('setVolume se satura a [0,1]', () => {
    music.setVolume(2);
    expect(music.getMusic().volume).toBe(1);
    music.setVolume(-1);
    expect(music.getMusic().volume).toBe(0);
  });

  test('savePlaylist / renamePlaylist / deletePlaylist', () => {
    music.savePlaylist('nueva', [{ id: '7', file: '7.mp3', title: 'G', artist: 'q' }]);
    expect(music.getLibrary().playlists.nueva).toHaveLength(1);
    music.renamePlaylist('nueva', 'renombrada');
    expect(music.getLibrary().playlists.renombrada).toBeTruthy();
    expect(music.getLibrary().playlists.nueva).toBeUndefined();
    music.deletePlaylist('renombrada');
    expect(music.getLibrary().playlists.renombrada).toBeUndefined();
  });
});
