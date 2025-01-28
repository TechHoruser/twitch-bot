// Importa la librería tmi.js
const tmi = require('tmi.js');

const KICK_TIME = 10; // Tiempo de timeout en segundos

// Configuración del cliente de Twitch
const client = new tmi.Client({
    options: { debug: true },
    connection: {
        reconnect: true,
        secure: true
    },
    identity: {
        username: process.env.TWITCH_BOT_USERNAME,
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
    });
});
