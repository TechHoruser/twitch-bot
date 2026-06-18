'use client';
import { useEffect, useRef, useState } from 'react';
import { useTwitchChat } from './useTwitchChat';

const mod = (body) => fetch('/api/admin/mod', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then((r) => r.json());

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
  const [toast, setToast] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const act = async (body, label) => {
    const res = await mod(body);
    setToast(res?.ok ? `✓ ${label}` : `✗ ${res?.error || 'error'}`);
    setTimeout(() => setToast(null), 2500);
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

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1 text-sm">
        {messages.map((m, i) => (
          <div key={m.id || i} className={`group flex gap-2 items-start rounded px-1 hover:bg-white/5 ${m.removed ? 'opacity-40 line-through' : ''}`}>
            <div className="flex-1 min-w-0 break-words">
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
