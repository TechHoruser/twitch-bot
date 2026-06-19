import { triggerAlert } from '@stream-toolkit/common/alert';

const TYPES = ['first-message', 'follow'];

// POST { type, name }: dispara una alerta visual en el overlay (vía SSE alert).
// El sonido/voz se reproduce aparte, en el panel, para no capturarlo en el directo.
export async function POST(request) {
  const { type, name } = await request.json().catch(() => ({}));
  if (!TYPES.includes(type)) {
    return Response.json({ error: 'tipo de alerta no válido' }, { status: 400 });
  }
  const state = triggerAlert({ type, name: name || '' });
  return Response.json({ ok: true, state });
}
