
const { getChessStats, logUserRating, providerName, providerLabel, getDefaultProviderKey, parseAccountToken, PROVIDER_KEYS } = require('./chess');
const { getElementInQueue, getQueueLength, clearQueue, getJson, pushIntoQueue, popFromQueue, removeFromQueue, saveJson } = require('./savedData');
const { nextOverload } = require('./centerOverload');

const MAP_TWITCH_CHESS_FILE = 'twitch-chess';

const queue = 'queue';
const queueKey = (object) => object.username;

// Normaliza la entrada de twitch-chess.json a { chesscom?, lichess? }.
// Acepta el formato antiguo (un string suelto = handle del proveedor por defecto).
const normalizeMapping = (entry) => {
  if (!entry) return {};
  if (typeof entry === 'string') return { [getDefaultProviderKey()]: entry };
  const out = {};
  for (const key of PROVIDER_KEYS) {
    if (entry[key]) out[key] = entry[key];
  }
  return out;
};

const accountsToString = (accounts = []) =>
  accounts.map((a) => `${a.provider}: ${a.chessUser}`).join(' · ');

const handleCommandByQueue = async (client, channel, tags, message) => {
  // Comando de ayuda
  if (message.toLowerCase() === '!cola') {
    client.say(channel, `Comandos disponibles:
        \n!cola:unirme <usuario> (o lichess:usuario / chesscom:usuario, o ambos);
        \n!cola:limpiar-usuario;
        \n!cola:salir;
        \n!cola:ver;
    `);
  }

  // Comando para unirse a la cola
  if (message.toLowerCase().startsWith('!cola:unirme')) {
      console.log('Comando !cola:unirme detectado');
      const defaultKey = getDefaultProviderKey();

      // Validar si ya está en la cola
      const existing = getElementInQueue(queue, queueKey, tags.username);
      if (existing !== null) {
          client.say(channel, `@${tags.username}, ya estás en la cola con ${accountsToString(existing.element.accounts)}.`);
          console.log(`Usuario ${tags.username} intentó unirse nuevamente`);
          return;
      }

      // Parsear tokens: "chesscom:Foo", "lichess:Bar" o "Foo" (proveedor por defecto).
      const tokens = message.split(' ').slice(1).filter(Boolean);
      const requested = {};
      for (const token of tokens) {
          const { providerKey, handle } = parseAccountToken(token);
          if (handle) requested[providerKey] = handle;
      }

      const mapping = getJson(MAP_TWITCH_CHESS_FILE);
      const saved = normalizeMapping(mapping[tags.username]);

      // Guardia: si intenta cambiar un handle ya guardado para ese proveedor.
      for (const key of Object.keys(requested)) {
          if (saved[key] && requested[key] !== saved[key]) {
              client.say(channel, `@${tags.username}, tienes un usuario de ${providerLabel(key)} guardado: ${saved[key]}. Si deseas cambiarlo, usa !cola:limpiar-usuario.`);
              return;
          }
      }

      // Proveedores con los que se une: los pedidos, o si no, los guardados.
      const providerKeys = Object.keys(requested).length
          ? Object.keys(requested)
          : Object.keys(saved);

      if (!providerKeys.length) {
          client.say(channel, `@${tags.username}, por favor proporciona tu usuario de ${providerLabel(defaultKey)} (o usa el prefijo, p.ej. !cola:unirme lichess:TuUsuario).`);
          console.log('Intento de unirse sin proporcionar usuario');
          return;
      }

      try {
          const accounts = [];
          const updatedSaved = { ...saved };
          for (const key of providerKeys) {
              const handle = requested[key] || saved[key];
              if (!handle) continue;
              const ratings = await getChessStats(handle, key);
              if (!ratings) {
                  client.say(channel, `@${tags.username}, no se encontró el usuario de ${providerLabel(key)} ${handle}.`);
                  console.log(`Usuario de ${providerLabel(key)} no encontrado: ${handle}`);
                  continue;
              }
              accounts.push({ provider: providerLabel(key), providerKey: key, chessUser: handle, ratings });
              updatedSaved[key] = handle;
          }

          if (!accounts.length) {
              return; // ya se avisó de los handles inválidos
          }

          mapping[tags.username] = updatedSaved;
          saveJson(MAP_TWITCH_CHESS_FILE, mapping);

          pushIntoQueue(queue, { username: tags.username, accounts });
          client.say(channel, `@${tags.username}, has sido añadido/a a la cola con ${accountsToString(accounts)}. Actualmente hay ${getQueueLength(queue)} persona(s) en la cola.`);
          console.log(`Usuario ${tags.username} añadido a la cola con ${accountsToString(accounts)}`);
      } catch (error) {
          console.error('Error al procesar la solicitud:', error);
          client.say(channel, `@${tags.username}, ocurrió un error al procesar tu solicitud. Por favor, intenta nuevamente.`);
      }
  }

  if (message.toLowerCase() === '!cola:limpiar-usuario') {
      const mapping = getJson(MAP_TWITCH_CHESS_FILE);

      if (mapping[tags.username]) {
          delete mapping[tags.username];
          saveJson(MAP_TWITCH_CHESS_FILE, mapping);
      }

      client.say(channel, `@${tags.username}, tu usuario de ajedrez ha sido eliminado.`);
  }

  // Comando para ver la cola y la posición del usuario
  if (message.toLowerCase() === '!cola:ver') {
    const queueLength = getQueueLength(queue);
    const queueElement = getElementInQueue(queue, queueKey, tags.username);
      if (queueLength === 0) {
          client.say(channel, 'La cola está vacía ahora mismo.');
      } else {
          const queueLengthString = `Actualmente hay ${queueLength} persona(s) en la cola.`;
          if (queueElement) {
              client.say(channel, `@${tags.username}, estás en la posición ${queueElement.position + 1} de la cola. ${queueLengthString}`);
          } else {
              client.say(channel, queueLengthString);
          }
      }
  }

  // Comando para salir de la cola
  if (message.toLowerCase() === '!cola:salir') {
      const queueElement = getElementInQueue(queue, queueKey, tags.username);
      if (queueElement !== null) {
          removeFromQueue(queue, queueKey, tags.username);
          client.say(channel, `@${tags.username}, has salido de la cola.`);
      } else {
          client.say(channel, `@${tags.username}, no estás en la cola.`);
      }
  }

  // Comando para limpiar la cola (solo para el broadcaster)
  if (message.toLowerCase() === '!cola:limpiar' && tags.badges && tags.badges.broadcaster) {
      clearQueue(queue);
      client.say(channel, 'La cola ha sido limpiada.');
  }

  // Comando para eliminar al primero de la cola (solo broadcaster)
  if (message.toLowerCase() === '!cola:siguiente' && tags.badges && tags.badges.broadcaster) {
      if (getQueueLength(queue) === 0) {
          client.say(channel, 'La cola está vacía, no hay nadie contra quien jugar.');
      } else {
          const next = popFromQueue(queue);
          console.log('Vas a jugar  contra:');
          nextOverload('next-match', next);
          (next.accounts || []).forEach((a) => logUserRating(a.chessUser, a.ratings, a.providerKey));
          client.say(channel, `El siguiente en la cola es @${next.username}. ${accountsToString(next.accounts)}. ¡Buena suerte!`);
      }
  }
}

module.exports = {
  handleCommandByQueue,
}
