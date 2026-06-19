# Stream Toolkit — Gestión de directos de Twitch

Toolkit para **gestionar directos en Twitch**: un bot de chat, overlays animados
para OBS, un panel de control y asistentes que configuran OBS, Stream Deck y
Voicemeeter. Sirve para cualquier tipo de directo —los overlays incluyen
plantillas para **Valorant** y un tema **Mecha**— e incluye un **módulo opcional
de "cola de retadores" para directos de ajedrez**: la audiencia se apunta con su
usuario de **Lichess o Chess.com** (configurable por variable de entorno), se
muestran sus ratings (bullet/blitz/rapid) y, con Lichess, un overlay que **emite
tu partida en vivo** sin compartir la pestaña del navegador (`/tv`).

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
│   └── common/     → Lógica compartida → paquete @stream-toolkit/common
├── tests/          → Suite Playwright (lógica + e2e)
├── setup.js        → Asistente de instalación y configuración
└── package.json    → Workspaces + scripts orquestadores
```

* **`apps/bot/`** — Bot de chat de Twitch (con [tmi.js](https://github.com/tmijs/tmi.js)).
  Escucha los mensajes del chat y gestiona los comandos (moderación y enlaces de
  Discord genéricos, y —con el módulo de ajedrez— la cola de retadores y los
  enlaces a tu plataforma de juego).
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
* **`packages/common/`** (`@stream-toolkit/common`) — Código compartido entre las apps:
  * `savedData.js` → persistencia simple en ficheros JSON (`DATA_PATH`) y utilidades
    de cola.
  * `chess.js` → **(módulo de ajedrez)** dispatcher de estadísticas según
    `CHESS_PROVIDER` (caché 12h), con proveedores intercambiables en `providers/`
    (`lichess.js`, `chesscom.js`).
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

> La **cola de retadores** y los comandos `!chess` / `!club` pertenecen al módulo
> de ajedrez (opcional). Si no lo usas, el bot sigue ofreciendo el resto:
> `discord` y `!banear`.

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

https://id.twitch.tv/oauth2/authorize?client_id=TU_CLIENT_ID&redirect_uri=http://localhost&response_type=token&scope=chat:edit+chat:read+channel:moderate+moderator:manage:banned_users+moderator:manage:chat_messages+moderator:manage:automod+moderator:read:followers+channel:manage:broadcast

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
(la app de Twitch, cómo generar el token OAuth, enlaces de Discord y de tu plataforma de juego):

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

# === Módulo de ajedrez (opcional, solo para directos de ajedrez) ===
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

## Panel de control (`/admin`)

`/admin` es el **centro de control del directo**. A la izquierda, siempre visible,
el **chat de Twitch en vivo con moderación** (borrar mensaje, timeout, ban — al pasar
el ratón por cada mensaje). A la derecha, en pestañas:

* **🎬 Escenas** — juego/tema + pantalla activa (y la cola del módulo de ajedrez).
* **🎚️ Audio** — faders y mutes del mezclador de OBS (ver más abajo).
* **🔊 Sonidos** — soundboard: dispara efectos de `apps/web/public/sounds/` en el overlay.
* **🎵 Música** — reproductor, **descarga de Jamendo** por tag y **editor de playlists**.

> **Chat/moderación**: el chat se lee en cliente (IRC de Twitch por WebSocket, anónimo).
> Las acciones de moderación van por `/api/admin/mod` → Helix, así que el **token OAuth
> debe incluir** `moderator:manage:banned_users` y `moderator:manage:chat_messages`
> (la URL de la sección "Conseguir Token" ya los pide; regénéralo si es antiguo).
> "Kick" no existe en Twitch: se aplica como **timeout**.
>
> **Mensajes retenidos** (AutoMod o la opción de Twitch *"revisar el primer mensaje de
> chatters nuevos"*) aparecen en el panel en una sección **"⏳ Pendientes de aprobar"** con
> botones **Publicar / Rechazar**. Esos mensajes no llegan por el IRC anónimo: se reciben
> por **EventSub** (el navegador abre el WebSocket y `/api/admin/eventsub/subscribe` da de
> alta las suscripciones con el token), así que el token **debe incluir además**
> `moderator:manage:automod`.
>
> **Filtro IA (OpenRouter)**: cada mensaje retenido se envía a un LLM que sugiere
> **Publicar / Rechazar / Revisar** con un nivel de confianza y un motivo (se muestra en
> la tarjeta). La clave (`OPENROUTER_API_KEY`) vive solo en el servidor; el panel llama a
> `/api/admin/automod/triage`. Hay un modo **auto** (opcional, desactivado por defecto) que
> publica solo los "Publicar" con confianza alta; el resto siempre lo decides tú. El modelo
> por defecto es gratuito (`OPENROUTER_MODEL`, p.ej. `google/gemini-2.0-flash-exp:free`).
>
> **Alertas de primer mensaje y follow**: cuando alguien interviene por primera vez o le da
> a follow se muestra una **animación en el overlay** (la ve la audiencia) y, por separado,
> un **aviso de voz privado para ti** en el panel (anuncia el nombre y, si lo activas, lee
> el chat). La voz usa la síntesis del navegador (gratis, offline) y **no se emite al
> overlay**, así no se captura en el directo. Los follows llegan por EventSub
> (`channel.follow`), así que el token **debe incluir además** `moderator:read:followers`.
> En los ajustes de voz (🔈, arriba del chat) puedes elegir voz, volumen y **dispositivo de
> salida** del chime; para que la voz tampoco se capture, enruta la salida de audio del
> navegador a ese mismo dispositivo (Voicemeeter / cable virtual).

### Escenas precargadas en la web

En vez de gestionar las pantallas del directo como **colecciones de escenas de
OBS**, el overlay web (`http://localhost:3000`) lleva las pantallas **precargadas**
y las conmutas desde `/admin`. Así OBS solo necesita **un Browser Source**:

