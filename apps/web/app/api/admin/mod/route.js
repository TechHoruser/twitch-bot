import {
  getUserId, banUser, unbanUser, deleteMessage,
} from '@stream-toolkit/common/twitchCommands';
import { getTwitchIds } from '@/lib/twitchIds';

// Acciones de moderación de Twitch (vía Helix). El chat se muestra en cliente
// (IRC por WebSocket); aquí solo se ejecutan las acciones, que requieren token.
// El token de la web necesita los scopes moderator:manage:banned_users y
// moderator:manage:chat_messages.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { action } = body;

  try {
    const { broadcasterId, moderatorId } = await getTwitchIds();
    if (!broadcasterId) {
      return Response.json({ error: 'Faltan credenciales de Twitch en apps/web/.env.local' }, { status: 400 });
    }

    let userId = body.userId;
    if (!userId && body.username && action !== 'delete') {
      userId = await getUserId(body.username);
      if (!userId) return Response.json({ error: `usuario @${body.username} no encontrado` }, { status: 404 });
    }

    switch (action) {
      case 'delete':
        await deleteMessage({ broadcasterId, moderatorId, messageId: body.messageId });
        break;
      case 'timeout':
        await banUser({ userId, duration: body.duration || 600, reason: body.reason || 'timeout', broadcasterId, moderatorId });
        break;
      case 'ban':
        await banUser({ userId, reason: body.reason || 'ban', broadcasterId, moderatorId });
        break;
      case 'unban':
        await unbanUser({ userId, broadcasterId, moderatorId });
        break;
      default:
        return Response.json({ error: 'acción no válida' }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
