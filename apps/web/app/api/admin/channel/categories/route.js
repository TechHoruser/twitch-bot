import { searchCategories } from '@stream-toolkit/common/twitchCommands';

// GET ?q=: busca categorías/juegos de Twitch por nombre (autocompletado del editor
// de directo). Requiere mínimo 2 caracteres.
export async function GET(request) {
  const q = (new URL(request.url).searchParams.get('q') || '').trim();
  if (q.length < 2) return Response.json({ categories: [] });

  try {
    const categories = await searchCategories(q);
    return Response.json({ categories });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
