// Estado del reproductor de música (autoritativo en el servidor). El panel /admin
// envía acciones que mutan este estado; el overlay lo recibe por SSE y reproduce.
// La librería de pistas la escribe setup-music.js en music-library.json.
const { getJson, saveJson } = require('./savedData');

const MUSIC_FILE = 'music';
const LIBRARY_FILE = 'music-library';
const DEFAULT_MUSIC = { playlist: null, index: 0, playing: false, volume: 0.6, nonce: 0 };

// { playlists: { <nombre>: [ {id,file,title,artist,duration,licenseUrl} ] } }
const getLibrary = () => {
  const lib = getJson(LIBRARY_FILE);
  return lib && lib.playlists ? lib : { playlists: {} };
};
const playlistNames = () => Object.keys(getLibrary().playlists);
const tracksOf = (playlist) => getLibrary().playlists[playlist] || [];

// Estado saneado contra la librería (playlist válida, índice dentro de rango).
const getMusic = () => {
  const stored = getJson(MUSIC_FILE);
  const m = { ...DEFAULT_MUSIC, ...(stored && typeof stored === 'object' ? stored : {}) };
  const names = playlistNames();
  if (!m.playlist || !names.includes(m.playlist)) {
    m.playlist = names[0] || null;
    m.index = 0;
  }
  const len = tracksOf(m.playlist).length;
  m.index = len ? ((m.index % len) + len) % len : 0;
  m.volume = Math.min(1, Math.max(0, Number(m.volume)));
  return m;
};

const persist = (m) => { m.nonce = (m.nonce || 0) + 1; saveJson(MUSIC_FILE, m); return m; };

const setMusic = (partial = {}) => persist(Object.assign(getMusic(), partial));

const next = () => {
  const m = getMusic();
  const len = tracksOf(m.playlist).length;
  if (len) m.index = (m.index + 1) % len;
  m.playing = true;
  return persist(m);
};

const prev = () => {
  const m = getMusic();
  const len = tracksOf(m.playlist).length;
  if (len) m.index = (m.index - 1 + len) % len;
  m.playing = true;
  return persist(m);
};

const setPlaylist = (name) => {
  const m = getMusic();
  if (playlistNames().includes(name)) { m.playlist = name; m.index = 0; m.playing = true; }
  return persist(m);
};

const togglePlay = () => { const m = getMusic(); m.playing = !m.playing; return persist(m); };
const setPlaying = (v) => setMusic({ playing: !!v });
const setVolume = (v) => setMusic({ volume: Math.min(1, Math.max(0, Number(v))) });

// Pista actual resuelta (para overlay y admin).
const currentTrack = (m = getMusic()) => tracksOf(m.playlist)[m.index] || null;

// Quita la pista actual de su playlist. El índice se mantiene para que pase a
// sonar la siguiente pista (o vuelve a 0 si era la última).
const removeCurrentTrack = () => {
  const m = getMusic();
  const tracks = tracksOf(m.playlist);
  if (!tracks.length) return m;
  const remaining = tracks.filter((_, i) => i !== m.index);
  savePlaylist(m.playlist, remaining);
  m.index = remaining.length ? m.index % remaining.length : 0;
  return persist(m);
};

// --- gestión de playlists (panel /admin) ----------------------------------
const saveLibrary = (lib) => saveJson(LIBRARY_FILE, lib);

const savePlaylist = (name, tracks = []) => {
  const lib = getLibrary();
  lib.playlists[name] = tracks;
  saveLibrary(lib);
  return lib;
};

const deletePlaylist = (name) => {
  const lib = getLibrary();
  delete lib.playlists[name];
  saveLibrary(lib);
  return lib;
};

const renamePlaylist = (from, to) => {
  const lib = getLibrary();
  if (lib.playlists[from] && to && !lib.playlists[to]) {
    lib.playlists[to] = lib.playlists[from];
    delete lib.playlists[from];
    saveLibrary(lib);
  }
  return lib;
};

module.exports = {
  getMusic, setMusic, getLibrary, playlistNames, tracksOf, currentTrack,
  next, prev, setPlaylist, togglePlay, setPlaying, setVolume, removeCurrentTrack,
  savePlaylist, deletePlaylist, renamePlaylist,
  MUSIC_FILE, LIBRARY_FILE, DEFAULT_MUSIC,
};
