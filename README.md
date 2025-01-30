# Twitch Bot

## Conseguir Token de Twitch

Ve a Twitch Developer Console [https://dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps).

Crea una aplicación con estos datos:

* Nombre: Lo que quieras.
* OAuth Redirect URL: http://localhost
* Categoría: Aplicación personalizada.
* Copia el Client ID que se genera.

Obtén el token OAuth manualmente ejecutando en tu navegador:

https://id.twitch.tv/oauth2/authorize?client_id=TU_CLIENT_ID&redirect_uri=http://localhost&response_type=token&scope=chat:edit+chat:read+channel:moderate

Te redirigirá a http://localhost#access_token=TOKEN_GENERADO.

Ese access_token es el que debes usar en el código.

## Aclaraciones

  * La primera vez que se inicia el bot genera un fichero data.json con el broadcast_id del canal. Posteriormente se podrán almacenar algún dato extra interesante. Ese valor se almacena para no tener que hacer una petición a la API de Twitch cada vez que se inicia el bot.
  * La cola de mensajes, está en memoria. Si se reinicia el bot, se pierden los mensajes pendientes.
  * El bot está configurado con nodemon, por lo que se reiniciará automáticamente al guardar cambios en los ficheros. Más info en el fichero `nodemon.json`.


## Iniciar


Crear `.env.local` partiendo de `.env` con las siguientes variables:
```
TWITCH_CHANNEL_NAME= // Nombre del canal
TWITCH_BOT_USERNAME= // Application name
TWITCH_OAUTH_TOKEN= // Token generado
DISCORD_LINK= // Link de invitación al servidor de discord
```

Ejecutar el comando:
```
docker compose up
```

A volar!
