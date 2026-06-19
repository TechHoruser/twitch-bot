import { manageHeldMessage } from '@stream-toolkit/common/twitchCommands';
import { getTwitchIds } from '@/lib/twitchIds';

// Aprueba o rechaza mensajes retenidos por AutoMod / por la revisión de chatters
// nuevos. Los mensajes retenidos llegan al cliente por EventSub (ver
// /api/admin/eventsub/subscribe); aquí solo se ejecuta la acción, que requiere un
// token con el scope moderator:manage:automod.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const action = body.action === 'allow' ? 'ALLOW' : body.action === 'deny' ? 'DENY' : null;

  if (!action) return Response.json({ error: 'acción no válida' }, { status: 400 });
  if (!body.msgId) return Response.json({ error: 'falta msgId' }, { status: 400 });

  try {
    const { broadcasterId, moderatorId } = await getTwitchIds();
    if (!broadcasterId) {
      return Response.json({ error: 'Faltan credenciales de Twitch en apps/web/.env.local' }, { status: 400 });
    }
    await manageHeldMessage({ msgId: body.msgId, action, moderatorId });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
