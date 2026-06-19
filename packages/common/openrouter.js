// Triage de mensajes retenidos con un LLM vía OpenRouter (API compatible con
// OpenAI). La clave vive solo en el servidor (apps/web/.env.local); el panel llama
// a /api/admin/automod/triage, que usa esto. Inyectable (env, fetch) para testear.
//
// Variables: OPENROUTER_API_KEY (obligatoria) y OPENROUTER_MODEL (opcional, por
// defecto un modelo gratuito). En https://openrouter.ai/models hay modelos con el
// sufijo ":free".

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-2.0-flash-exp:free';

const SYSTEM_PROMPT = [
  'Eres un moderador de un chat de Twitch. Clasificas un único mensaje que Twitch',
  'ha RETENIDO (AutoMod o revisión de chatters nuevos) para que un humano decida.',
  'Devuelve SOLO un objeto JSON, sin texto adicional, con esta forma:',
  '{"verdict":"allow|deny|review","confidence":0..1,"reason":"motivo breve en español"}.',
  '- "allow": mensaje legítimo y de buenas intenciones (saludo, pregunta normal,',
  '  espectador nuevo amistoso).',
  '- "deny": spam, estafas, enlaces sospechosos, autopromoción/follow4follow, acoso,',
  '  odio o contenido sexual no permitido.',
  '- "review": ambiguo o no tienes suficiente contexto.',
  'Sé conservador: ante la duda usa "review", no "allow".',
].join(' ');

// Extrae el primer objeto JSON del contenido del modelo (tolera fences ```json).
const extractJson = (content) => {
  const text = String(content || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(text); } catch { /* intenta buscar el bloque */ }
  const match = text.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* nada */ } }
  throw new Error('El modelo no devolvió JSON válido');
};

// Normaliza la respuesta del modelo a un veredicto seguro.
const parseVerdict = (content) => {
  const json = extractJson(content);
  const verdict = ['allow', 'deny', 'review'].includes(json.verdict) ? json.verdict : 'review';
  let confidence = Number(json.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.min(1, Math.max(0, confidence));
  const reason = typeof json.reason === 'string' ? json.reason.slice(0, 200) : '';
  return { verdict, confidence, reason };
};

const triageMessage = async ({ name, text }, env = process.env, fetchFn = fetch) => {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Falta OPENROUTER_API_KEY en apps/web/.env.local');

  const response = await fetchFn(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // Recomendados por OpenRouter para identificar la app (opcionales).
      'HTTP-Referer': env.OPENROUTER_SITE_URL || 'http://localhost:3000',
      'X-Title': 'Stream Toolkit',
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL || DEFAULT_MODEL,
      temperature: 0,
      max_tokens: 200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Usuario: ${name || 'desconocido'}\nMensaje: ${text}` },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenRouter respondió ${response.status}`);
  }
  return parseVerdict(data.choices?.[0]?.message?.content);
};

module.exports = { triageMessage, parseVerdict, DEFAULT_MODEL };
