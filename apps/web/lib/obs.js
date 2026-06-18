import OBSWebSocket from 'obs-websocket-js';

// Cliente obs-websocket compartido (singleton de servidor). Se conecta a OBS bajo
// demanda y se reutiliza entre requests. OBS expone su websocket en
// Herramientas ▸ obs-websocket (por defecto ws://127.0.0.1:4455).
const URL = process.env.OBS_WEBSOCKET_URL || 'ws://127.0.0.1:4455';
const PASSWORD = process.env.OBS_WEBSOCKET_PASSWORD || undefined;

let client = null;
let connected = false;
let connecting = null;

async function connect() {
  const obs = new OBSWebSocket();
  obs.on('ConnectionClosed', () => { connected = false; client = null; });
  obs.on('ConnectionError', () => { connected = false; client = null; });
  await obs.connect(URL, PASSWORD);
  client = obs;
  connected = true;
  return obs;
}

export async function getObs() {
  if (client && connected) return client;
  if (!connecting) {
    connecting = connect().finally(() => { connecting = null; });
  }
  return connecting;
}
