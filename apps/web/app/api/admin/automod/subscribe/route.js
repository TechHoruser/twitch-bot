import { createEventSubSubscription } from '@stream-toolkit/common/twitchCommands';
import { getTwitchIds } from '@/lib/twitchIds';

// Da de alta las suscripciones de EventSub para recibir los mensajes retenidos en
// el cliente. El navegador abre el WebSocket de EventSub, nos envía su session_id
// y aquí lo registramos con el token (que nunca sale al cliente).
export async function POST(request) {
  const { sessionId } = await request.json().catch(() => ({}));
  if (!sessionId) return Response.json({ error: 'falta sessionId' }, { status: 400 });

  try {
    const { broadcasterId, moderatorId } = await getTwitchIds();
    if (!broadcasterId) {
      return Response.json({ error: 'Faltan credenciales de Twitch en apps/web/.env.local' }, { status: 400 });
    }
    const condition = { broadcaster_user_id: broadcasterId, moderator_user_id: moderatorId };
    await Promise.all([
      createEventSubSubscription({ type: 'automod.message.hold', version: '2', condition, sessionId }),
      createEventSubSubscription({ type: 'automod.message.update', version: '2', condition, sessionId }),
    ]);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
