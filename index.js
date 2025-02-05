// Importa la librería tmi.js
const tmi = require('tmi.js');
const fetch = require('node-fetch');
const path = require('path');
const { getChessStats, logUserRating } = require('./src/chess');
const { getJson, saveJson } = require('./src/savedData');

const KICK_TIME = 300; // Tiempo de timeout en segundos

const MAP_TWITCH_CHESS_FILE = 'twitch-chess';

// Configuración del cliente de Twitch
const client = new tmi.Client({
    options: { debug: true },
    connection: {
        reconnect: true,
        secure: true
    },
    identity: {
        username: process.env.TWITCH_CHANNEL_NAME,
        password: `oauth:${process.env.TWITCH_OAUTH_TOKEN}`
    },
    channels: [ process.env.TWITCH_CHANNEL_NAME ]
});

// Array para la cola
let cola = [];

// Conectar el cliente
client.connect();

const handleCommand = async (callback) => {
    try {
        await callback();
    } catch (err) {
        console.error('Error al ejecutar comando:', err);
    }
};

async function getBroadcasterId(channelName) {
    const response = await fetch(
        `https://api.twitch.tv/helix/users?login=${process.env.TWITCH_CHANNEL_NAME}`,
        {
            headers: {
                'Client-ID': process.env.TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${process.env.TWITCH_OAUTH_TOKEN}`
            }
        }
    );

    const data = await response.json();
    console.log(data);
    return data.data[0].id; // Este es el broadcaster_id
}

// Cargar y gestionar el broadcaster_id desde data.json
const appData = getJson('app');

if (!appData.broadcaster_id) {
    getBroadcasterId(process.env.TWITCH_CHANNEL_NAME).then(id => {
        appData.broadcaster_id = id;
        saveJson('app', appData);
    });
}

// Función para obtener el ID de usuario de Twitch
async function getUserId(username) {
    const response = await fetch(`https://api.twitch.tv/helix/users?login=${username}`, {
        headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${process.env.TWITCH_OAUTH_TOKEN}`
        }
    });

    const data = await response.json();
    if (data.data && data.data.length > 0) {
        return data.data[0].id;
    } else {
        return null;
    }
}

// Función para banear temporalmente a un usuario
async function banUser(userId, duration, reason) {
    const response = await fetch(`https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${process.env.TWITCH_BROADCASTER_ID}&moderator_id=${process.env.TWITCH_BROADCASTER_ID}`, {
        method: 'POST',
        headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${process.env.TWITCH_OAUTH_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            data: {
                user_id: userId,
                duration: duration,
                reason: reason
            }
        })
    });

    if (!response.ok) {
        console.error(response);
        throw new Error('Error al banear al usuario');
    }
}

// Manejar eventos de mensajes
client.on('message', (channel, tags, message, self) => {
    if (self) return;

    handleCommand(async () => {
        // Mostrar enlace de Discord
        if (message.toLowerCase().includes('discord')) {
            client.say(channel, `¡Únete a nuestro Discord! ${process.env.DISCORD_LINK}`);
        }

        if (message.toLowerCase().includes('!chess')) {
            client.say(channel, `¡Agrégame a ChessCom! ${process.env.CHESSCOM_LINK}`);
        }

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
            if (cola.some(entry => entry.username === tags.username)) {
                const existingEntry = cola.find(entry => entry.username === tags.username);
                client.say(channel, `@${tags.username}, ya estás en la cola con usuario de Chess.com: ${existingEntry.chesscom}`);
                console.log(`Usuario ${tags.username} intentó unirse nuevamente`);
                return;
            }
            
            // Load mapping from file or initialize empty
            const mapping = getJson(MAP_TWITCH_CHESS_FILE);

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

                cola.push({ username: tags.username, chesscom: saveChesscomUser, chesscomRating: chesscomUserRating });
                
                const respuesta = `@${tags.username}, has sido añadido/a a la cola con usuario de Chess.com: ${saveChesscomUser}. Actualmente hay ${cola.length} persona(s) en la cola.`;
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
            if (cola.length === 0) {
                client.say(channel, 'La cola está vacía ahora mismo.');
            } else {
                const posicion = cola.map(entry => entry.username).indexOf(tags.username) + 1;
                const queueLengthString = `Actualmente hay ${cola.length} persona(s) en la cola.`;
                if (posicion > 0) {
                    client.say(channel, `@${tags.username}, estás en la posición ${posicion} de la cola. ${queueLengthString}`);
                } else {
                    client.say(channel, queueLengthString);
                }
            }
        }

        // Comando para salir de la cola
        if (message.toLowerCase() === '!cola:salir') {
            const index = cola.map(entry => entry.username).indexOf(tags.username);
            if (index !== -1) {
                cola.splice(index, 1);
                client.say(channel, `@${tags.username}, has salido de la cola.`);
            } else {
                client.say(channel, `@${tags.username}, no estás en la cola.`);
            }
        }

        // Comando para limpiar la cola (solo para el broadcaster)
        if (message.toLowerCase() === '!cola:limpiar' && tags.badges && tags.badges.broadcaster) {
            cola = [];
            client.say(channel, 'La cola ha sido limpiada.');
        }

        // Comando para eliminar al primero de la cola (solo broadcaster)
        if (message.toLowerCase() === '!cola:siguiente' && tags.badges && tags.badges.broadcaster) {
            if (cola.length === 0) {
                client.say(channel, 'La cola está vacía, no hay nadie contra quien jugar.');
            } else {
                const next = cola.shift();
                console.log('Vas a jugar  contra:');
                logUserRating(next.chesscom, next.chesscomRating);
                client.say(channel, `El siguiente en la cola es @${next.username}. Usuario de Chess.com: ${next.chesscom}. ¡Buena suerte!`);
            }
        }

        if (message.startsWith('!banear') && tags.badges && tags.badges.broadcaster) {
            const args = message.split(' ');
            if (args.length < 2) {
                client.say(channel, `@${tags.username}, usa el comando así: !banear <usuario> [duración]`);
                return;
            }
            const nombreUser = args[1].replace('@','');
            const duracion = args[2] ? parseInt(args[2]) : KICK_TIME;
            const userId = await getUserId(nombreUser);

            if (!userId) {
                client.say(channel, `No se encontró el usuario @${nombreUser}.`);
                return;
            }

            try {
                await banUser(userId, duracion, 'Baneado temporalmente');
                client.say(channel, `@${nombreUser} ha sido baneado por ${duracion} segundos.`);
            } catch (error) {
                console.error(error);
                client.say(channel, `No se pudo banear a @${nombreUser}.`);
            }
        }
    });
});
