import OBSWebSocket from 'obs-websocket-js';

// Cliente obs-websocket compartido (singleton de servidor). Se conecta a OBS bajo
// demanda y se reutiliza entre requests. OBS expone su websocket en
// Herramientas ▸ obs-websocket (por defecto ws://127.0.0.1:4455).
const URL = process.env.OBS_WEBSOCKET_URL || 'ws://127.0.0.1:4455';
const PASSWORD = process.env.OBS_WEBSOCKET_PASSWORD || undefined;

// Guardamos el estado en globalThis para que el singleton sobreviva a los
// recompilados/recargas de módulos de `next dev`. Sin esto, en desarrollo cada
// request abría una conexión nueva a OBS (el panel de audio sondea cada 1,5 s),
// y OBS mostraba la notificación "Nueva conexión WebSocket" sin parar.
const store = (globalThis.__obsClient ??= { client: null, connected: false, connecting: null });

async function connect() {
  const obs = new OBSWebSocket();
  obs.on('ConnectionClosed', () => { store.connected = false; store.client = null; });
  obs.on('ConnectionError', () => { store.connected = false; store.client = null; });
  await obs.connect(URL, PASSWORD);
  store.client = obs;
  store.connected = true;
  return obs;
}

export async function getObs() {
  if (store.client && store.connected) return store.client;
  if (!store.connecting) {
    store.connecting = connect().finally(() => { store.connecting = null; });
  }
  return store.connecting;
}
