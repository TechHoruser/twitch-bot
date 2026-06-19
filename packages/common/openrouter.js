// Llamadas a un LLM vía OpenRouter (API compatible con OpenAI). La clave vive solo
// en el servidor (apps/web/.env.local). Dos usos:
//   - triageMessage: valora un mensaje retenido (/api/admin/automod/triage).
//   - assistChat: ayuda al chat respondiendo dudas del viewer (/api/admin/assistant).
// Todo es inyectable (env, fetch) para poder testearlo de forma aislada.
//
// Variables: OPENROUTER_API_KEY (obligatoria) y OPENROUTER_MODEL (opcional, por
// defecto un modelo gratuito). En https://openrouter.ai/models hay modelos con el
// sufijo ":free".

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Meta-modelo de OpenRouter que enruta a cualquier gratuito disponible: así el
// default no se queda obsoleto cuando retiran un modelo concreto. Cámbialo con
// OPENROUTER_MODEL (lista en https://openrouter.ai/models?max_price=0).
const DEFAULT_MODEL = 'openrouter/free';

// Llamada genérica de chat completion. Devuelve el texto del modelo. `json` activa
// el modo response_format JSON (lo usa el triaje). Lanza si falta la clave o si la
// API responde con error.
const requestCompletion = async ({ system, user, json = false, temperature = 0, maxTokens = 200 }, env = process.env, fetchFn = fetch) => {
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
      temperature,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenRouter respondió ${response.status}`);
  }
  return data.choices?.[0]?.message?.content ?? '';
};

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
  const content = await requestCompletion({
    system: SYSTEM_PROMPT,
    user: `Usuario: ${name || 'desconocido'}\nMensaje: ${text}`,
    json: true,
    temperature: 0,
    maxTokens: 200,
  }, env, fetchFn);
  return parseVerdict(content);
};

// ── Asistente del chat ──────────────────────────────────────────────────────
// Lee los últimos mensajes y echa un cable al chat respondiendo dudas del viewer
// con tono bromista, apoyándose solo en los datos del canal que se le pasan.
const MAX_REPLY_LEN = 480; // los anuncios de Twitch admiten 500; dejamos margen

const ASSISTANT_SYSTEM_PROMPT = [
  'Eres el ayudante con IA del chat de Twitch de un streamer. Lees los últimos',
  'mensajes del chat y echas un cable respondiendo dudas de los viewers.',
  'Tono: cercano y BROMISTA, con chispa, pero útil de verdad y sin pasarte (nada',
  'ofensivo ni hiriente). Reglas:',
  '- Responde en español, breve y listo para pegarse en el chat (1-2 frases).',
  '- Detecta qué están preguntando los viewers en los últimos mensajes y respóndelo;',
  '  si hay varias dudas, prioriza la más reciente o la más repetida.',
  '- Usa SOLO los datos de "Contexto del canal" para los enlaces (Discord, perfil/club',
  '  de ajedrez) y para el título/juego del directo. NO te inventes enlaces ni datos',
  '  que no tengas; si no sabes algo, dilo con gracia.',
  '- Si no hay ninguna pregunta clara, suelta un comentario gracioso y con chicha',
  '  sobre lo último que se ha dicho en el chat.',
  '- No hagas menciones con @ ni des órdenes de moderación.',
  'Devuelve SOLO el texto del mensaje, sin comillas ni prefijos.',
].join(' ');

// Convierte el contexto del canal en un bloque legible para el prompt. Cada dato es
// opcional: solo se incluye lo que esté configurado.
const formatContext = (context = {}) => {
  const lines = [];
  if (context.discordLink) lines.push(`- Discord: ${context.discordLink}`);
  const chess = context.chess || {};
  if (chess.profileLink || chess.clubLink) {
    const parts = [];
    if (chess.profileLink) parts.push(`perfil ${chess.profileLink}`);
    if (chess.clubLink) parts.push(`club/equipo ${chess.clubLink}`);
    lines.push(`- Ajedrez (${chess.name || 'ajedrez'}): ${parts.join(' · ')}`);
  }
  const stream = context.stream || {};
  if (stream.title || stream.gameName) {
    const title = stream.title ? `"${stream.title}"` : 'sin título';
    const game = stream.gameName ? ` · jugando a ${stream.gameName}` : '';
    lines.push(`- Directo ahora: ${title}${game}`);
  }
  return lines.length ? lines.join('\n') : '- (sin datos extra del canal)';
};

const assistChat = async ({ messages = [], context = {} }, env = process.env, fetchFn = fetch) => {
  const chatLog = messages
    .slice(-50)
    .map((m) => `${m.name}: ${m.text}`)
    .join('\n') || '(el chat está vacío)';

  const user = [
    'Contexto del canal:',
    formatContext(context),
    '',
    'Últimos mensajes del chat (de más antiguo a más reciente):',
    chatLog,
  ].join('\n');

  const content = await requestCompletion({
    system: ASSISTANT_SYSTEM_PROMPT,
    user,
    temperature: 0.8,
    maxTokens: 300,
  }, env, fetchFn);

  // Limpia comillas envolventes que a veces añade el modelo y acota a la longitud
  // máxima de un anuncio de chat.
  return String(content).trim().replace(/^["'`]+|["'`]+$/g, '').trim().slice(0, MAX_REPLY_LEN);
};

module.exports = { triageMessage, parseVerdict, assistChat, formatContext, DEFAULT_MODEL };