```
┌─ Escena de OBS ────────────────────────────┐
│  Captura de juego            (abajo)        │
│  Browser Source → localhost:3000  (encima)  │  ← "Controlar audio mediante OBS"
└─────────────────────────────────────────────┘
```

* La web pinta las pantallas **intro / juego / pausa / cerrando** (opacas a
  pantalla completa salvo el HUD de juego, que es transparente y deja ver la
  captura), la **webcam** (capturada en la propia app con `getUserMedia`) y el
  **reproductor + visualizador de música**.
* Desde **`/admin`** eliges el **juego/tema** (`The King is Watching`, `Valorant`,
  `Meccha Chameleon`) y la **pantalla** activa, y controlas la **música**
  (playlist, ▶/⏸, anterior/siguiente, volumen). El overlay reacciona en ≤1 s (SSE).
* La **webcam** la usa la app: en OBS **no** pongas además una fuente con la misma
  cámara (no se puede compartir el dispositivo).

#### Permiso de cámara en el Browser Source de OBS

El navegador embebido de OBS (CEF) **no habilita la cámara por defecto**: hay que
pasarle flags al arrancar OBS. En el **acceso directo de OBS** (Windows: clic derecho
▸ Propiedades ▸ *Destino*) añade los flags al final:

```
…\obs64.exe --enable-media-stream --use-fake-ui-for-media-stream
```

`--enable-media-stream` habilita `getUserMedia`; `--use-fake-ui-for-media-stream`
acepta el permiso automáticamente (CEF no tiene diálogo para pulsar "Permitir").
Cierra OBS del todo y vuelve a abrirlo **desde ese acceso directo**. Además:

* La URL debe ser `localhost`/`127.0.0.1` (contexto seguro; con una IP de red se bloquea).
* Permiso de cámara del SO para apps de escritorio (Windows: *Privacidad ▸ Cámara*; macOS: *Privacidad ▸ Cámara ▸ OBS*).
* La cámara libre (sin otra app/fuente usándola).

