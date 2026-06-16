# Tests (Playwright)

Suite de pruebas del bot de stream de ajedrez. Se usa **Playwright Test** como
runner unificado, con dos proyectos:

| Proyecto | Carpeta | Qué cubre | Navegador |
| --- | --- | --- | --- |
| `logic` | `tests/logic` | Toda la lógica de negocio (cola, Chess.com, comandos de chat, overlays, baneos) | No |
| `e2e` | `tests/e2e` | La web Next.js de punta a punta (overlay OBS, panel admin, rutas API) | Sí |

## Instalación

```bash
npm install          # en la raíz del repo: instala @playwright/test
npm --prefix web install
(cd common-js && npm install)   # necesario para el mock de chess-web-api
```

## Ejecutar las pruebas de lógica (no necesitan navegador)

```bash
npm run test:logic
```

Estas pruebas:

* Usan un directorio de datos temporal (`DATA_PATH`, por defecto `.test-data/`)
  en lugar de `/data`, así que no tocan datos reales.
* Fuerzan `NODE_ENV=test` para que `centerOverload` **no** arranque su bucle de
  polling (`setInterval`) al importarse.
* Simulan la API de Chess.com (`tests/helpers/chessMock.js`) y el cliente de
  Twitch (`tests/helpers/data.js` → `makeClient`), sin red.

## Ejecutar las pruebas E2E de la web (necesitan navegador)

1. Instala el navegador (en este entorno la descarga puede estar bloqueada por
   la política de red; ejecútalo en local):

   ```bash
   npx playwright install chromium
   ```

2. Levanta la web. La forma más sencilla es con Docker, que ya monta
   `/common-js` y `/data`:

   ```bash
   docker compose up web
   ```

   (o descomenta el bloque `webServer` de `playwright.config.js` para que
   Playwright la levante automáticamente).

3. Lanza la suite:

   ```bash
   npm run test:e2e
   ```

## Cobertura funcional

* **Cola de jugadores** — `!cola`, `!cola:unirme`, `!cola:ver`, `!cola:salir`,
  `!cola:limpiar-usuario`, `!cola:limpiar`, `!cola:siguiente`, prioridades,
  duplicados, mapping Twitch↔Chess.com.
* **Chess.com** — mapeo de ratings, caché de 12h, usuario inexistente, errores
  de API, valores por defecto (`N/A`).
* **Comandos de Twitch** — enlaces de Discord/Chess.com/Club, `!banear`
  (permisos, usuario inexistente, fallo de API, resolución de `broadcaster_id`).
* **Overlays** — encolado por prioridad, paso al centro, limpieza por duración.
* **Almacenamiento** — operaciones de cola y JSON sobre ficheros.
* **Web** — carga del overlay, conexión SSE, controles del panel admin y rutas
  API (`/api/admin/queue`, `/api/admin/queue/pop`).
