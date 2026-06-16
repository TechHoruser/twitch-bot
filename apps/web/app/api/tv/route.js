// Resuelve la partida que debe mostrar el overlay de TV: la que el usuario está
// jugando ahora mismo en Lichess o, si no hay ninguna en curso, la última.
// Mantiene las llamadas a Lichess en el servidor (evita CORS desde el iframe).

export const dynamic = 'force-dynamic';

const LICHESS_API = 'https://lichess.org/api';

// Color desde el que se debe orientar el tablero (el del propio usuario).
const orientationFor = (game, userId) =>
  game?.players?.black?.user?.id === userId ? 'black' : 'white';

// Partida en curso (o null si no hay ninguna).
const fetchCurrentGame = async (user) => {
  const res = await fetch(
    `${LICHESS_API}/user/${encodeURIComponent(user)}/current-game?moves=false&pgnInJson=false&clocks=false&evals=false`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' }
  );
  if (!res.ok) return null;
  const game = await res.json();
  return game?.id ? game : null;
};

// Última partida jugada (fallback cuando no hay ninguna en curso).
const fetchLastGame = async (user) => {
  const res = await fetch(
    `${LICHESS_API}/games/user/${encodeURIComponent(user)}?max=1&moves=false&pgnInJson=false&clocks=false&evals=false`,
    { headers: { Accept: 'application/x-ndjson' }, cache: 'no-store' }
  );
  if (!res.ok) return null;
  const text = (await res.text()).trim();
  if (!text) return null;
  try {
    const game = JSON.parse(text.split('\n')[0]);
    return game?.id ? game : null;
  } catch {
    return null;
  }
};

export async function GET(request) {
  const user = new URL(request.url).searchParams.get('user');
  if (!user) {
    return Response.json({ gameId: null, error: 'missing user' }, { status: 400 });
  }

  const userId = user.toLowerCase();

  try {
    const game = (await fetchCurrentGame(user)) || (await fetchLastGame(user));
    if (!game) {
      return Response.json({ gameId: null }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return Response.json(
      { gameId: game.id, orientation: orientationFor(game, userId), live: game.status === 'started' },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return Response.json({ gameId: null, error: String(error) }, { status: 502 });
  }
}
