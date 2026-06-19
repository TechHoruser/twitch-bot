'use client';
import { useEffect, useRef, useState } from 'react';

const EVENTSUB_WS = 'wss://eventsub.wss.twitch.tv/ws';

// Conexión EventSub por WebSocket del panel. Recibe mensajes retenidos por AutoMod
// (cola de "Pendientes de aprobar") y nuevos follows. El navegador mantiene el WS;
// en cuanto Twitch da un session_id, le pedimos al backend que registre las
// suscripciones con el token. Los follows se entregan por callback (onFollow)
// porque disparan animación en el overlay + voz en el panel.
export function useEventSub({ enabled = true, onFollow } = {}) {
  const [held, setHeld] = useState([]);
  const [status, setStatus] = useState('connecting');
  // Tipos de suscripción activos (si falta un scope, follow no estará). Permite
  // avisar en la UI con precisión.
  const [active, setActive] = useState([]);
  const onFollowRef = useRef(onFollow);
  onFollowRef.current = onFollow;

  useEffect(() => {
    if (!enabled) { setStatus('disabled'); return; }

    let cleanup = false;
    let ws;

    const connect = (url) => {
      ws = new WebSocket(url);

      ws.onmessage = async (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        const type = msg.metadata?.message_type;

        if (type === 'session_welcome') {
          const sessionId = msg.payload.session.id;
          try {
            const res = await fetch('/api/admin/eventsub/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId }),
            }).then((r) => r.json());
            setActive(res?.active || []);
            setStatus(res?.ok ? 'connected' : 'error');
          } catch {
            setStatus('error');
          }
        } else if (type === 'session_reconnect') {
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
            setHeld((prev) => prev.filter((m) => m.msgId !== e.message_id));
          } else if (t === 'channel.follow') {
            onFollowRef.current?.({ name: e.user_name || e.user_login, login: e.user_login });
          }
        }
      };

      ws.onclose = () => { if (!cleanup) setStatus((s) => (s === 'reconnecting' ? s : 'closed')); };
      ws.onerror = () => { if (!cleanup) setStatus('error'); };
    };

    connect(EVENTSUB_WS);

    return () => { cleanup = true; ws?.close(); };
  }, [enabled]);

  // Quita un retenido de la lista al instante (tras aprobar/rechazar localmente).
  const removeHeld = (msgId) => setHeld((prev) => prev.filter((m) => m.msgId !== msgId));

  return { held, status, active, removeHeld };
}
