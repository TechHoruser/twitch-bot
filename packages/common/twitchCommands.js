// Comandos de chat de Twitch que no son de cola (Discord, Chess.com, baneos).
// La lógica se extrae aquí para poder testearla de forma aislada, inyectando
// `fetch`, el entorno y el broadcaster_id.

const TWITCH_HELIX = 'https://api.twitch.tv/helix';
const KICK_TIME = 300; // Tiempo de timeout por defecto en segundos

const PROVIDER_NAMES = { lichess: 'Lichess', chesscom: 'Chess.com' };

// Resuelve el proveedor de ajedrez activo y sus enlaces (perfil / club) a
// partir del entorno inyectado.
const resolveChessLinks = (env) => {
  const key = PROVIDER_NAMES[(env.CHESS_PROVIDER || 'lichess').toLowerCase()] ? (env.CHESS_PROVIDER || 'lichess').toLowerCase() : 'lichess';
  const isLichess = key === 'lichess';
  return {
    name: PROVIDER_NAMES[key],
    isLichess,
    profileLink: isLichess ? env.LICHESS_PROFILE_LINK : env.CHESSCOM_PROFILE_LINK,
    clubLink: isLichess ? env.LICHESS_TEAM_LINK : env.CHESSCOM_CLUB_LINK,
  };
};

const getUserId = async (username, env = process.env, fetchFn = fetch) => {
  const response = await fetchFn(`${TWITCH_HELIX}/users?login=${username}`, {
    headers: {
      'Client-ID': env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${env.TWITCH_OAUTH_TOKEN}`,
    },
  });

  const data = await response.json();
  if (data.data && data.data.length > 0) {
    return data.data[0].id;
  }
  return null;
};

const getBroadcasterId = (env = process.env, fetchFn = fetch) =>
  getUserId(env.TWITCH_CHANNEL_NAME, env, fetchFn);

// Id del dueño del token (= /users sin login). Es el moderator_id que exige Helix
// y debe coincidir con el usuario del OAuth token.
const getModeratorId = async (env = process.env, fetchFn = fetch) => {
  const response = await fetchFn(`${TWITCH_HELIX}/users`, {
    headers: {
      'Client-ID': env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${env.TWITCH_OAUTH_TOKEN}`,
    },
  });
  const data = await response.json();
  return data.data?.[0]?.id ?? null;
};

const authHeaders = (env) => ({
  'Client-ID': env.TWITCH_CLIENT_ID,
  'Authorization': `Bearer ${env.TWITCH_OAUTH_TOKEN}`,
  'Content-Type': 'application/json',
});

// Banea (sin duration) o aplica timeout (con duration en segundos) vía Helix.
const banUser = async ({ userId, duration, reason, broadcasterId, moderatorId }, env = process.env, fetchFn = fetch) => {
  if (!broadcasterId) {
    throw new Error('No se conoce el broadcaster_id todavía. Reinicia el bot e inténtalo de nuevo.');
  }

  const response = await fetchFn(
    `${TWITCH_HELIX}/moderation/bans?broadcaster_id=${broadcasterId}&moderator_id=${moderatorId || broadcasterId}`,
    {
      method: 'POST',
      headers: authHeaders(env),
      body: JSON.stringify({ data: { user_id: userId, duration, reason } }),
    }
  );

  if (!response.ok) {
    throw new Error('Error al banear al usuario');
  }
  return true;
};

// Quita el ban/timeout de un usuario.
const unbanUser = async ({ userId, broadcasterId, moderatorId }, env = process.env, fetchFn = fetch) => {
  const response = await fetchFn(
    `${TWITCH_HELIX}/moderation/bans?broadcaster_id=${broadcasterId}&moderator_id=${moderatorId || broadcasterId}&user_id=${userId}`,
    { method: 'DELETE', headers: authHeaders(env) }
  );
  if (!response.ok && response.status !== 204) {
    throw new Error('Error al quitar el ban');
  }
  return true;
};

