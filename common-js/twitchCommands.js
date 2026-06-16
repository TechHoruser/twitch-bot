// Comandos de chat de Twitch que no son de cola (Discord, Chess.com, baneos).
// La lógica se extrae aquí para poder testearla de forma aislada, inyectando
// `fetch`, el entorno y el broadcaster_id.

const TWITCH_HELIX = 'https://api.twitch.tv/helix';
const KICK_TIME = 300; // Tiempo de timeout por defecto en segundos

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

const banUser = async ({ userId, duration, reason, broadcasterId }, env = process.env, fetchFn = fetch) => {
  if (!broadcasterId) {
    throw new Error('No se conoce el broadcaster_id todavía. Reinicia el bot e inténtalo de nuevo.');
  }

  const response = await fetchFn(
    `${TWITCH_HELIX}/moderation/bans?broadcaster_id=${broadcasterId}&moderator_id=${broadcasterId}`,
    {
      method: 'POST',
      headers: {
        'Client-ID': env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${env.TWITCH_OAUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: { user_id: userId, duration, reason } }),
    }
  );

  if (!response.ok) {
    throw new Error('Error al banear al usuario');
  }
  return true;
};

// Maneja los comandos de chat que no son de cola.
const handleBasicCommands = async (client, channel, tags, message, deps = {}) => {
  const env = deps.env || process.env;
  const fetchFn = deps.fetch || fetch;
  const resolveBroadcasterId = deps.getBroadcasterId || (() => env.TWITCH_BROADCASTER_ID);

  const lower = message.toLowerCase();

  if (lower.includes('discord')) {
    client.say(channel, `¡Únete a nuestro Discord! ${env.DISCORD_LINK}`);
  }

  if (lower.includes('!chess')) {
    client.say(channel, `¡Agrégame a ChessCom! ${env.CHESSCOM_PROFILE_LINK}`);
  }

  if (lower.includes('!club')) {
    client.say(channel, `¡Únete a nuestro club de Chess.com! ${env.CHESSCOM_CLUB_LINK}`);
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
  banUser,
  handleBasicCommands,
  KICK_TIME,
};
