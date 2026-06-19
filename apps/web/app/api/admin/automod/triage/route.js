import { triageMessage } from '@stream-toolkit/common/openrouter';

// POST { text, name }: pide a un LLM (OpenRouter) que valore un mensaje retenido y
// devuelve { verdict: 'allow'|'deny'|'review', confidence, reason }. La clave
// (OPENROUTER_API_KEY) vive solo aquí, en el servidor.
export async function POST(request) {
  const { text, name } = await request.json().catch(() => ({}));
  if (!text) return Response.json({ error: 'falta text' }, { status: 400 });

  try {
    const verdict = await triageMessage({ name: name || '', text });
    return Response.json({ ok: true, ...verdict });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