Si algo falla, el overlay muestra un aviso **"Sin acceso a la cámara"** con la causa y
reintenta solo cada 5 s.

> Las colecciones de OBS (`apps/overlays/scenes/`) y los HTML `*-starting/pausa/…`
> siguen disponibles como alternativa; este modelo web los sustituye con un solo
> Browser Source. La colección lista para esto es **`Stream Toolkit`** (un único
> Browser Source a `localhost:3000`).

Variables (en `apps/web/.env.local`):

```
NEXT_PUBLIC_STREAM_HANDLE=     # Tu handle para las pantallas (por defecto TU_CANAL)
NEXT_PUBLIC_COUNTDOWN_MINUTES= # Minutos de la cuenta atrás de "Empezamos pronto" (5)
NEXT_PUBLIC_CAM_DEVICE_ID=     # (opcional) deviceId de la webcam a usar
NEXT_PUBLIC_TWITCH_CHANNEL=    # Canal para el chat de /admin (lo propaga `npm run setup`)
OBS_WEBSOCKET_URL=             # (audio) por defecto ws://127.0.0.1:4455
OBS_WEBSOCKET_PASSWORD=        # (audio) si pusiste contraseña en obs-websocket
OPENROUTER_API_KEY=            # (IA) clave de https://openrouter.ai/keys para el triage
OPENROUTER_MODEL=              # (IA) modelo, por defecto google/gemini-2.0-flash-exp:free
```

> El panel de moderación necesita además `TWITCH_CLIENT_ID`, `TWITCH_OAUTH_TOKEN` y
> `TWITCH_CHANNEL_NAME` en `apps/web/.env.local`: `npm run setup` los copia del bot.
> Para los mensajes retenidos (Pendientes de aprobar) el token necesita el scope
> `moderator:manage:automod`, para las alertas de follow `moderator:read:followers`, y
> para actualizar la información del directo (título y juego) `channel:manage:broadcast`.

### Música libre con `setup-music.js` (Jamendo)

```
npm run setup:music
```

