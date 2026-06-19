import { getObs } from '@/lib/obs';
import {
  getChannelInfo,
  updateChannelInfo,
  sendChatAnnouncement,
} from '@stream-toolkit/common/twitchCommands';
import { startSession, endSession } from '@stream-toolkit/common/presence';
import { getTwitchIds } from '@/lib/twitchIds';

// POST { action: 'start' | 'stop', title?, gameId?, announcement? }
// Arranca o detiene la retransmisión en OBS (obs-websocket) y, en paralelo,
// abre/cierra la sesión de presencia para que el log de entradas/salidas quede
// agrupado por directo.
//
// Al iniciar, el formulario previo puede mandar también:
//   - title / gameId  → actualiza el directo (Helix Modify Channel Information).
//   - announcement     → publica un anuncio destacado en el chat (Helix).
//
// Nota: Twitch no permite "ponerse en directo" ni fijar la notificación a
// seguidores por su API pública; eso lo hace el software de emisión. Por eso
// controlamos OBS (que envía el RTMP) y la "notificación" se resuelve como
// anuncio de chat, que es lo más cercano soportado por Helix.
export async function POST(request) {
  const { action, title, gameId, announcement } = await request.json().catch(() => ({}));
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
    if (action === 'stop') {
      const { outputActive } = await obs.call('GetStreamStatus');
      if (outputActive) await obs.call('StopStream');
      endSession();
      return Response.json({ ok: true, streaming: false });
    }

    // --- Iniciar retransmisión ---
    const { broadcasterId, moderatorId } = await getTwitchIds();

    // 1) Aplica título/categoría si vienen del formulario.
    const warnings = [];
    if (title !== undefined || gameId !== undefined) {
      try {
        await updateChannelInfo({ broadcasterId, title, gameId });
      } catch (e) {
        warnings.push(`No se pudo actualizar el directo: ${e.message}`);
      }
    }

    // 2) Arranca OBS (evita el error de obs-websocket si ya estaba emitiendo).
    const { outputActive } = await obs.call('GetStreamStatus');
    if (!outputActive) await obs.call('StartStream');

    // 3) Abre la sesión de presencia titulada con el directo.
    let sessionTitle = title;
    if (sessionTitle === undefined) {
      try {
        const info = await getChannelInfo({ broadcasterId });
        sessionTitle = info.title;
      } catch { /* sin título: la sesión usará el de por defecto */ }
    }
    startSession({ title: sessionTitle });

    // 4) Publica el anuncio en el chat (la "notificación") si se indicó.
    if (announcement && announcement.trim()) {
      try {
        await sendChatAnnouncement({ broadcasterId, moderatorId, message: announcement.trim() });
      } catch (e) {
        warnings.push(`No se pudo publicar el anuncio en el chat: ${e.message}`);
      }
    }

    return Response.json({ ok: true, streaming: true, warnings });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
