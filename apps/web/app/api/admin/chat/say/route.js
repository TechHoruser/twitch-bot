import { sendChatAnnouncement } from '@stream-toolkit/common/twitchCommands';
import { getTwitchIds } from '@/lib/twitchIds';

// POST { message }: publica un mensaje en el chat como anuncio destacado (Helix).
// Lo usa el botón "Enviar al chat" de la respuesta de la IA. El token necesita el
// scope moderator:manage:announcements.
export async function POST(request) {
  const { message } = await request.json().catch(() => ({}));
  const text = (message || '').trim();
  if (!text) return Response.json({ error: 'falta message' }, { status: 400 });

  try {
    const { broadcasterId, moderatorId } = await getTwitchIds();
    if (!broadcasterId) {
      return Response.json({ error: 'Faltan credenciales de Twitch en apps/web/.env.local' }, { status: 400 });
    }
    await sendChatAnnouncement({ broadcasterId, moderatorId, message: text.slice(0, 500) });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
