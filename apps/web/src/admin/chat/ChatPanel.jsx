'use client';
import { useEffect, useRef, useState } from 'react';
import { useTwitchChat } from './useTwitchChat';
import { useEventSub } from './useEventSub';
import { useVoiceAlerts } from './useVoiceAlerts';
import { VoiceSettings } from './VoiceSettings';

const post = (url) => (body) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then((r) => r.json());

const mod = post('/api/admin/mod');
const automod = post('/api/admin/automod');
const triage = post('/api/admin/automod/triage');
const fireAlert = post('/api/admin/alert');
const assist = post('/api/admin/assistant');
const sayToChat = post('/api/admin/chat/say');

// Ajustes del filtro IA (persistidos): enabled = pedir veredicto; auto = publicar
// solo cuando la IA dice "allow" con alta confianza.
const AI_KEY = 'aiTriage';
const loadAi = () => {
  if (typeof window === 'undefined') return { enabled: true, auto: false };
  try { return { enabled: true, auto: false, ...JSON.parse(localStorage.getItem(AI_KEY) || '{}') }; }
  catch { return { enabled: true, auto: false }; }
};
const AUTO_ALLOW_MIN = 0.8; // confianza mínima para auto-publicar

const VERDICT_META = {
  allow: { cls: 'text-emerald-400', label: 'Publicar' },
  deny: { cls: 'text-red-400', label: 'Rechazar' },
  review: { cls: 'text-amber-400', label: 'Revisar' },
};

const BADGE = { broadcaster: '🎥', moderator: '🛡️', vip: '💎', subscriber: '⭐', founder: '⭐', premium: '👑' };
const badgeIcons = (badges) =>
  badges.split(',').map((b) => BADGE[b.split('/')[0]]).filter(Boolean).join('');

const resolveChannel = () => {
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search).get('channel');
    if (q) return q;
  }
  return process.env.NEXT_PUBLIC_TWITCH_CHANNEL || '';
};

