// Importa la librería tmi.js
const tmi = require('tmi.js');
const fetch = require('node-fetch');
const path = require('path');
const { getJson, saveJson, saveIntoArray } = require('./src/savedData');
const { handleCommandByQueue } = require('./src/queueCommands');

const KICK_TIME = 300; // Tiempo de timeout en segundos

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

    handleCommandByQueue(client, channel, tags, message);

    handleCommand(async () => {
        // Mostrar enlace de Discord
        if (message.toLowerCase().includes('discord')) {
            client.say(channel, `¡Únete a nuestro Discord! ${process.env.DISCORD_LINK}`);
        }

        if (message.toLowerCase().includes('!chess')) {
            client.say(channel, `¡Agrégame a ChessCom! ${process.env.CHESSCOM_LINK}`);
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
