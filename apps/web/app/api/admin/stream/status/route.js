import { getStreamInfo } from '@stream-toolkit/common/twitchCommands';
import { recordViewers } from '@stream-toolkit/common/presence';
import { getTwitchIds } from '@/lib/twitchIds';
import { getObs } from '@/lib/obs';

// GET: estado del directo para la pestaña "Directo".
//  - live / viewerCount / startedAt / title / gameName  → Helix (Get Streams).
//  - obsStreaming → estado de la retransmisión en OBS (si está accesible).
// De paso registra el pico de espectadores en la sesión de presencia abierta.
export async function GET() {
  let stream = { live: false, viewerCount: 0, startedAt: null, gameName: '', title: '' };
  let streamError = null;
  try {
    const { broadcasterId } = await getTwitchIds();
    if (!broadcasterId) {
      streamError = 'Faltan credenciales de Twitch en apps/web/.env.local';
    } else {
      stream = await getStreamInfo({ broadcasterId });
      if (stream.live) recordViewers(stream.viewerCount);
    }
  } catch (e) {
    streamError = e.message;
  }

  // El estado de OBS es opcional: si OBS no está abierto no debe romper la vista.
  let obsStreaming = null;
  try {
    const obs = await getObs();
    const { outputActive } = await obs.call('GetStreamStatus');
    obsStreaming = !!outputActive;
  } catch {
    obsStreaming = null; // OBS no disponible
  }

  return Response.json({ ok: !streamError, ...stream, obsStreaming, error: streamError });
}