export function ChatPanel() {
  const [channel] = useState(resolveChannel);
  const { messages, status } = useTwitchChat(channel);
  const voice = useVoiceAlerts();
  const [toast, setToast] = useState(null);
  const [verdicts, setVerdicts] = useState({}); // veredictos IA por msgId
  const [ai, setAi] = useState({ enabled: true, auto: false });
  const [assistant, setAssistant] = useState(null); // ayuda IA del chat: { state, text, error }
  const [draft, setDraft] = useState(''); // mensaje que se escribe manualmente
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const seenRef = useRef(null); // ids de mensajes ya procesados (evita releer el backlog)
  const triagedRef = useRef(new Set()); // retenidos ya enviados a la IA

  useEffect(() => { setAi(loadAi()); }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(AI_KEY, JSON.stringify(ai));
  }, [ai]);

  // Nuevo follow: animación en el overlay + voz privada para el streamer.
  const onFollow = ({ name }) => {
    fireAlert({ type: 'follow', name });
    voice.announceFollow(name);
  };
  const { held, status: amStatus, active, removeHeld } = useEventSub({ enabled: !!channel, onFollow });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Primer mensaje de un chatter → animación en overlay + voz; resto del chat →
  // lectura en voz si está activada. En el primer render marca el backlog como
  // visto para no leerlo de golpe.
  useEffect(() => {
    if (seenRef.current === null) {
      seenRef.current = new Set(messages.map((m) => m.id));
      return;
    }
    for (const m of messages) {
      if (!m.id || seenRef.current.has(m.id)) continue;
      seenRef.current.add(m.id);
      if (m.firstMsg) {
        fireAlert({ type: 'first-message', name: m.name });
        voice.announceFirstMessage(m.name);
      } else {
        voice.readMessage(m.name, m.text);
      }
    }
  }, [messages]);

  const notify = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  };

  const act = async (body, label) => {
    const res = await mod(body);
    notify(res?.ok ? `✓ ${label}` : `✗ ${res?.error || 'error'}`);
  };

  // Ayuda IA: pasa los últimos 50 mensajes del chat a OpenRouter (con el contexto
  // del canal) y muestra una respuesta editable que puedes mandar al chat.
  const runAssistant = async () => {
    setAssistant({ state: 'loading' });
    const last = messages.slice(-50).map((m) => ({ name: m.name, text: m.text }));
    const res = await assist({ messages: last });
    setAssistant(res?.ok
      ? { state: 'done', text: res.reply }
      : { state: 'error', error: res?.error });
  };

  const sendAssistant = async () => {
    const text = assistant?.text?.trim();
    if (!text) return;
    const res = await sayToChat({ message: text, announce: true });
    notify(res?.ok ? '✓ respuesta enviada al chat' : `✗ ${res?.error || 'error'}`);
    if (res?.ok) setAssistant(null);
  };

  // Escribir manualmente en el chat como un mensaje normal (no destacado).
  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const res = await sayToChat({ message: text });
    notify(res?.ok ? '✓ mensaje enviado al chat' : `✗ ${res?.error || 'error'}`);
    if (res?.ok) setDraft('');
    setSending(false);
  };

  // Publicar (allow) / Rechazar (deny) un mensaje retenido. Se quita de la lista
  // al instante y luego se confirma contra Helix.
  const resolve = async (m, action) => {
    removeHeld(m.msgId);
    const res = await automod({ action, msgId: m.msgId });
    notify(res?.ok
      ? `✓ mensaje de ${m.name} ${action === 'allow' ? 'publicado' : 'rechazado'}`
      : `✗ ${res?.error || 'error'}`);
  };

  // Filtro IA: por cada retenido nuevo pide un veredicto a OpenRouter (una sola
  // vez por mensaje) y, si está activado el modo auto, publica los "allow" con
  // confianza alta. El humano siempre puede decidir manualmente.
  useEffect(() => {
    if (!ai.enabled) return;
    for (const m of held) {
      if (triagedRef.current.has(m.msgId)) continue;
      triagedRef.current.add(m.msgId);
      setVerdicts((v) => ({ ...v, [m.msgId]: { state: 'loading' } }));
      triage({ name: m.name, text: m.text })
        .then((res) => {
          if (res?.ok) {
            setVerdicts((v) => ({ ...v, [m.msgId]: { state: 'done', ...res } }));
            if (ai.auto && res.verdict === 'allow' && res.confidence >= AUTO_ALLOW_MIN) {
              resolve(m, 'allow');
            }
          } else {
            setVerdicts((v) => ({ ...v, [m.msgId]: { state: 'error', error: res?.error } }));
          }
        })
        .catch(() => setVerdicts((v) => ({ ...v, [m.msgId]: { state: 'error' } })));
    }
  }, [held, ai.enabled, ai.auto]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-black/20 rounded-lg">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <h2 className="font-semibold">Chat {channel && <span className="opacity-50">· {channel}</span>}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={runAssistant}
            disabled={!channel || assistant?.state === 'loading'}
            title="Pasa los últimos 50 mensajes a la IA para echarle un cable al chat"
            className="px-2 py-0.5 rounded bg-fuchsia-600/80 hover:bg-fuchsia-600 disabled:opacity-40 text-xs"
          >🤖 Ayuda IA</button>
          <span className={`text-xs ${status === 'connected' ? 'text-emerald-400' : 'text-amber-400'}`}>
            {status === 'connected' ? '● en vivo' : status === 'no-channel' ? 'sin canal' : status}
          </span>
        </div>
      </div>

      {!channel && (
        <p className="text-sm opacity-60 p-3">
          Configura <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_TWITCH_CHANNEL</code> en
          <code className="bg-white/10 px-1 rounded">apps/web/.env.local</code> (o usa <code>?channel=tu_canal</code>).
        </p>
      )}

      {channel && <VoiceSettings voice={voice} />}

      {/* Ayuda IA: respuesta generada a partir de los últimos 50 mensajes. Editable
          antes de mandarla al chat (como anuncio destacado). */}
      {assistant && (
        <div className="shrink-0 border-b border-fuchsia-500/30 bg-fuchsia-500/5 px-3 py-2 text-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-fuchsia-300 mb-1">
            <span>🤖 Ayuda IA</span>
            <button className="opacity-60 hover:opacity-100" onClick={() => setAssistant(null)} title="Cerrar">✕</button>
          </div>
          {assistant.state === 'loading' && <span className="opacity-60">pensando una respuesta con gracia…</span>}
          {assistant.state === 'error' && (
            <span className="text-amber-400/80">IA no disponible{assistant.error ? ` · ${assistant.error}` : ''}</span>
          )}
          {assistant.state === 'done' && (
            <>
              <textarea
                className="w-full bg-black/30 rounded p-2 text-sm resize-y min-h-[3rem] outline-none focus:ring-1 focus:ring-fuchsia-500/50"
                value={assistant.text}
                onChange={(e) => setAssistant((s) => ({ ...s, text: e.target.value }))}
              />
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  className="px-2 py-0.5 rounded bg-fuchsia-600/80 hover:bg-fuchsia-600 disabled:opacity-40 text-xs"
                  disabled={!assistant.text?.trim()}
                  onClick={sendAssistant}
                >📣 Enviar al chat</button>
                <button
                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-xs"
                  onClick={runAssistant}
                >↻ Otra</button>
                <span className="ml-auto text-xs opacity-40">{assistant.text?.length || 0}/500</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Mensajes retenidos por AutoMod / revisión de chatters nuevos. No están en
          el chat público hasta que se aprueban aquí. */}
      {held.length > 0 && (
        <div className="shrink-0 max-h-[45%] overflow-y-auto border-b border-amber-500/30 bg-amber-500/5">
          <div className="px-3 py-1.5 flex items-center justify-between text-xs font-semibold text-amber-300">
            <span>⏳ Pendientes de aprobar ({held.length})</span>
            <span className="flex items-center gap-3 font-normal opacity-90">
              <label className="flex items-center gap-1" title="Pedir veredicto a la IA (OpenRouter)">
                <input type="checkbox" checked={ai.enabled} onChange={(e) => setAi((s) => ({ ...s, enabled: e.target.checked }))} />
                🤖 IA
              </label>
              <label className="flex items-center gap-1" title="Publicar automáticamente los 'allow' con confianza alta">
                <input type="checkbox" checked={ai.auto} disabled={!ai.enabled} onChange={(e) => setAi((s) => ({ ...s, auto: e.target.checked }))} />
                auto
              </label>
            </span>
          </div>
          {held.map((m) => {
            const v = verdicts[m.msgId];
            const meta = v?.verdict ? VERDICT_META[v.verdict] : null;
            return (
              <div key={m.msgId} className="px-3 py-2 text-sm border-t border-white/5">
                <div className="break-words">
                  <span className="font-bold text-amber-400">{m.name}</span>
                  {m.category && <span className="ml-2 text-xs opacity-50">[{m.category}]</span>}
                  <div className="opacity-90">{m.text}</div>
                </div>

                {ai.enabled && v && (
                  <div className="mt-1 text-xs">
                    {v.state === 'loading' && <span className="opacity-60">🤖 analizando…</span>}
                    {v.state === 'error' && <span className="text-amber-400/80">🤖 IA no disponible{v.error ? ` · ${v.error}` : ''}</span>}
                    {v.state === 'done' && meta && (
                      <span className={meta.cls}>
                        🤖 {meta.label} · {Math.round(v.confidence * 100)}%{v.reason ? ` · ${v.reason}` : ''}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mt-1.5">
                  <button
                    className="px-2 py-0.5 rounded bg-emerald-600/80 hover:bg-emerald-600 text-xs"
                    onClick={() => resolve(m, 'allow')}
                  >✓ Publicar</button>
                  <button
                    className="px-2 py-0.5 rounded bg-red-600/80 hover:bg-red-600 text-xs"
                    onClick={() => resolve(m, 'deny')}
                  >✕ Rechazar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {channel && amStatus === 'error' && (
        <p className="px-3 py-1.5 text-xs text-amber-400/80 border-b border-white/10">
          ⚠️ No se pudo conectar a EventSub. Revisa que el token tenga los scopes
          <code className="bg-white/10 px-1 rounded mx-1">moderator:manage:automod</code> y
          <code className="bg-white/10 px-1 rounded mx-1">moderator:read:followers</code>.
        </p>
      )}

      {channel && amStatus === 'connected' && !active.includes('channel.follow') && (
        <p className="px-3 py-1.5 text-xs text-amber-400/80 border-b border-white/10">
          ⚠️ No se reciben follows. Añade el scope
          <code className="bg-white/10 px-1 rounded mx-1">moderator:read:followers</code> al token.
        </p>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1 text-sm">
        {messages.map((m, i) => (
          <div key={m.id || i} className={`group flex gap-2 items-start rounded px-1 hover:bg-white/5 ${m.removed ? 'opacity-40 line-through' : ''} ${m.firstMsg ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' : ''}`}>
            <div className="flex-1 min-w-0 break-words">
              {m.firstMsg && <span className="mr-1" title="Primer mensaje">👋</span>}
              <span className="mr-1">{badgeIcons(m.badges)}</span>
              <span className="font-bold" style={{ color: m.color }}>{m.name}</span>
              <span className="opacity-50">: </span>
              <span>{m.text}</span>
            </div>
            <div className="hidden group-hover:flex gap-1 shrink-0">
              <button title="Borrar mensaje" className="hover:text-red-400" onClick={() => act({ action: 'delete', messageId: m.id }, `mensaje de ${m.name} borrado`)}>🗑</button>
              <button title="Timeout 10 min" className="hover:text-amber-400" onClick={() => act({ action: 'timeout', userId: m.userId, username: m.login, duration: 600 }, `${m.name} en timeout`)}>⏲</button>
              <button title="Ban" className="hover:text-red-500" onClick={() => act({ action: 'ban', userId: m.userId, username: m.login }, `${m.name} baneado`)}>⛔</button>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Escribir manualmente en el chat (mensaje normal, no destacado). */}
      {channel && (
        <div className="shrink-0 flex items-end gap-2 px-3 py-2 border-t border-white/10">
          <textarea
            className="flex-1 bg-black/30 rounded p-2 text-sm resize-none h-9 max-h-24 outline-none focus:ring-1 focus:ring-fuchsia-500/50"
            placeholder="Escribe en el chat…"
            value={draft}
            maxLength={500}
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            className="px-3 py-1.5 rounded bg-fuchsia-600/80 hover:bg-fuchsia-600 disabled:opacity-40 text-sm"
            disabled={!draft.trim() || sending}
            onClick={sendMessage}
          >Enviar</button>
        </div>
      )}

      {toast && <div className="px-3 py-2 text-xs border-t border-white/10 bg-white/5">{toast}</div>}
    </div>
  );
}
