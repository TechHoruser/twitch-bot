import { getObs } from '@/lib/obs';
import { getChannelInfo } from '@stream-toolkit/common/twitchCommands';
import { startSession, endSession } from '@stream-toolkit/common/presence';
import { getTwitchIds } from '@/lib/twitchIds';

// POST { action: 'start' | 'stop' }: arranca o detiene la retransmisión en OBS
// (obs-websocket) y, en paralelo, abre/cierra la sesión de presencia para que el
// log de entradas/salidas quede agrupado por directo.
//
// Nota: Twitch no permite "ponerse en directo" por API; eso lo hace el software de
// emisión. Por eso controlamos OBS, que es quien envía el RTMP a Twitch.
export async function POST(request) {
  const { action } = await request.json().catch(() => ({}));
  if (action !== 'start' && action !== 'stop') {
    return Response.json({ error: "action debe ser 'start' o 'stop'" }, { status: 400 });
  }

  let obs;
  try {
    obs = await getObs();
  } catch (e) {
    return Response.json({ error: `No se pudo conectar con OBS: ${e.message}` }, { status: 502 });
  }

  try {
    if (action === 'start') {
      // Evita el error de obs-websocket si ya estaba emitiendo.
      const { outputActive } = await obs.call('GetStreamStatus');
      if (!outputActive) await obs.call('StartStream');

      // Titula la sesión con la info actual del directo (mejor para el registro).
      let title;
      try {
        const { broadcasterId } = await getTwitchIds();
        const info = await getChannelInfo({ broadcasterId });
        title = info.title;
      } catch { /* sin título: la sesión usará el de por defecto */ }
      startSession({ title });
      return Response.json({ ok: true, streaming: true });
    }

    const { outputActive } = await obs.call('GetStreamStatus');
    if (outputActive) await obs.call('StopStream');
    endSession();
    return Response.json({ ok: true, streaming: false });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
