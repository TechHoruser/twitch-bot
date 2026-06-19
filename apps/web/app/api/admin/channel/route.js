import { getChannelInfo, updateChannelInfo } from '@stream-toolkit/common/twitchCommands';
import { getTwitchIds } from '@/lib/twitchIds';

// GET: información actual del directo (título + categoría/juego).
// POST { title?, gameId? }: actualiza el directo (Helix). Requiere un token con el
// scope channel:manage:broadcast perteneciente al propio broadcaster.
export async function GET() {
  try {
    const { broadcasterId } = await getTwitchIds();
    if (!broadcasterId) {
      return Response.json({ error: 'Faltan credenciales de Twitch en apps/web/.env.local' }, { status: 400 });
    }
    const info = await getChannelInfo({ broadcasterId });
    return Response.json({ ok: true, ...info });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { title, gameId } = await request.json().catch(() => ({}));
  if (title === undefined && gameId === undefined) {
    return Response.json({ error: 'nada que actualizar' }, { status: 400 });
  }

  try {
    const { broadcasterId } = await getTwitchIds();
    if (!broadcasterId) {
      return Response.json({ error: 'Faltan credenciales de Twitch en apps/web/.env.local' }, { status: 400 });
    }
    await updateChannelInfo({ broadcasterId, title, gameId });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
