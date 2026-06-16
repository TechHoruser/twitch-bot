# Twitch Bot — Stream de Ajedrez

Proyecto pensado para **streams de ajedrez en Twitch**. Permite que la audiencia
se apunte a una cola para jugar contra el streamer indicando su usuario de
Chess.com, muestra los ratings (bullet/blitz/rapid) y genera overlays animados
para OBS.

## Arquitectura

El proyecto se divide en tres piezas que se orquestan con `docker-compose`:

* **`bot/`** — Bot de chat de Twitch (con [tmi.js](https://github.com/tmijs/tmi.js)).
  Escucha los mensajes del chat y gestiona los comandos (cola, enlaces de
  Discord/Chess.com, baneos temporales del moderador).
* **`web/`** — Aplicación [Next.js](https://nextjs.org/) con dos vistas:
  * `/` → **overlay para OBS**. Recibe eventos en tiempo real vía SSE
    (`/api/overload`) y muestra animaciones: el siguiente rival
    (`next-match`) y la cola de peones.
  * `/admin` → **panel de control** para el streamer (avanzar al siguiente de
    la cola, limpiar la cola).
* **`common-js/`** — Código compartido entre `bot` y `web`:
  * `savedData.js` → persistencia simple en ficheros JSON (`/data`) y utilidades
    de cola.
  * `chess.js` → consulta de estadísticas de Chess.com (con caché de 12h).
  * `queueCommands.js` → lógica de los comandos `!cola:*` del chat.
  * `centerOverload.js` → cola de overlays que se van mostrando en el centro.

### Flujo de datos

```
Chat de Twitch ──► bot ──► common-js (queue.json en /data)
                                  │
                  web /admin ─────┤ (pop/clear)
                                  ▼
              common-js (overload-center.json)
                                  │
                          web /api/overload (SSE)
                                  ▼
                       Overlay en OBS (web /)
```

> La cola y los datos viven en ficheros JSON dentro del volumen `/data`. Si se
> borra ese volumen, se pierde el estado.

## Comandos del chat

| Comando | Quién | Descripción |
| --- | --- | --- |
| `!cola` | Todos | Muestra la ayuda de comandos |
| `!cola:unirme <usuario chess.com>` | Todos | Se une a la cola (recuerda tu usuario) |
| `!cola:ver` | Todos | Muestra tu posición y el tamaño de la cola |
| `!cola:salir` | Todos | Sales de la cola |
| `!cola:limpiar-usuario` | Todos | Olvida tu usuario de Chess.com guardado |
| `!cola:limpiar` | Streamer | Vacía la cola |
| `!cola:siguiente` | Streamer | Saca al primero de la cola y lo muestra en el overlay |
| `!banear <usuario> [segundos]` | Streamer | Banea temporalmente a un usuario |
| `discord` (en el mensaje) | Todos | Responde con el enlace de Discord |
| `!chess` | Todos | Responde con tu perfil de Chess.com |
| `!club` | Todos | Responde con el enlace del club de Chess.com |

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

  * La primera vez que se inicia el bot genera un fichero `data.json` con el
    `broadcaster_id` del canal. Posteriormente se podrán almacenar algunos datos
    extra interesantes. Ese valor se almacena para no tener que hacer una
    petición a la API de Twitch cada vez que se inicia el bot. **Este mismo
    `broadcaster_id` es el que se usa para los baneos**, por lo que el comando
    `!banear` necesita que el bot lo haya obtenido al menos una vez.
  * La cola y los datos se persisten en ficheros JSON dentro del volumen `/data`.
  * El bot está configurado con nodemon, por lo que se reiniciará automáticamente
    al guardar cambios en los ficheros. Más info en el fichero `nodemon.json`.

## Iniciar

Crea `bot/.env.local` partiendo de `bot/.env` con las siguientes variables:

```
TWITCH_CHANNEL_NAME=    # Nombre del canal
TWITCH_BOT_USERNAME=    # Nombre de la aplicación
TWITCH_CLIENT_ID=       # Client ID de la aplicación de Twitch
TWITCH_OAUTH_TOKEN=     # Token OAuth generado (sin el prefijo "oauth:")

DISCORD_LINK=           # Enlace de invitación al servidor de Discord
CHESSCOM_PROFILE_LINK=  # Enlace a tu perfil de Chess.com
CHESSCOM_CLUB_LINK=     # Enlace a tu club de Chess.com
```

Ejecuta el comando:

```
docker compose up
```

* Overlay para OBS → http://localhost:3000
* Panel de control → http://localhost:3000/admin

A volar!
