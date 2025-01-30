// Importa la librería tmi.js
const tmi = require('tmi.js');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const KICK_TIME = 5; // Tiempo de timeout en segundos

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
const dataPath = path.join(__dirname, 'data.json');

let broadcasterData;
try {
    broadcasterData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch {
    broadcasterData = {};
}

if (!broadcasterData.broadcaster_id) {
    getBroadcasterId(process.env.TWITCH_CHANNEL_NAME).then(id => {
        broadcasterData.broadcaster_id = id;
        fs.writeFileSync(dataPath, JSON.stringify(broadcasterData, null, 2));
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

        // Comando de ayuda
        if (message.toLowerCase() === '!cola') {
            client.say(channel, 'Comandos disponibles: !cola:unirme, !cola:salir, !cola:ver, !cola:pop (solo broadcaster), !cola:limpiar (solo broadcaster)');
        }

        // Comando para unirse a la cola
        if (message.toLowerCase() === '!cola:unirme') {
            if (!cola.includes(tags.username)) {
                cola.push(tags.username);
                client.say(channel, `@${tags.username}, has sido añadido/a a la cola. Actualmente hay ${cola.length} persona(s) en la cola.`);
            } else {
                client.say(channel, `@${tags.username}, ya estás en la cola. Te encuentras en la posición ${cola.indexOf(tags.username) + 1}.`);
            }
        }

        // Comando para ver la cola y la posición del usuario
        if (message.toLowerCase() === '!cola:ver') {
            if (cola.length === 0) {
                client.say(channel, 'La cola está vacía ahora mismo.');
            } else {
                const posicion = cola.indexOf(tags.username) + 1;
                if (posicion > 0) {
                    client.say(channel, `@${tags.username}, estás en la posición ${posicion} de la cola. La cola actual es: ${cola.join(', ')}`);
                } else {
                    client.say(channel, `La cola actual es: ${cola.join(', ')}`);
                }
            }
        }

        // Comando para salir de la cola
        if (message.toLowerCase() === '!cola:salir') {
            const index = cola.indexOf(tags.username);
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
                client.say(channel, `El siguiente en la cola es @${next}. (@${next} ya no está en la cola)`);
            }
        }

        if (message.startsWith('!banear')) {
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
