# Twitch Bot — Stream de Ajedrez

Proyecto pensado para **streams de ajedrez en Twitch**. Permite que la audiencia
se apunte a una cola para jugar contra el streamer indicando su usuario de
**Lichess o Chess.com** (configurable por variable de entorno), muestra los
ratings (bullet/blitz/rapid) y genera overlays animados para OBS. Con Lichess
incluye además un overlay que **emite tu partida en vivo** sin compartir la
pestaña del navegador (`/tv`).

## Arquitectura

Es un **monorepo** con [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces):
las aplicaciones viven en `apps/*` y el código compartido en `packages/*`. Un
único `npm install` en la raíz instala y enlaza todo.

```
.
├── apps/
│   ├── bot/        → Bot de chat de Twitch (tmi.js)
│   ├── web/        → App Next.js (overlay OBS + panel admin + API)
│   └── overlays/   → Overlays HTML estáticos para OBS (Browser Source)
├── packages/
│   └── common/     → Lógica compartida → paquete @chess-stream/common
├── tests/          → Suite Playwright (lógica + e2e)
├── setup.js        → Asistente de instalación y configuración
└── package.json    → Workspaces + scripts orquestadores
```

* **`apps/bot/`** — Bot de chat de Twitch (con [tmi.js](https://github.com/tmijs/tmi.js)).
  Escucha los mensajes del chat y gestiona los comandos (cola, enlaces de
  Discord/Chess.com, baneos temporales del moderador).
* **`apps/web/`** — Aplicación [Next.js](https://nextjs.org/) con dos vistas:
  * `/` → **overlay para OBS**. Recibe eventos en tiempo real vía SSE
    (`/api/overload`) y muestra animaciones: el siguiente rival
    (`next-match`) y la cola de peones.
  * `/tv` → **overlay de TV de Lichess** (solo Lichess). Embebe tu partida en
    vivo siguiéndola automáticamente; se añade como Browser Source en OBS.
  * `/admin` → **panel de control** para el streamer (avanzar al siguiente de
    la cola, limpiar la cola).
* **`apps/overlays/`** — Overlays HTML estáticos para OBS. `npm run overlays`
  los sirve en http://localhost:4000.
* **`packages/common/`** (`@chess-stream/common`) — Código compartido entre las apps:
  * `savedData.js` → persistencia simple en ficheros JSON (`DATA_PATH`) y utilidades
    de cola.
  * `chess.js` → dispatcher de estadísticas según `CHESS_PROVIDER` (caché 12h),
    con proveedores intercambiables en `providers/` (`lichess.js`, `chesscom.js`).
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
| `!cola:unirme <usuario>` | Todos | Se une a la cola con tu usuario (lo recuerda por proveedor) |
| `!cola:unirme lichess:<u> chesscom:<u>` | Todos | Se une indicando el/los proveedores (uno o ambos) |
| `!cola:ver` | Todos | Muestra tu posición y el tamaño de la cola |
| `!cola:salir` | Todos | Sales de la cola |
| `!cola:limpiar-usuario` | Todos | Olvida tus usuarios de ajedrez guardados |
| `!cola:limpiar` | Streamer | Vacía la cola |
| `!cola:siguiente` | Streamer | Saca al primero de la cola y lo muestra en el overlay |
| `!banear <usuario> [segundos]` | Streamer | Banea temporalmente a un usuario |
| `discord` (en el mensaje) | Todos | Responde con el enlace de Discord |
| `!chess` | Todos | Responde con tu perfil del proveedor activo (Lichess/Chess.com) |
| `!club` | Todos | Responde con el enlace de tu equipo/club |

> **Proveedor por unión:** `!cola:unirme Foo` usa el proveedor por defecto
> (`CHESS_PROVIDER`, `lichess` salvo que se cambie). Con el prefijo `lichess:` o
> `chesscom:` eliges otro, y puedes indicar **ambos** en el mismo comando
> (`!cola:unirme chesscom:Foo lichess:Bar`): el overlay del rival mostrará el
> rating de cada plataforma. `!chess`/`!club` y el overlay `/tv` siguen el
> proveedor por defecto.
>
> **Persistencia:** `data/twitch-chess.json` recuerda tus handles por proveedor
> (`{ "<twitch>": { "chesscom": "Foo", "lichess": "Bar" } }`) y
> `data/chess-stats.json` cachea los ratings 12 h, anidados por proveedor
> (`{ "lichess": { "bar": { … } }, "chesscom": { … } }`).

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

### 1. Setup

Ejecuta el asistente, que instala los workspaces, prepara las carpetas y los
`.env.local`, y **te pregunta por cada credencial mostrando dónde obtenerla**
(la app de Twitch, cómo generar el token OAuth, enlaces de Discord/Chess.com):

```
npm run setup
```

> Es idempotente: vuelve a ejecutarlo cuando quieras (Enter mantiene el valor
> actual). Flags útiles: `--with-browser` (instala Chromium para los tests e2e),
> `--no-prompt` (no pregunta, modo CI) y `--skip-install` (no reinstala).

### 2. Credenciales

El setup las pide de forma interactiva, pero también puedes editar
`apps/bot/.env.local` a mano. Para qué sirve cada variable:

```
TWITCH_CHANNEL_NAME=    # Nombre del canal
TWITCH_BOT_USERNAME=    # Nombre de la aplicación
TWITCH_CLIENT_ID=       # Client ID de la aplicación de Twitch
TWITCH_OAUTH_TOKEN=     # Token OAuth generado (sin el prefijo "oauth:")

DISCORD_LINK=           # Enlace de invitación al servidor de Discord

CHESS_PROVIDER=lichess  # Proveedor de ajedrez: lichess | chesscom

# Lichess (se usan cuando CHESS_PROVIDER=lichess)
LICHESS_PROFILE_LINK=   # Tu perfil, p.ej. https://lichess.org/@/TU_USUARIO
LICHESS_TEAM_LINK=      # Tu equipo, p.ej. https://lichess.org/team/TU_EQUIPO
LICHESS_TV_USER=        # Usuario cuya partida en vivo emite el overlay /tv

# Chess.com (se usan cuando CHESS_PROVIDER=chesscom)
CHESSCOM_PROFILE_LINK=  # Enlace a tu perfil de Chess.com
CHESSCOM_CLUB_LINK=     # Enlace a tu club de Chess.com
```

> `LICHESS_TV_USER` lo necesita también la web (la sirve el overlay `/tv`). El
> `setup.js` lo copia a `apps/web/.env.local`; con Docker pásalo por entorno.

### 3. Arrancar

**En local** (cada pieza por separado):

```
npm run bot:dev      # bot de Twitch (recarga con nodemon)
npm run web:dev      # web → http://localhost:3000 (overlay) y /admin
npm run overlays     # overlays HTML → http://localhost:4000
```

**Con Docker** (stack completo: bot + web):

```
npm run up           # = docker compose up
```

* Overlay para OBS → http://localhost:3000
* Overlay de TV de Lichess → http://localhost:3000/tv
* Panel de control → http://localhost:3000/admin

### TV de Lichess en OBS (emitir tu partida sin compartir pestaña)

Si juegas en **Lichess**, en lugar de capturar/compartir la pestaña del
navegador puedes añadir un **Browser Source** apuntando a:

```
http://localhost:3000/tv
```

Sigue automáticamente tu partida en vivo (usa `LICHESS_TV_USER`) y, cuando
empieza otra, cambia sola. El tablero se orienta a tu color. Puedes forzar un
usuario o tema con query params: `/tv?user=TU_USUARIO&theme=brown&bg=dark`.

> Funciona embebiendo la ruta oficial `lichess.org/embed/game/<id>`, pensada
> para iframes. Solo aplica a Lichess (Chess.com no ofrece un equivalente).

### Comandos útiles

| Comando | Descripción |
| --- | --- |
| `npm run setup` | Instala y configura todo el monorepo |
| `npm run bot` / `npm run bot:dev` | Arranca el bot (prod / con recarga) |
| `npm run web:dev` / `web:build` / `web:start` / `web:lint` | App Next.js |
| `npm run overlays` | Sirve los overlays HTML para OBS |
| `npm test` / `npm run test:logic` / `npm run test:e2e` | Tests (Playwright) |
| `npm run up` / `down` | Docker compose arriba / abajo |

A volar!
