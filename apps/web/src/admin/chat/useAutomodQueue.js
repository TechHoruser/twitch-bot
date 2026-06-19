'use client';
import { useEffect, useRef, useState } from 'react';

const EVENTSUB_WS = 'wss://eventsub.wss.twitch.tv/ws';

// Recibe los mensajes retenidos por AutoMod (o por la revisión de "primeros
// mensajes" de chatters nuevos) vía EventSub por WebSocket. El navegador mantiene
// la conexión; en cuanto Twitch nos da un session_id, le pedimos al backend que
// dé de alta las suscripciones con el token. Los eventos llegan luego aquí y se
// aprueban/rechazan desde ChatPanel (vía /api/admin/automod).
export function useAutomodQueue(enabled = true) {
  const [held, setHeld] = useState([]);
  const [status, setStatus] = useState('connecting');
  const wsRef = useRef(null);

  useEffect(() => {
    if (!enabled) { setStatus('disabled'); return; }

    let cleanup = false;
    let ws;

    const connect = (url) => {
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = async (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        const type = msg.metadata?.message_type;

        if (type === 'session_welcome') {
          const sessionId = msg.payload.session.id;
          try {
            const res = await fetch('/api/admin/automod/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId }),
            }).then((r) => r.json());
            setStatus(res?.ok ? 'connected' : 'error');
          } catch {
            setStatus('error');
          }
        } else if (type === 'session_reconnect') {
          // Twitch pide migrar a otra URL: reconecta sin perder la cola.
          setStatus('reconnecting');
          connect(msg.payload.session.reconnect_url);
        } else if (type === 'notification') {
          const t = msg.metadata.subscription_type;
          const e = msg.payload.event;
          if (t === 'automod.message.hold') {
            setHeld((prev) => [...prev, {
              msgId: e.message_id,
              userId: e.user_id,
              login: e.user_login,
              name: e.user_name || e.user_login,
              text: e.message?.text || '',
              reason: e.reason,
              category: e.automod?.category || e.blocked_term?.terms_found?.[0]?.term || '',
              heldAt: e.held_at,
            }]);
          } else if (t === 'automod.message.update') {
            // Otro mod (o el propio Twitch al expirar) ya lo resolvió: quítalo.
            setHeld((prev) => prev.filter((m) => m.msgId !== e.message_id));
          }
        }
      };

      ws.onclose = () => { if (!cleanup) setStatus((s) => (s === 'reconnecting' ? s : 'closed')); };
      ws.onerror = () => { if (!cleanup) setStatus('error'); };
    };

    connect(EVENTSUB_WS);

    return () => { cleanup = true; ws?.close(); };
  }, [enabled]);

  // Quita un retenido de la lista al instante (tras aprobar/rechazar localmente,
  // sin esperar al evento automod.message.update que lo confirmaría).
  const remove = (msgId) => setHeld((prev) => prev.filter((m) => m.msgId !== msgId));

  return { held, status, remove };
}
