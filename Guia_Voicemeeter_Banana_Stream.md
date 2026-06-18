# Guía Voicemeeter Banana para stream (juego · música · Discord · mic)

Setup pensado para: **Voicemeeter Banana** + **OBS Studio** + **Blue Yeti** (cascos enchufados al jack del propio Yeti).

---

## La idea en 30 segundos

Voicemeeter es una "mesa de mezclas" virtual. A la **izquierda** entran tus fuentes de sonido (mic, juego, música, Discord). A la **derecha** hay "buses" de salida (A1, A2, A3 = salidas físicas como tus cascos; B1, B2 = salidas virtuales que captura OBS).

Tú decides, con unos botones en cada fuente, **a dónde va cada sonido**: a tus cascos (para oírlo), al stream (B1), o a ambos.

**Detalle importante de tu hardware:** el Blue Yeti es a la vez tu **micrófono** (entrada) y tu **salida de cascos** (lo que enchufas al jack del Yeti suena por la salida USB del Yeti). Así que el Yeti aparece dos veces: una como entrada (mic) y otra como salida (cascos).

**Un aviso sobre Banana:** tiene 2 entradas virtuales propias, pero tú quieres separar 3 apps (juego, música, Discord). Por eso instalaremos **un cable virtual extra gratis (VB-CABLE)** para que entren las tres por separado.

---

## El plano final (a dónde va cada cosa)

| Fuente | Entra en Voicemeeter por... | App de Windows apunta a... |
|---|---|---|
| 🎤 Mic (Blue Yeti) | Hardware Input 1 | — (es entrada física) |
| 🎮 Juego | Voicemeeter Input (VAIO) | Salida **predeterminada** de Windows |
| 🎵 Música (Spotify, etc.) | Hardware Input 2 = `CABLE Output` | Volumen por app → `CABLE Input` |
| 💬 Discord | Voicemeeter Aux Input (AUX) | Ajustes de voz de Discord → salida |

| Salida (bus) | Para qué sirve | Dispositivo |
|---|---|---|
| A1 | Tus **cascos** (oír todo) | Blue Yeti (salida) |
| B1 | Mezcla que captura **OBS** | Voicemeeter Out B1 (virtual) |
| B2 | *(opcional)* música sola, para silenciarla en el VOD por copyright | Voicemeeter Aux Out B2 |

---

## Paso 1 — Instalar lo necesario

1. **Voicemeeter Banana**: descárgalo desde la web oficial **vb-audio.com → Voicemeeter → Banana**. Instálalo y **reinicia el PC** (es obligatorio).
2. **VB-CABLE** (cable virtual extra, gratis): misma web, **vb-audio.com → VB-CABLE**. Instálalo **como administrador** y **reinicia otra vez**.

> Tras reiniciar, en los dispositivos de sonido de Windows deberían aparecer: *Voicemeeter Input*, *Voicemeeter Aux Input*, *Voicemeeter Out B1*, *CABLE Input* y *CABLE Output*.

---

## Paso 2 — Configurar las ENTRADAS en Voicemeeter

Abre Voicemeeter Banana. En la parte de arriba verás las columnas de entrada.

1. **Hardware Input 1** → clic en el nombre arriba → elige tu **Blue Yeti** (busca el que ponga `WDM` o `KS`; si va raro, prueba `MME`). Esta es tu voz.
2. **Hardware Input 2** → clic → elige **`CABLE Output (VB-Audio Virtual Cable)`**. Por aquí entrará la música.
3. La columna **"Voicemeeter VAIO"** (Voicemeeter Input) será el **juego**. No hay que tocar nada aquí, solo recordar que es el juego.
4. La columna **"Voicemeeter AUX"** (Voicemeeter Aux Input) será **Discord**.

---

## Paso 3 — Configurar las SALIDAS (cascos) en Voicemeeter

Arriba a la derecha están A1, A2, A3.

1. Clic en **A1** → elige tu **Blue Yeti** (la salida, donde tienes los cascos). Otra vez, prueba `WDM`/`KS` y si no, `MME`.

Ahora dile a cada fuente que suene en tus cascos (A1) y en el stream (B1). En la parte **inferior de cada columna** hay botones `A1 A2 A3 B1 B2`. Enciende (se ponen en verde) así:

