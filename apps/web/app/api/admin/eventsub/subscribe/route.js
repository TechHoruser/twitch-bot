import { createEventSubSubscription } from '@stream-toolkit/common/twitchCommands';
import { getTwitchIds } from '@/lib/twitchIds';

// Da de alta las suscripciones de EventSub que consume el panel: mensajes
// retenidos por AutoMod y nuevos follows. El navegador abre el WebSocket de
// EventSub, nos envía su session_id y aquí lo registramos con el token (que nunca
// sale al cliente). Scopes necesarios: moderator:manage:automod y
// moderator:read:followers.
const SUBSCRIPTIONS = [
  { type: 'automod.message.hold', version: '2' },
  { type: 'automod.message.update', version: '2' },
  { type: 'channel.follow', version: '2' },
];

export async function POST(request) {
  const { sessionId } = await request.json().catch(() => ({}));
  if (!sessionId) return Response.json({ error: 'falta sessionId' }, { status: 400 });

  try {
    const { broadcasterId, moderatorId } = await getTwitchIds();
    if (!broadcasterId) {
      return Response.json({ error: 'Faltan credenciales de Twitch en apps/web/.env.local' }, { status: 400 });
    }
    const condition = { broadcaster_user_id: broadcasterId, moderator_user_id: moderatorId };
    const results = await Promise.allSettled(
      SUBSCRIPTIONS.map((s) => createEventSubSubscription({ ...s, condition, sessionId })),
    );

    // No abortamos si una falla (p.ej. falta un scope): devolvemos qué tipos
    // quedaron activos para que el panel avise con precisión.
    const active = SUBSCRIPTIONS.filter((_, i) => results[i].status === 'fulfilled').map((s) => s.type);
    const failed = SUBSCRIPTIONS.filter((_, i) => results[i].status === 'rejected').map((s) => s.type);

    return Response.json({ ok: active.length > 0, active, failed });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
