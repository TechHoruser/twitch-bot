
const { getChessStats, logUserRating } = require('./chess');
const { getElementInQueue, getQueueLength, clearQueue, getJson, saveIntoQueue, popFromQueue, removeFromQueue, saveJson } = require('./savedData');
const { nextOverload } = require('./stream-overload');

const MAP_TWITCH_CHESS_FILE = 'twitch-chess';

const queue = 'queue';
const queueKey = (object) => object.username;

const handleCommandByQueue = async (client, channel, tags, message) => {
  // Comando de ayuda
  if (message.toLowerCase() === '!cola') {
    client.say(channel, `Comandos disponibles:
        \n!cola:unirme <usuario de Chess.com>;
        \n!cola:limpiar-usuario;
        \n!cola:salir;
        \n!cola:ver;
        \n!cola:pop (solo broadcaster);
        \n!cola:limpiar (solo broadcaster);
    `);
  }

  // Comando para unirse a la cola
  if (message.toLowerCase().startsWith('!cola:unirme')) {
      console.log('Comando !cola:unirme detectado');
      
      // Extraer username de chess.com
      const parts = message.split(' ');
      const chesscomUser = parts[1];
      
      // Validar si ya está en la cola
      const queueElement = getElementInQueue(queue, queueKey, tags.username);
      if (queueElement !== null) {
          client.say(channel, `@${tags.username}, ya estás en la cola con usuario de Chess.com: ${queueElement.element.chesscom}`);
          console.log(`Usuario ${tags.username} intentó unirse nuevamente`);
          return;
      }
      
      // Load mapping from file or initialize empty
      const mapping = getJson(MAP_TWITCH_CHESS_FILE);
      console.log('Mapping:', mapping);

      if (mapping[tags.username] && chesscomUser && mapping[tags.username] != chesscomUser) {
          client.say(channel, `@${tags.username}, tienes un usuario de Chess.com guardado: ${mapping[tags.username]}. Si deseas cambiarlo, usa !cola:limpiar.`);
          return;
      }

      const saveChesscomUser = mapping[tags.username] || chesscomUser;
      if (!saveChesscomUser) {
          client.say(channel, `@${tags.username}, por favor proporciona tu usuario de Chess.com. Ejemplo: !cola:unirme TuUsuarioChess`);
          console.log('Intento de unirse sin proporcionar usuario de Chess.com');
          return;
      }
  
      try {
          const chesscomUserRating = await getChessStats(saveChesscomUser);
          if (!chesscomUserRating) {
              client.say(channel, `@${tags.username}, no se encontró el usuario de Chess.com ${saveChesscomUser}.`);
              console.log(`Usuario de Chess.com no encontrado: ${saveChesscomUser}`);
              return;
          }

          if (!mapping[tags.username]) {
              mapping[tags.username] = saveChesscomUser;
              saveJson(MAP_TWITCH_CHESS_FILE, mapping);
          }
          
          const queueElement = { username: tags.username, chesscom: saveChesscomUser, chesscomRating: chesscomUserRating };
          saveIntoQueue(queue, queueElement);
          const respuesta = `@${tags.username}, has sido añadido/a a la cola con usuario de Chess.com: ${saveChesscomUser}. Actualmente hay ${getQueueLength(queue)} persona(s) en la cola.`;
          client.say(channel, respuesta);
          console.log(`Usuario ${tags.username} añadido a la cola con Chess.com: ${saveChesscomUser}`);
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

      client.say(channel, `@${tags.username}, tu usuario de Chess.com ha sido eliminado.`);
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
          logUserRating(next.chesscom, next.chesscomRating);
          client.say(channel, `El siguiente en la cola es @${next.username}. Usuario de Chess.com: ${next.chesscom}. ¡Buena suerte!`);
      }
  }
}

module.exports = {
  handleCommandByQueue,
}
