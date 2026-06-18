import { getScene, setScene } from '@stream-toolkit/common/scene';

// Estado de la escena activa del overlay (juego + pantalla). El overlay lo recibe
// por SSE (/api/overload, evento `sceneChange`); aquí solo se lee y se escribe.
export async function GET() {
  return Response.json(getScene());
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const next = setScene({ game: body.game, screen: body.screen });
  return Response.json(next);
}
