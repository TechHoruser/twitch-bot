import { sendChatAnnouncement, sendChatMessage } from '@stream-toolkit/common/twitchCommands';
import { getTwitchIds } from '@/lib/twitchIds';

// POST { message, announce }: publica un mensaje en el chat.
// - Por defecto (announce ausente o false) lo manda como mensaje normal del chat
//   (Helix Send Chat Message, scope user:write:chat). Lo usa la caja de "escribir
//   en el chat" del panel de admin.
// - Con announce: true lo publica como anuncio destacado (Helix Send Chat
//   Announcement, scope moderator:manage:announcements). Lo usa el botón
//   "Enviar al chat" de la respuesta de la IA.
export async function POST(request) {
  const { message, announce } = await request.json().catch(() => ({}));
  const text = (message || '').trim();
  if (!text) return Response.json({ error: 'falta message' }, { status: 400 });

  try {
    const { broadcasterId, moderatorId } = await getTwitchIds();
    if (!broadcasterId) {
      return Response.json({ error: 'Faltan credenciales de Twitch en apps/web/.env.local' }, { status: 400 });
    }
    if (announce) {
      await sendChatAnnouncement({ broadcasterId, moderatorId, message: text.slice(0, 500) });
    } else {
      await sendChatMessage({ broadcasterId, senderId: moderatorId, message: text.slice(0, 500) });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
