// Alertas visuales del overlay (animación de "primer mensaje" y "nuevo follow").
// El panel de /admin las dispara con un nonce incremental; el overlay las recibe
// por SSE (igual que sound.js). El sonido/voz de esas alertas NO va aquí: se
// reproduce en privado en el panel para no capturarlo en el directo.
const { getJson, saveJson } = require('./savedData');

const ALERT_FILE = 'alert';

const getAlert = () => {
  const a = getJson(ALERT_FILE);
  return a && typeof a === 'object' && 'nonce' in a ? a : { type: null, name: null, nonce: 0 };
};

// type: 'first-message' | 'follow'.
const triggerAlert = ({ type, name }) => {
  const a = getAlert();
  const next = { type, name, nonce: (a.nonce || 0) + 1 };
  saveJson(ALERT_FILE, next);
  return next;
};

module.exports = { getAlert, triggerAlert, ALERT_FILE };
