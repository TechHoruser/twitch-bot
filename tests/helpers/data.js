// Utilidades compartidas por las pruebas de lógica.
const fs = require('fs');
const path = require('path');

const DATA_PATH = process.env.DATA_PATH;

// Borra todos los ficheros JSON del almacenamiento de prueba para empezar limpio.
const resetData = () => {
  if (!DATA_PATH || !fs.existsSync(DATA_PATH)) return;
  for (const file of fs.readdirSync(DATA_PATH)) {
    fs.unlinkSync(path.join(DATA_PATH, file));
  }
};

// Cliente de Twitch (tmi.js) simulado: captura los mensajes enviados con say().
const makeClient = () => {
  const messages = [];
  return {
    messages,
    say: (channel, message) => { messages.push({ channel, message }); },
    last: () => (messages.length ? messages[messages.length - 1].message : undefined),
    sayCount: () => messages.length,
  };
};

const broadcasterTags = (username = 'streamer') => ({
  username,
  badges: { broadcaster: '1' },
});

const viewerTags = (username = 'viewer') => ({
  username,
  badges: {},
});

module.exports = {
  DATA_PATH,
  resetData,
  makeClient,
  broadcasterTags,
  viewerTags,
};
