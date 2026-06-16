// Importa la librería tmi.js
const tmi = require('tmi.js');
const { getJson, saveJson } = require('@chess-stream/common/savedData');
const { handleCommandByQueue } = require('@chess-stream/common/queueCommands');
const { handleBasicCommands, getBroadcasterId } = require('@chess-stream/common/twitchCommands');

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

// Cargar y gestionar el broadcaster_id desde data.json
const appData = getJson('app');

if (!appData.broadcaster_id) {
    getBroadcasterId()
        .then(id => {
            appData.broadcaster_id = id;
            saveJson('app', appData);
        })
        .catch(err => console.error('No se pudo obtener el broadcaster_id:', err));
}

// Manejar eventos de mensajes
client.on('message', (channel, tags, message, self) => {
    if (self) return;

    handleCommandByQueue(client, channel, tags, message);

    handleBasicCommands(client, channel, tags, message, {
        getBroadcasterId: () => appData.broadcaster_id,
    }).catch(err => console.error('Error al ejecutar comando:', err));
});
