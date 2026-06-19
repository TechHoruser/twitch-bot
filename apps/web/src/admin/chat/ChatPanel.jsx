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
const fireAlert = post('/api/admin/alert');

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
  const endRef = useRef(null);
  const seenRef = useRef(null); // ids de mensajes ya procesados (evita releer el backlog)

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

  // Publicar (allow) / Rechazar (deny) un mensaje retenido. Se quita de la lista
  // al instante y luego se confirma contra Helix.
  const resolve = async (m, action) => {
    removeHeld(m.msgId);
    const res = await automod({ action, msgId: m.msgId });
    notify(res?.ok
      ? `✓ mensaje de ${m.name} ${action === 'allow' ? 'publicado' : 'rechazado'}`
      : `✗ ${res?.error || 'error'}`);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-black/20 rounded-lg">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <h2 className="font-semibold">Chat {channel && <span className="opacity-50">· {channel}</span>}</h2>
        <span className={`text-xs ${status === 'connected' ? 'text-emerald-400' : 'text-amber-400'}`}>
          {status === 'connected' ? '● en vivo' : status === 'no-channel' ? 'sin canal' : status}
        </span>
      </div>

      {!channel && (
        <p className="text-sm opacity-60 p-3">
          Configura <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_TWITCH_CHANNEL</code> en
          <code className="bg-white/10 px-1 rounded">apps/web/.env.local</code> (o usa <code>?channel=tu_canal</code>).
        </p>
      )}

      {channel && <VoiceSettings voice={voice} />}

      {/* Mensajes retenidos por AutoMod / revisión de chatters nuevos. No están en
          el chat público hasta que se aprueban aquí. */}
      {held.length > 0 && (
        <div className="shrink-0 max-h-[45%] overflow-y-auto border-b border-amber-500/30 bg-amber-500/5">
          <div className="px-3 py-1.5 text-xs font-semibold text-amber-300">
            ⏳ Pendientes de aprobar ({held.length})
          </div>
          {held.map((m) => (
            <div key={m.msgId} className="px-3 py-2 text-sm border-t border-white/5">
              <div className="break-words">
                <span className="font-bold text-amber-400">{m.name}</span>
                {m.category && <span className="ml-2 text-xs opacity-50">[{m.category}]</span>}
                <div className="opacity-90">{m.text}</div>
              </div>
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
          ))}
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

      {toast && <div className="px-3 py-2 text-xs border-t border-white/10 bg-white/5">{toast}</div>}
    </div>
  );
}