| Columna | A1 (cascos) | B1 (stream) | B2 |
|---|:---:|:---:|:---:|
| Mic (Hardware Input 1) | ✅ | ✅ | — |
| Música (Hardware Input 2) | ✅ | ✅ | ✅ *(opcional)* |
| Juego (Voicemeeter VAIO) | ✅ | ✅ | — |
| Discord (Voicemeeter AUX) | ✅ | ✅ | — |

> ¿No quieres oírte a ti mismo en los cascos? Apaga **A1** en la columna del Mic (déjalo solo en B1).

---

## Paso 4 — Decirle a Windows y a cada app a dónde mandar su sonido

**Juego (y sonido general de Windows):**
Clic derecho en el altavoz de la barra de tareas → *Configuración de sonido* → Salida → pon como predeterminada **Voicemeeter Input**.

**Música (Spotify, navegador, etc.):**
En *Configuración de sonido* baja hasta **"Mezclador de volumen"** (o *Volumen de aplicaciones y preferencias de dispositivo*). Busca tu app de música y en su **Salida** elige **`CABLE Input`**.

**Discord:**
Discord → ⚙️ Ajustes → *Voz y vídeo* → **Dispositivo de salida** = **Voicemeeter Aux Input**.
(El **dispositivo de entrada** de Discord déjalo en tu **Blue Yeti**, para que tus amigos te oigan directo.)

> Truco: si una app no aparece en el mezclador, ábrela y reproduce algo un segundo; entonces aparece.

---

## Paso 5 — Configurar OBS

En OBS, cada fuente de audio se añade así: panel **Fuentes** → ➕ → **Captura de entrada de audio**.

- Añade una llamada **"Stream Mix"** → dispositivo **`Voicemeeter Out B1`**. Esto lleva al stream todo lo que enviaste a B1 (mic + juego + música + Discord).
- *(Opcional)* Añade **"Música"** → dispositivo **`Voicemeeter Aux Out B2`** si activaste B2 en la columna de música. Así puedes silenciar SOLO la música en la grabación/VOD (útil por copyright) sin tocar el resto.

En **Ajustes → Audio** de OBS, deja "Dispositivo de audio global" todos en *Desactivado* (ya gestionas todo por las fuentes de arriba; evita audio duplicado).

---

## Cómo controlas el volumen mientras juegas

Aquí está la gracia: con los **deslizadores (faders) de Voicemeeter** subes o bajas cada cosa en tiempo real e independientemente:

- ¿La música tapa tu voz? Baja el fader de la columna de música.
- ¿No oyes a un amigo? Sube la columna de Discord.
- ¿Quieres mutear algo al instante? El botón rojo de cada columna lo silencia.

Esto afecta a la vez a lo que oyes tú y a lo que oye el stream (porque mandaste todo a A1 + B1). Es la forma normal y más cómoda de trabajar en Banana.

---

## Sobre "una salida separada por cada cosa" en OBS

Banana tiene solo 2 salidas virtuales (B1 y B2), así que en OBS no puedes tener 4 pistas 100% independientes (mic / juego / música / Discord por separado) solo con Banana. Tienes dos caminos:

1. **Recomendado y fácil:** controlas el volumen de cada fuente con los faders de Voicemeeter (como en el apartado anterior) y mandas **una sola mezcla limpia** a OBS por B1. Es lo que hace la mayoría.
2. **Separación total real** (cada fuente como pista aparte para editar el VOD o mezclar en OBS): necesitarías **Voicemeeter Potato** (8 buses) o varios VB-CABLE extra. Si algún día lo quieres, te monto ese esquema.

Con este setup ya cubres lo principal: B2 te deja, como mínimo, separar la **música** del resto (lo más útil por temas de copyright en el VOD).

---

## Checklist rápido de prueba

1. Reproduce música → debe verse moverse la columna **Hardware Input 2** y oírse en cascos.
2. Pon sonido del juego → se mueve **Voicemeeter VAIO**.
3. Habla por Discord con alguien → se mueve **Voicemeeter AUX**.
4. Habla al mic → se mueve **Hardware Input 1**.
5. En OBS, la fuente "Stream Mix" debe moverse con todo lo anterior.

Si una columna no se mueve, revisa el Paso 4 (a qué dispositivo apunta esa app).
