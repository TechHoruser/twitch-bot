// Registro de presencia por directo: cada "sesión" representa una retransmisión y
// guarda el log de quién entra (join) y sale (part) del chat, además del pico de
// espectadores. Lo alimenta el panel /admin (que escucha JOIN/PART del IRC de
// Twitch) y lo visualiza la pestaña "Registro" como una línea de tiempo.
// Persistencia simple en fichero JSON (DATA_PATH), como el resto del proyecto.
const { getJson, saveJson } = require('./savedData');

const PRESENCE_FILE = 'presence';

// Estructura del fichero:
// { sessions: [{ id, title, startedAt, endedAt|null, peakViewers }],
//   events: { [sessionId]: [{ login, name, type:'join'|'part', ts }] } }
const getData = () => {
  const d = getJson(PRESENCE_FILE) || {};
  return {
    sessions: Array.isArray(d.sessions) ? d.sessions : [],
    events: d.events && typeof d.events === 'object' ? d.events : {},
  };
};

const save = (data) => saveJson(PRESENCE_FILE, data);

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Sesión abierta = la última sin endedAt. Devuelve { data, session } o null.
const findOpen = (data) => {
  for (let i = data.sessions.length - 1; i >= 0; i -= 1) {
    if (!data.sessions[i].endedAt) return data.sessions[i];
  }
  return null;
};

// Abre una nueva sesión de directo (cerrando antes cualquier sesión abierta).
const startSession = ({ title } = {}) => {
  const data = getData();
  const open = findOpen(data);
  if (open) open.endedAt = new Date().toISOString();
  const session = {
    id: newId(),
    title: title || `Directo ${new Date().toLocaleString('es-ES')}`,
    startedAt: new Date().toISOString(),
    endedAt: null,
    peakViewers: 0,
  };
  data.sessions.push(session);
  data.events[session.id] = [];
  save(data);
  return session;
};

// Cierra la sesión abierta (si la hay).
const endSession = () => {
  const data = getData();
  const open = findOpen(data);
  if (!open) return null;
  open.endedAt = new Date().toISOString();
  save(data);
  return open;
};

// Devuelve la sesión abierta, creando una por defecto si no existe. Así el log
// nunca se pierde aunque no se haya pulsado "Iniciar retransmisión".
const ensureSession = (data) => {
  let open = findOpen(data);
  if (!open) {
    open = {
      id: newId(),
      title: `Directo ${new Date().toLocaleString('es-ES')}`,
      startedAt: new Date().toISOString(),
      endedAt: null,
      peakViewers: 0,
    };
    data.sessions.push(open);
    data.events[open.id] = [];
  }
  return open;
};

// Último estado conocido de un usuario dentro de la sesión (join/part/null).
const lastStateOf = (events, login) => {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].login === login) return events[i].type;
  }
  return null;
};

// Registra una tanda de transiciones join/part. Sólo guarda los cambios reales de
// estado (si alguien ya constaba dentro, ignora otro "join"), para que la línea de
// tiempo refleje entradas y salidas y no el ruido del protocolo.
const logEvents = (incoming = []) => {
  if (!Array.isArray(incoming) || incoming.length === 0) return { added: 0 };
  const data = getData();
  const session = ensureSession(data);
  const events = data.events[session.id] || (data.events[session.id] = []);
  const ts = new Date().toISOString();
  let added = 0;
  for (const ev of incoming) {
    const login = (ev.login || '').toLowerCase();
    const type = ev.type === 'part' ? 'part' : 'join';
    if (!login) continue;
    if (lastStateOf(events, login) === type) continue; // sin cambio real
    events.push({ login, name: ev.name || login, type, ts });
    added += 1;
  }
  if (added > 0) save(data);
  return { added, sessionId: session.id };
};

// Actualiza el pico de espectadores de la sesión abierta (lo llama el sondeo de
// estado del directo). Devuelve la sesión o null si no hay ninguna abierta.
const recordViewers = (count) => {
  const n = Number(count);
  if (!Number.isFinite(n)) return null;
  const data = getData();
  const open = findOpen(data);
  if (!open) return null;
  if (n > (open.peakViewers || 0)) {
    open.peakViewers = n;
    save(data);
  }
  return open;
};

// Lista de sesiones (más reciente primero) con un resumen de usuarios. Ante un
// mismo instante de inicio, desempata por orden de inserción (la última, primera).
const getSessions = () => {
  const data = getData();
  return data.sessions
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (b.s.startedAt || '').localeCompare(a.s.startedAt || '') || b.i - a.i)
    .map(({ s }) => ({
      ...s,
      uniqueUsers: new Set((data.events[s.id] || []).map((e) => e.login)).size,
    }));
};

// Detalle de una sesión: la sesión + sus eventos en orden cronológico.
const getSessionDetail = (id) => {
  const data = getData();
  const session = data.sessions.find((s) => s.id === id);
  if (!session) return null;
  return { session, events: data.events[id] || [] };
};

module.exports = {
  PRESENCE_FILE,
  startSession,
  endSession,
  logEvents,
  recordViewers,
  getSessions,
  getSessionDetail,
};