Descarga música **Creative Commons** de [Jamendo](https://www.jamendo.com/) a
`apps/web/public/music/<playlist>/` y genera el manifiesto `music-library.json`
(en `DATA_PATH`) que usan el reproductor y `/admin`. El widget "sonando ahora"
muestra **Título — Artista**, lo que cubre la atribución CC-BY.

Necesita un **Client ID gratuito** de Jamendo
([devportal.jamendo.com](https://devportal.jamendo.com/)): ponlo como
`JAMENDO_CLIENT_ID` en `apps/bot/.env.local` (lo pide `npm run setup`) o pásalo con
`--client-id`. Flags: `--playlist <nombre>`, `--tag <tags>`, `--limit <N>`,
`--dry-run`. El audio descargado **no** se commitea (`apps/web/public/music/`).
También puedes descargar y crear/editar playlists desde la pestaña **Música** de `/admin`.

### Audio: VB-Cable + OBS como mezclador con `setup-audio.js`

Una app no puede *crear* dispositivos de audio virtuales (eso lo hace un driver). La
estrategia: **VB-Cable** separa las fuentes (cada app → su cable) y **OBS** hace de
mezclador, controlado desde `/admin` (pestaña Audio) vía **obs-websocket**.

```
Discord → CABLE   ┐
Juego   → CABLE A  ├─► OBS capta cada "CABLE … Output" como fuente ─► faders en /admin
Música  → CABLE B  ┘                                              └─► monitor a tus auriculares
```

```
npm run setup:audio
```

Imprime la guía (instalar [VB-Cable](https://vb-audio.com/Cable/), enrutar cada app a
su cable en *Configuración de sonido*, fijar el dispositivo de monitorización de OBS) y,
conectando a OBS por websocket, **crea las fuentes de audio** "Juego / Música / Discord"
con monitor + salida. Luego asignas a cada una su `CABLE … Output` en OBS y balanceas
desde `/admin`. Requiere OBS abierto con **Herramientas ▸ obs-websocket** activado.
Flags: `--url`, `--password`, `--juego/--musica/--discord <nombre>`, `--dry-run`.

> Solo en Windows con la web nativa (no en Docker). El monitor por OBS añade algo de
> latencia frente a un mezclador dedicado.

## Configurar OBS y Stream Deck

Además del setup del proyecto, hay dos asistentes que **cargan configuraciones
directamente en esas aplicaciones**. No usan dependencias externas, son
idempotentes y hacen una copia de seguridad (`.bak`) de lo que sobrescriben.

### OBS Studio — colecciones de escenas

```
npm run setup:obs
```

Copia las colecciones de `apps/overlays/scenes/` (`Valorant`, `Mecha Chameleon`,
`The King is Watching`) a la carpeta de configuración de OBS de tu sistema (Windows, macOS o Linux,
incluida la instalación **Flatpak**). De paso **reescribe las rutas de los
Browser Source** —que vienen apuntando a la máquina de otra persona
(`C:/Users/pon_t/...`)— para que apunten a los overlays HTML reales de
`apps/overlays/` de tu equipo, de modo que las escenas funcionen al importarlas.

Tras ejecutarlo, **reinicia OBS** y elige la colección en el menú
*Colección de escenas*. Flags útiles:

* `--serve` → apunta los Browser Source a `http://localhost:4000/<archivo>`
  (el servidor de `npm run overlays`) en lugar de a ficheros locales.
* `--obs-dir <ruta>` → fuerza la carpeta de OBS si la tienes en otro sitio.
* `--dry-run` → muestra lo que haría sin escribir nada.

### Elgato Stream Deck — perfil

```
npm run setup:streamdeck
```

Instala el perfil **"Stream Toolkit"** en la carpeta de perfiles de la app oficial
de Elgato (`ProfilesV2`, en Windows y macOS). El perfil trae botones que abren de
un toque los accesos del directo: overlay de OBS, TV (Lichess), panel `/admin`,
servidor de overlays, tu Discord, tu canal de Twitch y tu perfil/comunidad de juego.
**Las URLs se rellenan a partir de tu configuración real** (`apps/bot/.env.local`
y `apps/web/.env.local`), así que ejecuta antes `npm run setup`.

El perfil está **optimizado para el Stream Deck de 15 teclas (3×5)** y se reparte
en tres filas:

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ Overlay  │   TV     │  Panel   │ Overlays │  Twitch  │   ← accesos del directo
│   OBS    │ Lichess  │  Admin   │  HTML    │          │
├──────────┼──────────┼──────────┼──────────┼──────────┤
│ Discord  │ Perfil   │  Club /  │  Twitch  │  Abrir   │   ← comunidad + tools
│          │ Juego    │ Equipo   │   Dev    │Voicemeeter│
├──────────┼──────────┼──────────┼──────────┼──────────┤
│ 🎙️ Micro │ 🎮 Juego │ 🎵 Música│ 🎧 Cascos│ 🔴 Stream│   ← audio (Voicemeeter)
│          │          │          │   (A1)   │   (B1)   │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

La **fila de audio** silencia/activa cada fuente de Voicemeeter (Micro = `Strip[0]`,
Juego = `Strip[3]`/VAIO, Música = `Strip[4]`/AUX, Cascos = `Bus[0]`/A1, Stream =
`Bus[3]`/B1) con feedback en la tecla. Usa el plugin gratuito **"VoiceMeeter"**
(de BarRaider) de la Store de Elgato: instálalo antes para que esos botones
funcionen. Prepara el audio con `npm run setup:voicemeeter` (más abajo).

Tras ejecutarlo, **cierra y vuelve a abrir** la app de Stream Deck y selecciona el
perfil "Stream Toolkit". Flags útiles:

* `--device <modelo>` → modelo de tu Stream Deck (`DeviceModel`). Por defecto el
  clásico de 15 teclas (`20GAA9901`); también `20GAT9901` (Mini) o `20GBA9901` (XL).
* `--profiles-dir <ruta>` → fuerza la carpeta `ProfilesV2`.
* `--vm-action <uuid>` → UUID de la acción del plugin de Voicemeeter para los
  botones de audio (por defecto el *Advanced Toggle* de BarRaider).
* `--vm-exe <ruta>` → ejecutable de Voicemeeter para el botón "Abrir Voicemeeter"
  (por defecto Banana en su ruta habitual).
* `--dry-run` → muestra lo que haría sin escribir nada.

> La app oficial de Elgato no existe en Linux: ahí el script genera el perfil
> renderizado en `apps/overlays/streamdeck/` para que lo importes a mano en
> alternativas como StreamController / streamdeck-ui.
>
> Los botones de audio vienen colocados y etiquetados. Si tu versión del plugin
> usa otra acción o no arrastra algún ajuste, abre el botón una vez en el panel
> del plugin y confirma el `Strip`/`Bus` (vienen indicados en cada tecla).

### Voicemeeter Banana — audio del stream

```
npm run setup:voicemeeter
```

Genera la configuración de audio en `apps/overlays/voicemeeter/Stream-Toolkit-Banana.xml`
y la deja en tu carpeta `Documents\Voicemeeter` (donde Voicemeeter guarda/lee sus
ajustes), lista para cargar con **Menú ▸ Load Settings…**. Está pensada para
[**Voicemeeter Banana**](https://vb-audio.com/Voicemeeter/banana.htm) (gratuito) y
deja etiquetadas y ruteadas las entradas típicas de un directo:

* **Micro** (`Strip[0]`) → solo al stream (`B1`), no a tus cascos (evita oírte).
* **Juego/Sistema** (`Strip[3]`, entrada virtual *Voicemeeter Input/VAIO*) → cascos (`A1`) + stream (`B1`).
* **Música/Navegador/Discord** (`Strip[4]`, entrada virtual *Voicemeeter Aux Input*) → cascos (`A1`) + stream (`B1`).

Luego, en Windows, manda cada app a su entrada (Configuración de sonido), pon `A1`
hacia tus cascos y añade en OBS una *Captura de audio* del dispositivo
*Voicemeeter Out B1*. Flags útiles:

* `--voicemeeter-dir <ruta>` → fuerza la carpeta donde se escribe la config.
* `--mic` / `--game` / `--music <texto>` → cambia las etiquetas de cada entrada.
* `--dry-run` → muestra lo que haría sin escribir nada.

> Voicemeeter es software de Windows. En macOS/Linux el script solo genera el XML
> renderizado junto a la plantilla para que lo lleves a tu PC.

### Comandos útiles

| Comando | Descripción |
| --- | --- |
| `npm run setup` | Instala y configura todo el monorepo |
| `npm run setup:envs` | Reconfigura solo las variables de entorno (bot + web) |
| `npm run setup:obs` | Carga las colecciones de escenas en OBS Studio |
| `npm run setup:streamdeck` | Carga el perfil del stream (3×5) en Elgato Stream Deck |
| `npm run setup:voicemeeter` | Genera la config de audio para Voicemeeter Banana |
| `npm run setup:music` | Descarga música libre (Jamendo) para el reproductor de la web |
| `npm run setup:audio` | Crea en OBS las fuentes de audio (VB-Cable) que controla `/admin` |
| `npm run bot` / `npm run bot:dev` | Arranca el bot (prod / con recarga) |
| `npm run web:dev` / `web:build` / `web:start` / `web:lint` | App Next.js |
| `npm run overlays` | Sirve los overlays HTML para OBS |
| `npm test` / `npm run test:logic` / `npm run test:e2e` | Tests (Playwright) |
| `npm run up` / `down` | Docker compose arriba / abajo |

A volar!
