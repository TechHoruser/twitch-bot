import { logEvents, getSessions, getSessionDetail } from '@stream-toolkit/common/presence';

// GET            → lista de sesiones (directos) con resumen.
// GET ?session=  → detalle de una sesión (sesión + eventos join/part).
export async function GET(request) {
  const id = new URL(request.url).searchParams.get('session');
  if (id) {
    const detail = getSessionDetail(id);
    if (!detail) return Response.json({ error: 'sesión no encontrada' }, { status: 404 });
    return Response.json({ ok: true, ...detail });
  }
  return Response.json({ ok: true, sessions: getSessions() });
}

// POST { events: [{ login, name, type:'join'|'part' }] }: registra una tanda de
// entradas/salidas del chat. Lo envía el panel a partir de los JOIN/PART del IRC.
export async function POST(request) {
  const { events } = await request.json().catch(() => ({}));
  if (!Array.isArray(events)) {
    return Response.json({ error: 'events debe ser un array' }, { status: 400 });
  }
  const res = logEvents(events);
  return Response.json({ ok: true, ...res });
}
