import { assistChat } from '@stream-toolkit/common/openrouter';
import { getChannelInfo, resolveChessLinks } from '@stream-toolkit/common/twitchCommands';
import { getTwitchIds } from '@/lib/twitchIds';

// POST { messages: [{ name, text }] }: pasa los últimos mensajes del chat a un LLM
// (OpenRouter) junto con el contexto del canal (enlace de Discord, perfil/club de
// ajedrez y título/juego del directo en vivo) para que eche un cable al viewer con
// tono bromista. Devuelve { ok, reply }. La clave (OPENROUTER_API_KEY) y los enlaces
// viven solo aquí, en el servidor.
export async function POST(request) {
  const { messages } = await request.json().catch(() => ({}));
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'faltan mensajes' }, { status: 400 });
  }

  // Contexto del canal: los enlaces salen del entorno; el título/juego se leen en
  // vivo de Helix (si hay credenciales). Todo es opcional y tolera fallos.
  const env = process.env;
  const chess = resolveChessLinks(env);
  const context = {
    discordLink: env.DISCORD_LINK || '',
    chess: { name: chess.name, profileLink: chess.profileLink, clubLink: chess.clubLink },
    stream: {},
  };

  try {
    const { broadcasterId } = await getTwitchIds();
    if (broadcasterId) {
      const info = await getChannelInfo({ broadcasterId });
      context.stream = { title: info.title, gameName: info.gameName };
    }
  } catch { /* sin info del directo: la IA sigue con el resto del contexto */ }

  try {
    const reply = await assistChat({ messages, context });
    return Response.json({ ok: true, reply });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
