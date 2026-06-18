// Disparo de efectos de sonido desde /admin hacia el overlay. El panel escribe el
// fichero a reproducir con un nonce incremental; el overlay lo recibe por SSE.
const { getJson, saveJson } = require('./savedData');

const SOUND_FILE = 'sound';

const getSound = () => {
  const s = getJson(SOUND_FILE);
  return s && typeof s === 'object' && 'nonce' in s ? s : { file: null, nonce: 0 };
};

const playSound = (file) => {
  const s = getSound();
  const next = { file, nonce: (s.nonce || 0) + 1 };
  saveJson(SOUND_FILE, next);
  return next;
};

module.exports = { getSound, playSound, SOUND_FILE };