// Borra un mensaje concreto del chat (o todos si no se pasa messageId).
const deleteMessage = async ({ broadcasterId, moderatorId, messageId }, env = process.env, fetchFn = fetch) => {
  const qs = `broadcaster_id=${broadcasterId}&moderator_id=${moderatorId || broadcasterId}` +
    (messageId ? `&message_id=${messageId}` : '');
  const response = await fetchFn(`${TWITCH_HELIX}/moderation/chat?${qs}`, {
    method: 'DELETE',
    headers: authHeaders(env),
  });
  if (!response.ok && response.status !== 204) {
    throw new Error('Error al borrar el mensaje');
  }
  return true;
};

// Lee la información actual del directo (título y categoría/juego).
const getChannelInfo = async ({ broadcasterId }, env = process.env, fetchFn = fetch) => {
  const response = await fetchFn(`${TWITCH_HELIX}/channels?broadcaster_id=${broadcasterId}`, {
    headers: authHeaders(env),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Error al leer la información del canal');
  const c = data.data?.[0] || {};
  return { title: c.title || '', gameId: c.game_id || '', gameName: c.game_name || '' };
};

// Actualiza el título y/o el juego del directo. Requiere channel:manage:broadcast
// y que el token pertenezca al propio broadcaster.
const updateChannelInfo = async ({ broadcasterId, title, gameId }, env = process.env, fetchFn = fetch) => {
  const body = {};
  if (title !== undefined) body.title = title;
  if (gameId !== undefined) body.game_id = gameId;
  const response = await fetchFn(`${TWITCH_HELIX}/channels?broadcaster_id=${broadcasterId}`, {
    method: 'PATCH',
    headers: authHeaders(env),
    body: JSON.stringify(body),
  });
  if (!response.ok && response.status !== 204) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Error al actualizar la información del canal');
  }
  return true;
};

// Lee el estado de emisión del directo (Helix Get Streams). Si el canal está en
// directo devuelve los espectadores y el inicio; si no, live=false.
const getStreamInfo = async ({ broadcasterId }, env = process.env, fetchFn = fetch) => {
  const response = await fetchFn(`${TWITCH_HELIX}/streams?user_id=${broadcasterId}`, {
    headers: authHeaders(env),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Error al leer el estado del directo');
  const s = data.data?.[0];
  if (!s) return { live: false, viewerCount: 0, startedAt: null, gameName: '', title: '' };
  return {
    live: true,
    viewerCount: s.viewer_count || 0,
    startedAt: s.started_at || null,
    gameName: s.game_name || '',
    title: s.title || '',
  };
};

// Publica un anuncio destacado en el chat (Helix Send Chat Announcement). Se usa,
// por ejemplo, para avisar en el chat al iniciar la retransmisión. El moderator_id
// debe ser el dueño del token. Requiere el scope moderator:manage:announcements.
const sendChatAnnouncement = async ({ broadcasterId, moderatorId, message, color }, env = process.env, fetchFn = fetch) => {
  const response = await fetchFn(
    `${TWITCH_HELIX}/chat/announcements?broadcaster_id=${broadcasterId}&moderator_id=${moderatorId || broadcasterId}`,
    {
      method: 'POST',
      headers: authHeaders(env),
      body: JSON.stringify({ message, color: color || 'primary' }),
    },
  );
  if (!response.ok && response.status !== 204) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Error al enviar el anuncio al chat');
  }
  return true;
};

// Busca categorías/juegos por nombre (para el autocompletado del editor).
const searchCategories = async (query, env = process.env, fetchFn = fetch) => {
  const response = await fetchFn(`${TWITCH_HELIX}/search/categories?first=10&query=${encodeURIComponent(query)}`, {
    headers: authHeaders(env),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Error al buscar categorías');
  return (data.data || []).map((g) => ({ id: g.id, name: g.name, boxArt: g.box_art_url }));
};

// Aprueba (ALLOW) o rechaza (DENY) un mensaje retenido por AutoMod o por la
// revisión de "primeros mensajes" de chatters nuevos. El user_id debe ser el del
// moderador dueño del token. Requiere el scope moderator:manage:automod.
const manageHeldMessage = async ({ msgId, action, moderatorId }, env = process.env, fetchFn = fetch) => {
  const response = await fetchFn(`${TWITCH_HELIX}/moderation/automod/message`, {
    method: 'POST',
    headers: authHeaders(env),
    body: JSON.stringify({ user_id: moderatorId, msg_id: msgId, action }),
  });
  if (!response.ok && response.status !== 204) {
    throw new Error('Error al gestionar el mensaje retenido');
  }
  return true;
};

// Da de alta una suscripción de EventSub por WebSocket. El navegador abre el WS y
// nos pasa su session_id; aquí lo registramos con el token (que nunca sale al
// cliente) para que Twitch enrute los eventos a esa conexión.
const createEventSubSubscription = async ({ type, version, condition, sessionId }, env = process.env, fetchFn = fetch) => {
  const response = await fetchFn(`${TWITCH_HELIX}/eventsub/subscriptions`, {
    method: 'POST',
    headers: authHeaders(env),
    body: JSON.stringify({
      type,
      version,
      condition,
      transport: { method: 'websocket', session_id: sessionId },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Error al crear la suscripción de EventSub');
  }
  return data;
};

// Maneja los comandos de chat que no son de cola.
const handleBasicCommands = async (client, channel, tags, message, deps = {}) => {
  const env = deps.env || process.env;
  const fetchFn = deps.fetch || fetch;
  const resolveBroadcasterId = deps.getBroadcasterId || (() => env.TWITCH_BROADCASTER_ID);

  const lower = message.toLowerCase();
  const chess = resolveChessLinks(env);

  if (lower.includes('discord')) {
    client.say(channel, `¡Únete a nuestro Discord! ${env.DISCORD_LINK}`);
  }

  if (lower.includes('!chess')) {
    client.say(channel, `¡Juega conmigo en ${chess.name}! ${chess.profileLink}`);
  }

  if (lower.includes('!club')) {
    const grupo = chess.isLichess ? 'equipo' : 'club';
    client.say(channel, `¡Únete a nuestro ${grupo} de ${chess.name}! ${chess.clubLink}`);
  }

  if (message.startsWith('!banear') && tags.badges && tags.badges.broadcaster) {
    const args = message.split(' ');
    if (args.length < 2) {
      client.say(channel, `@${tags.username}, usa el comando así: !banear <usuario> [duración]`);
      return;
    }
    const nombreUser = args[1].replace('@', '');
    const duracion = args[2] ? parseInt(args[2]) : KICK_TIME;
    const userId = await getUserId(nombreUser, env, fetchFn);

    if (!userId) {
      client.say(channel, `No se encontró el usuario @${nombreUser}.`);
      return;
    }

    try {
      await banUser(
        { userId, duration: duracion, reason: 'Baneado temporalmente', broadcasterId: resolveBroadcasterId() },
        env,
        fetchFn
      );
      client.say(channel, `@${nombreUser} ha sido baneado por ${duracion} segundos.`);
    } catch (error) {
      console.error(error);
      client.say(channel, `No se pudo banear a @${nombreUser}.`);
    }
  }
};

module.exports = {
  getUserId,
  getBroadcasterId,
  getModeratorId,
  banUser,
  unbanUser,
  deleteMessage,
  getChannelInfo,
  updateChannelInfo,
  getStreamInfo,
  sendChatAnnouncement,
  searchCategories,
  manageHeldMessage,
  createEventSubSubscription,
  handleBasicCommands,
  resolveChessLinks,
  KICK_TIME,
};
